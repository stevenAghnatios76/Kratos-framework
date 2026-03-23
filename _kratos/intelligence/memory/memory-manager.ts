import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

export interface MemoryEntry {
  id?: number;
  partition: 'decisions' | 'patterns' | 'facts' | 'context' | 'anti-patterns' | 'trajectories';
  agent_id: string;
  access_level: 'agent-private' | 'team-shared' | 'global';
  title: string;
  content: string;
  tags: string[];
  metadata: Record<string, unknown>;
  score: number;
  use_count?: number;
  last_used_at?: string;
  status: 'active' | 'stale' | 'contradicted' | 'archived';
  ttl_days: number;
  created_at?: string;
  updated_at?: string;
  expires_at?: string;
  source_workflow?: string;
  source_story?: string;
  source_session?: string;
}

export class MemoryManager {
  private db: Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async init(): Promise<void> {
    const SQL = await initSqlJs();

    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    this.db.run(schema);
    this.save();
  }

  private save(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.dbPath, buffer);
  }

  private getDb(): Database {
    if (!this.db) throw new Error('Database not initialized. Call init() first.');
    return this.db;
  }

  // CRUD

  async store(entry: MemoryEntry): Promise<number> {
    const db = this.getDb();
    const expiresAt = entry.ttl_days
      ? new Date(Date.now() + entry.ttl_days * 86400000).toISOString()
      : null;

    db.run(
      `INSERT INTO memory_entries (partition, agent_id, access_level, title, content, tags, metadata, score, status, ttl_days, expires_at, source_workflow, source_story, source_session)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.partition,
        entry.agent_id,
        entry.access_level,
        entry.title,
        entry.content,
        JSON.stringify(entry.tags),
        JSON.stringify(entry.metadata),
        entry.score,
        entry.status,
        entry.ttl_days,
        expiresAt,
        entry.source_workflow || null,
        entry.source_story || null,
        entry.source_session || null,
      ]
    );

    const result = db.exec('SELECT last_insert_rowid() as id');
    const id = result[0].values[0][0] as number;
    this.save();
    return id;
  }

  async get(id: number): Promise<MemoryEntry | null> {
    const db = this.getDb();
    const result = db.exec('SELECT * FROM memory_entries WHERE id = ?', [id]);
    if (!result.length || !result[0].values.length) return null;
    return this.rowToEntry(result[0].columns, result[0].values[0]);
  }

  async update(id: number, changes: Partial<MemoryEntry>): Promise<void> {
    const db = this.getDb();
    const sets: string[] = [];
    const values: unknown[] = [];

    if (changes.title !== undefined) { sets.push('title = ?'); values.push(changes.title); }
    if (changes.content !== undefined) { sets.push('content = ?'); values.push(changes.content); }
    if (changes.tags !== undefined) { sets.push('tags = ?'); values.push(JSON.stringify(changes.tags)); }
    if (changes.metadata !== undefined) { sets.push('metadata = ?'); values.push(JSON.stringify(changes.metadata)); }
    if (changes.score !== undefined) { sets.push('score = ?'); values.push(changes.score); }
    if (changes.status !== undefined) { sets.push('status = ?'); values.push(changes.status); }
    if (changes.ttl_days !== undefined) {
      sets.push('ttl_days = ?');
      values.push(changes.ttl_days);
      const expiresAt = new Date(Date.now() + changes.ttl_days * 86400000).toISOString();
      sets.push('expires_at = ?');
      values.push(expiresAt);
    }
    if (changes.access_level !== undefined) { sets.push('access_level = ?'); values.push(changes.access_level); }

    if (sets.length === 0) return;

    sets.push("updated_at = datetime('now')");
    values.push(id);

    db.run(`UPDATE memory_entries SET ${sets.join(', ')} WHERE id = ?`, values);
    this.save();
  }

  async delete(id: number): Promise<void> {
    const db = this.getDb();
    db.run('DELETE FROM memory_entries WHERE id = ?', [id]);
    this.save();
  }

  // Query

  async query(opts: {
    partition?: string;
    agent_id?: string;
    access_level?: string;
    status?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
    order_by?: 'score' | 'created_at' | 'last_used_at';
  }): Promise<MemoryEntry[]> {
    const db = this.getDb();
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (opts.partition) { conditions.push('partition = ?'); values.push(opts.partition); }
    if (opts.agent_id) { conditions.push('agent_id = ?'); values.push(opts.agent_id); }
    if (opts.access_level) { conditions.push('access_level = ?'); values.push(opts.access_level); }
    if (opts.status) { conditions.push('status = ?'); values.push(opts.status); }
    if (opts.tags && opts.tags.length > 0) {
      const tagConditions = opts.tags.map(() => "tags LIKE ?");
      conditions.push(`(${tagConditions.join(' OR ')})`);
      opts.tags.forEach(tag => values.push(`%"${tag}"%`));
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderBy = opts.order_by === 'score' ? 'score DESC' :
                    opts.order_by === 'last_used_at' ? 'last_used_at DESC' :
                    'created_at DESC';
    const limit = opts.limit || 100;
    const offset = opts.offset || 0;

    const sql = `SELECT * FROM memory_entries ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    values.push(limit, offset);

    const result = db.exec(sql, values);
    if (!result.length) return [];
    return result[0].values.map(row => this.rowToEntry(result[0].columns, row));
  }

  // Search

  async search(query: string, opts?: {
    partition?: string;
    agent_id?: string;
    limit?: number;
  }): Promise<MemoryEntry[]> {
    const db = this.getDb();
    const conditions: string[] = ["(title LIKE ? OR content LIKE ?)"];
    const searchTerm = `%${query}%`;
    const values: unknown[] = [searchTerm, searchTerm];

    if (opts?.partition) { conditions.push('partition = ?'); values.push(opts.partition); }
    if (opts?.agent_id) { conditions.push('agent_id = ?'); values.push(opts.agent_id); }

    const limit = opts?.limit || 20;
    values.push(limit);

    const sql = `SELECT * FROM memory_entries WHERE ${conditions.join(' AND ')} AND status = 'active' ORDER BY score DESC, updated_at DESC LIMIT ?`;
    const result = db.exec(sql, values);
    if (!result.length) return [];
    return result[0].values.map(row => this.rowToEntry(result[0].columns, row));
  }

  // Agent-scoped helpers

  async getAgentMemory(agent_id: string): Promise<MemoryEntry[]> {
    const db = this.getDb();
    const sql = `SELECT * FROM memory_entries WHERE (agent_id = ? OR access_level IN ('team-shared', 'global')) AND status = 'active' ORDER BY score DESC, updated_at DESC`;
    const result = db.exec(sql, [agent_id]);
    if (!result.length) return [];
    return result[0].values.map(row => this.rowToEntry(result[0].columns, row));
  }

  async storeDecision(agent_id: string, title: string, content: string, opts?: Partial<MemoryEntry>): Promise<number> {
    return this.store({
      partition: 'decisions',
      agent_id,
      access_level: 'agent-private',
      title,
      content,
      tags: [],
      metadata: {},
      score: 0.5,
      status: 'active',
      ttl_days: 90,
      ...opts,
    });
  }

  async storeFact(agent_id: string, title: string, content: string): Promise<number> {
    return this.store({
      partition: 'facts',
      agent_id,
      access_level: 'agent-private',
      title,
      content,
      tags: [],
      metadata: {},
      score: 0.5,
      status: 'active',
      ttl_days: 90,
    });
  }

  async storePattern(agent_id: string, title: string, content: string, score: number): Promise<number> {
    return this.store({
      partition: 'patterns',
      agent_id,
      access_level: 'agent-private',
      title,
      content,
      tags: [],
      metadata: {},
      score,
      status: 'active',
      ttl_days: 90,
    });
  }

  async storeAntiPattern(agent_id: string, title: string, content: string): Promise<number> {
    return this.store({
      partition: 'anti-patterns',
      agent_id,
      access_level: 'agent-private',
      title,
      content,
      tags: [],
      metadata: {},
      score: 0.0,
      status: 'active',
      ttl_days: 90,
    });
  }

  // Lifecycle

  async expireStaleEntries(): Promise<number> {
    const db = this.getDb();
    const result = db.exec(
      "SELECT COUNT(*) FROM memory_entries WHERE expires_at < datetime('now') AND status = 'active'"
    );
    const count = (result[0]?.values[0]?.[0] as number) || 0;

    if (count > 0) {
      db.run("DELETE FROM memory_entries WHERE expires_at < datetime('now') AND status = 'active'");
      this.save();
    }
    return count;
  }

  async evictLRU(partition: string, maxEntries: number): Promise<number> {
    const db = this.getDb();
    const countResult = db.exec(
      'SELECT COUNT(*) FROM memory_entries WHERE partition = ?',
      [partition]
    );
    const total = (countResult[0]?.values[0]?.[0] as number) || 0;

    if (total <= maxEntries) return 0;

    const toEvict = total - maxEntries;
    db.run(
      `DELETE FROM memory_entries WHERE id IN (
        SELECT id FROM memory_entries WHERE partition = ?
        ORDER BY COALESCE(last_used_at, created_at) ASC LIMIT ?
      )`,
      [partition, toEvict]
    );
    this.save();
    return toEvict;
  }

  async markStale(id: number): Promise<void> {
    await this.update(id, { status: 'stale' });
  }

  async markContradicted(id: number, reason: string): Promise<void> {
    const entry = await this.get(id);
    if (!entry) return;
    const metadata = { ...entry.metadata, contradiction_reason: reason };
    await this.update(id, { status: 'contradicted', metadata });
  }

  // Export

  async exportAgentSidecar(agent_id: string): Promise<string> {
    const entries = await this.query({ agent_id, status: 'active', order_by: 'score' });
    const partitions: Record<string, MemoryEntry[]> = {};

    for (const entry of entries) {
      if (!partitions[entry.partition]) partitions[entry.partition] = [];
      partitions[entry.partition].push(entry);
    }

    let md = `# ${agent_id} — Memory Sidecar\n\n`;
    md += `*Exported at: ${new Date().toISOString()}*\n\n`;

    for (const [partition, items] of Object.entries(partitions)) {
      md += `## ${partition.charAt(0).toUpperCase() + partition.slice(1)}\n\n`;
      for (const item of items) {
        md += `### ${item.title}\n`;
        md += `*Score: ${item.score} | Status: ${item.status} | Created: ${item.created_at}*\n\n`;
        md += `${item.content}\n\n`;
        if (item.tags.length > 0) {
          md += `Tags: ${item.tags.join(', ')}\n\n`;
        }
      }
    }

    return md;
  }

  async exportAllSidecars(outputDir: string): Promise<void> {
    const db = this.getDb();
    const result = db.exec('SELECT DISTINCT agent_id FROM memory_entries');
    if (!result.length) return;

    const agents = result[0].values.map(row => row[0] as string);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const agent of agents) {
      const md = await this.exportAgentSidecar(agent);
      const filePath = path.join(outputDir, `${agent}-sidecar`, 'decision-log.md');
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, md, 'utf-8');
    }
  }

  // Stats

  async getStats(): Promise<{
    total_entries: number;
    by_partition: Record<string, number>;
    by_agent: Record<string, number>;
    stale_count: number;
    expired_count: number;
  }> {
    const db = this.getDb();

    const totalResult = db.exec('SELECT COUNT(*) FROM memory_entries');
    const total_entries = (totalResult[0]?.values[0]?.[0] as number) || 0;

    const partitionResult = db.exec('SELECT partition, COUNT(*) FROM memory_entries GROUP BY partition');
    const by_partition: Record<string, number> = {};
    if (partitionResult.length) {
      for (const row of partitionResult[0].values) {
        by_partition[row[0] as string] = row[1] as number;
      }
    }

    const agentResult = db.exec('SELECT agent_id, COUNT(*) FROM memory_entries GROUP BY agent_id');
    const by_agent: Record<string, number> = {};
    if (agentResult.length) {
      for (const row of agentResult[0].values) {
        by_agent[row[0] as string] = row[1] as number;
      }
    }

    const staleResult = db.exec("SELECT COUNT(*) FROM memory_entries WHERE status = 'stale'");
    const stale_count = (staleResult[0]?.values[0]?.[0] as number) || 0;

    const expiredResult = db.exec(
      "SELECT COUNT(*) FROM memory_entries WHERE expires_at < datetime('now') AND status = 'active'"
    );
    const expired_count = (expiredResult[0]?.values[0]?.[0] as number) || 0;

    return { total_entries, by_partition, by_agent, stale_count, expired_count };
  }

  // Database access for other modules

  getDatabase(): Database {
    return this.getDb();
  }

  // Close

  async close(): Promise<void> {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }

  // Internal helpers

  private rowToEntry(columns: string[], row: unknown[]): MemoryEntry {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });

    return {
      id: obj.id as number,
      partition: obj.partition as MemoryEntry['partition'],
      agent_id: obj.agent_id as string,
      access_level: obj.access_level as MemoryEntry['access_level'],
      title: obj.title as string,
      content: obj.content as string,
      tags: JSON.parse((obj.tags as string) || '[]'),
      metadata: JSON.parse((obj.metadata as string) || '{}'),
      score: obj.score as number,
      use_count: obj.use_count as number,
      last_used_at: obj.last_used_at as string | undefined,
      status: obj.status as MemoryEntry['status'],
      ttl_days: obj.ttl_days as number,
      created_at: obj.created_at as string,
      updated_at: obj.updated_at as string,
      expires_at: obj.expires_at as string | undefined,
      source_workflow: obj.source_workflow as string | undefined,
      source_story: obj.source_story as string | undefined,
      source_session: obj.source_session as string | undefined,
    };
  }
}
