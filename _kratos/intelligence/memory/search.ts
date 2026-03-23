import { MemoryManager, MemoryEntry } from './memory-manager';

export interface SearchOptions {
  partition?: string;
  agent_id?: string;
  access_level?: string;
  tags?: string[];
  limit?: number;
  min_score?: number;
}

export class MemorySearch {
  private manager: MemoryManager;

  constructor(manager: MemoryManager) {
    this.manager = manager;
  }

  async fullTextSearch(query: string, opts?: SearchOptions): Promise<MemoryEntry[]> {
    const results = await this.manager.search(query, {
      partition: opts?.partition,
      agent_id: opts?.agent_id,
      limit: opts?.limit || 20,
    });

    let filtered = results;

    if (opts?.min_score !== undefined) {
      filtered = filtered.filter(e => e.score >= opts.min_score!);
    }

    if (opts?.tags && opts.tags.length > 0) {
      filtered = filtered.filter(e =>
        opts.tags!.some(tag => e.tags.includes(tag))
      );
    }

    if (opts?.access_level) {
      filtered = filtered.filter(e => e.access_level === opts.access_level);
    }

    return filtered;
  }

  async findSimilar(entryId: number, limit: number = 5): Promise<MemoryEntry[]> {
    const entry = await this.manager.get(entryId);
    if (!entry) return [];

    const keywords = this.extractKeywords(entry.title + ' ' + entry.content);
    const results: MemoryEntry[] = [];

    for (const keyword of keywords.slice(0, 5)) {
      const matches = await this.manager.search(keyword, {
        partition: entry.partition,
        limit: limit * 2,
      });
      for (const match of matches) {
        if (match.id !== entryId && !results.find(r => r.id === match.id)) {
          results.push(match);
        }
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async findByTags(tags: string[], opts?: { partition?: string; limit?: number }): Promise<MemoryEntry[]> {
    return this.manager.query({
      tags,
      partition: opts?.partition,
      limit: opts?.limit || 20,
      order_by: 'score',
    });
  }

  async findContradictions(agent_id: string): Promise<{ entry: MemoryEntry; contradicts: MemoryEntry }[]> {
    const entries = await this.manager.query({
      agent_id,
      partition: 'decisions',
      status: 'active',
      order_by: 'created_at',
    });

    const contradictions: { entry: MemoryEntry; contradicts: MemoryEntry }[] = [];

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const overlap = this.calculateOverlap(entries[i], entries[j]);
        if (overlap > 0.6) {
          contradictions.push({ entry: entries[j], contradicts: entries[i] });
        }
      }
    }

    return contradictions;
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
      'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
      'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
      'and', 'but', 'or', 'not', 'no', 'nor', 'so', 'yet', 'both', 'either',
      'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most',
      'other', 'some', 'such', 'than', 'too', 'very', 'just', 'because',
      'this', 'that', 'these', 'those', 'it', 'its', 'we', 'they', 'them',
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
      .filter((w, i, arr) => arr.indexOf(w) === i)
      .slice(0, 20);
  }

  private calculateOverlap(a: MemoryEntry, b: MemoryEntry): number {
    const keywordsA = new Set(this.extractKeywords(a.title + ' ' + a.content));
    const keywordsB = new Set(this.extractKeywords(b.title + ' ' + b.content));
    const intersection = [...keywordsA].filter(k => keywordsB.has(k));
    const union = new Set([...keywordsA, ...keywordsB]);
    return union.size > 0 ? intersection.length / union.size : 0;
  }
}
