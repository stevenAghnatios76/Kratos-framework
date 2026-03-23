import { MemoryManager } from '../memory/memory-manager';
import { TrajectoryRecorder, Trajectory } from './trajectory-recorder';

export interface DistilledPattern {
  title: string;
  description: string;
  conditions: string[];
  approach: string;
  avg_score: number;
  frequency: number;
  source_trajectories: number[];
}

export class PatternDistiller {
  private db: MemoryManager;
  private recorder: TrajectoryRecorder;

  constructor(db: MemoryManager) {
    this.db = db;
    this.recorder = new TrajectoryRecorder(db);
  }

  async distill(opts?: {
    agent_id?: string;
    min_trajectories?: number;
    min_score?: number;
  }): Promise<DistilledPattern[]> {
    const minTrajectories = opts?.min_trajectories || 3;
    const minScore = opts?.min_score || 0.7;
    const patterns: DistilledPattern[] = [];

    const trajectories = await this.recorder.getAllScored({
      minScore: 0,
      limit: 500,
    });

    // Group by agent_id + workflow
    const groups = new Map<string, Trajectory[]>();
    for (const traj of trajectories) {
      if (opts?.agent_id && traj.agent_id !== opts.agent_id) continue;
      const key = `${traj.agent_id}::${traj.workflow}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(traj);
    }

    for (const [, group] of groups) {
      // Cluster by similar approach
      const clusters = this.clusterByApproach(group);

      for (const cluster of clusters) {
        if (cluster.length < minTrajectories) continue;

        const avgScore = cluster.reduce((sum, t) => sum + (t.score || 0), 0) / cluster.length;

        if (avgScore >= minScore) {
          // Extract positive pattern
          patterns.push(this.extractPattern(cluster, avgScore));
        } else if (avgScore <= 0.3) {
          // Extract anti-pattern (negative score threshold)
          patterns.push(this.extractAntiPattern(cluster, avgScore));
        }
      }
    }

    return patterns;
  }

  async storePattern(pattern: DistilledPattern): Promise<number> {
    return this.db.storePattern(
      'system',
      pattern.title,
      this.formatPatternContent(pattern),
      pattern.avg_score
    );
  }

  async storeAntiPattern(pattern: DistilledPattern): Promise<number> {
    return this.db.storeAntiPattern(
      'system',
      pattern.title,
      this.formatPatternContent(pattern)
    );
  }

  async runDistillationCycle(): Promise<{
    patterns_created: number;
    anti_patterns_created: number;
    trajectories_analyzed: number;
  }> {
    const distilled = await this.distill();
    let patterns_created = 0;
    let anti_patterns_created = 0;

    for (const pattern of distilled) {
      if (pattern.avg_score >= 0.7) {
        await this.storePattern(pattern);
        patterns_created++;
      } else {
        await this.storeAntiPattern(pattern);
        anti_patterns_created++;
      }
    }

    const trajectories = await this.recorder.getAllScored();

    return {
      patterns_created,
      anti_patterns_created,
      trajectories_analyzed: trajectories.length,
    };
  }

  private clusterByApproach(trajectories: Trajectory[]): Trajectory[][] {
    const clusters = new Map<string, Trajectory[]>();

    for (const traj of trajectories) {
      const approach = traj.action_taken.approach.toLowerCase().trim();
      // Normalize approach to group similar ones
      const normalized = this.normalizeApproach(approach);
      if (!clusters.has(normalized)) clusters.set(normalized, []);
      clusters.get(normalized)!.push(traj);
    }

    return Array.from(clusters.values());
  }

  private normalizeApproach(approach: string): string {
    return approach
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }

  private extractPattern(cluster: Trajectory[], avgScore: number): DistilledPattern {
    // Find common conditions across all trajectories in the cluster
    const allConditions = cluster.flatMap(t => [
      ...t.state_context.requirements,
      ...t.state_context.constraints,
    ]);
    const conditionCounts = new Map<string, number>();
    for (const c of allConditions) {
      conditionCounts.set(c, (conditionCounts.get(c) || 0) + 1);
    }
    // Keep conditions that appear in at least half the trajectories
    const commonConditions = [...conditionCounts.entries()]
      .filter(([, count]) => count >= cluster.length / 2)
      .map(([condition]) => condition);

    const approach = cluster[0].action_taken.approach;

    return {
      title: `Pattern: ${approach} (${cluster[0].workflow})`,
      description: `Consistently successful approach across ${cluster.length} trajectories with avg score ${avgScore.toFixed(2)}`,
      conditions: commonConditions,
      approach,
      avg_score: avgScore,
      frequency: cluster.length,
      source_trajectories: cluster.map(t => t.id!).filter(Boolean),
    };
  }

  private extractAntiPattern(cluster: Trajectory[], avgScore: number): DistilledPattern {
    const approach = cluster[0].action_taken.approach;

    // Collect common issues
    const allIssues = cluster
      .filter(t => t.outcome)
      .flatMap(t => t.outcome!.issues_found);
    const uniqueIssues = [...new Set(allIssues)];

    return {
      title: `Anti-Pattern: ${approach} (${cluster[0].workflow})`,
      description: `Consistently failing approach across ${cluster.length} trajectories with avg score ${avgScore.toFixed(2)}. Common issues: ${uniqueIssues.slice(0, 3).join('; ')}`,
      conditions: uniqueIssues.slice(0, 5),
      approach,
      avg_score: avgScore,
      frequency: cluster.length,
      source_trajectories: cluster.map(t => t.id!).filter(Boolean),
    };
  }

  private formatPatternContent(pattern: DistilledPattern): string {
    let content = `**Approach:** ${pattern.approach}\n`;
    content += `**Avg Score:** ${pattern.avg_score.toFixed(2)}\n`;
    content += `**Frequency:** ${pattern.frequency} trajectories\n\n`;

    if (pattern.conditions.length > 0) {
      content += `**Conditions:**\n`;
      for (const c of pattern.conditions) {
        content += `- ${c}\n`;
      }
    }

    content += `\n**Source Trajectories:** ${pattern.source_trajectories.join(', ')}`;
    return content;
  }
}
