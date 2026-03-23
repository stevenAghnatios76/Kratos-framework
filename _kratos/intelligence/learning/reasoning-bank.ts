import { MemoryManager, MemoryEntry } from '../memory/memory-manager';
import { TrajectoryRecorder, Trajectory } from './trajectory-recorder';

export class ReasoningBank {
  private db: MemoryManager;
  private recorder: TrajectoryRecorder;

  constructor(db: MemoryManager) {
    this.db = db;
    this.recorder = new TrajectoryRecorder(db);
  }

  async retrievePatterns(opts: {
    agent_id: string;
    workflow: string;
    context_keywords: string[];
    limit?: number;
  }): Promise<{
    patterns: MemoryEntry[];
    anti_patterns: MemoryEntry[];
    similar_trajectories: Trajectory[];
  }> {
    const limit = opts.limit || 5;

    // Search patterns partition
    const patterns = await this.searchPartition(
      'patterns',
      opts.agent_id,
      opts.context_keywords,
      limit
    );

    // Search anti-patterns partition
    const anti_patterns = await this.searchPartition(
      'anti-patterns',
      opts.agent_id,
      opts.context_keywords,
      limit
    );

    // Search trajectories for similar workflow + context
    const similar_trajectories = await this.findSimilarTrajectories(
      opts.agent_id,
      opts.workflow,
      opts.context_keywords,
      limit
    );

    return { patterns, anti_patterns, similar_trajectories };
  }

  async formatForPrompt(patterns: MemoryEntry[], antiPatterns: MemoryEntry[]): Promise<string> {
    let output = '';

    if (patterns.length > 0) {
      output += '## Learned Patterns (apply these)\n\n';
      for (let i = 0; i < patterns.length; i++) {
        output += `${i + 1}. **${patterns[i].title}** (score: ${patterns[i].score.toFixed(2)}) — ${patterns[i].content.split('\n')[0]}\n`;
      }
      output += '\n';
    }

    if (antiPatterns.length > 0) {
      output += '## Anti-Patterns (avoid these)\n\n';
      for (let i = 0; i < antiPatterns.length; i++) {
        output += `${i + 1}. **${antiPatterns[i].title}** (score: ${antiPatterns[i].score.toFixed(2)}) — ${antiPatterns[i].content.split('\n')[0]}\n`;
      }
      output += '\n';
    }

    if (patterns.length === 0 && antiPatterns.length === 0) {
      output = '## No Learned Patterns Yet\n\nNo relevant patterns found for this context.\n';
    }

    return output;
  }

  async markUsed(entryId: number): Promise<void> {
    const database = this.db.getDatabase();
    database.run(
      `UPDATE memory_entries SET use_count = use_count + 1, last_used_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      [entryId]
    );
  }

  private async searchPartition(
    partition: string,
    agent_id: string,
    keywords: string[],
    limit: number
  ): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = [];
    const seenIds = new Set<number>();

    for (const keyword of keywords) {
      const matches = await this.db.search(keyword, {
        partition,
        limit: limit * 2,
      });

      for (const match of matches) {
        if (!seenIds.has(match.id!)) {
          seenIds.add(match.id!);
          results.push(match);
        }
      }
    }

    // Also include agent-specific entries
    const agentEntries = await this.db.query({
      partition,
      agent_id,
      status: 'active',
      limit,
      order_by: 'score',
    });

    for (const entry of agentEntries) {
      if (!seenIds.has(entry.id!)) {
        seenIds.add(entry.id!);
        results.push(entry);
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private async findSimilarTrajectories(
    agent_id: string,
    workflow: string,
    keywords: string[],
    limit: number
  ): Promise<Trajectory[]> {
    const trajectories = await this.recorder.getAgentTrajectories(agent_id, {
      workflow,
      minScore: 0.5,
      limit: limit * 3,
    });

    // Score trajectories by keyword overlap with context
    const scored = trajectories.map(traj => {
      const trajText = [
        ...traj.state_context.requirements,
        ...traj.state_context.constraints,
        traj.action_taken.decision,
        traj.action_taken.approach,
      ].join(' ').toLowerCase();

      const matchCount = keywords.filter(k => trajText.includes(k.toLowerCase())).length;
      const relevance = keywords.length > 0 ? matchCount / keywords.length : 0;

      return { traj, relevance };
    });

    return scored
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit)
      .map(s => s.traj);
  }
}
