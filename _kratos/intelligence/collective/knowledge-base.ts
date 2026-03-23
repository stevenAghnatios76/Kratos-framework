import { MemoryManager, MemoryEntry } from '../memory/memory-manager';

export class CollectiveKnowledge {
  private db: MemoryManager;

  constructor(db: MemoryManager) {
    this.db = db;
  }

  async shareFact(publisherAgent: string, title: string, content: string, tags: string[]): Promise<number> {
    return this.db.store({
      partition: 'facts',
      agent_id: publisherAgent,
      access_level: 'global',
      title,
      content,
      tags,
      metadata: { shared_by: publisherAgent },
      score: 0.5,
      status: 'active',
      ttl_days: 90,
    });
  }

  async shareDecision(publisherAgent: string, title: string, content: string, tags: string[]): Promise<number> {
    return this.db.store({
      partition: 'decisions',
      agent_id: publisherAgent,
      access_level: 'team-shared',
      title,
      content,
      tags,
      metadata: { shared_by: publisherAgent },
      score: 0.5,
      status: 'active',
      ttl_days: 90,
    });
  }

  async sharePattern(publisherAgent: string, title: string, content: string, score: number): Promise<number> {
    return this.db.store({
      partition: 'patterns',
      agent_id: publisherAgent,
      access_level: 'global',
      title,
      content,
      tags: [],
      metadata: { shared_by: publisherAgent, promoted_to_global: true },
      score,
      status: 'active',
      ttl_days: 180,
    });
  }

  async shareAntiPattern(publisherAgent: string, title: string, content: string): Promise<number> {
    return this.db.store({
      partition: 'anti-patterns',
      agent_id: publisherAgent,
      access_level: 'global',
      title,
      content,
      tags: [],
      metadata: { shared_by: publisherAgent },
      score: 0.0,
      status: 'active',
      ttl_days: 180,
    });
  }

  async getSharedKnowledge(agentId: string, opts?: {
    partition?: string;
    tags?: string[];
    limit?: number;
  }): Promise<MemoryEntry[]> {
    const database = this.db.getDatabase();
    const conditions: string[] = [
      "(access_level IN ('team-shared', 'global') OR agent_id = ?)",
      "status = 'active'",
    ];
    const values: unknown[] = [agentId];

    if (opts?.partition) { conditions.push('partition = ?'); values.push(opts.partition); }
    if (opts?.tags && opts.tags.length > 0) {
      const tagConditions = opts.tags.map(() => "tags LIKE ?");
      conditions.push(`(${tagConditions.join(' OR ')})`);
      opts.tags.forEach(tag => values.push(`%"${tag}"%`));
    }

    const limit = opts?.limit || 50;
    values.push(limit);

    const sql = `SELECT * FROM memory_entries WHERE ${conditions.join(' AND ')} ORDER BY score DESC, updated_at DESC LIMIT ?`;
    const result = database.exec(sql, values);
    if (!result.length) return [];

    return result[0].values.map(row => {
      const obj: Record<string, unknown> = {};
      result[0].columns.forEach((col, i) => { obj[col] = row[i]; });
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
        status: obj.status as MemoryEntry['status'],
        ttl_days: obj.ttl_days as number,
        created_at: obj.created_at as string,
        updated_at: obj.updated_at as string,
      } as MemoryEntry;
    });
  }

  async getRelevantDecisions(agentId: string, limit: number = 10): Promise<MemoryEntry[]> {
    return this.getSharedKnowledge(agentId, {
      partition: 'decisions',
      limit,
    });
  }
}
