import { MemoryManager } from '../memory/memory-manager';

export interface Trajectory {
  id?: number;
  agent_id: string;
  workflow: string;
  story_key?: string;
  state_context: {
    input_files: string[];
    requirements: string[];
    constraints: string[];
    similar_patterns: string[];
  };
  action_taken: {
    decision: string;
    files_modified: string[];
    approach: string;
    alternatives_considered: string[];
  };
  outcome?: {
    review_results: Record<string, 'PASSED' | 'FAILED' | 'APPROVE' | 'REQUEST_CHANGES'>;
    issues_found: string[];
    rework_required: boolean;
  };
  score?: number;
  scored_by?: string;
  created_at?: string;
  scored_at?: string;
}

export class TrajectoryRecorder {
  private db: MemoryManager;

  constructor(db: MemoryManager) {
    this.db = db;
  }

  async record(trajectory: Omit<Trajectory, 'id' | 'outcome' | 'score'>): Promise<number> {
    const database = this.db.getDatabase();

    database.run(
      `INSERT INTO trajectories (agent_id, workflow, story_key, state_context, action_taken)
       VALUES (?, ?, ?, ?, ?)`,
      [
        trajectory.agent_id,
        trajectory.workflow,
        trajectory.story_key || null,
        JSON.stringify(trajectory.state_context),
        JSON.stringify(trajectory.action_taken),
      ]
    );

    const result = database.exec('SELECT last_insert_rowid() as id');
    return result[0].values[0][0] as number;
  }

  async score(trajectoryId: number, outcome: Trajectory['outcome']): Promise<void> {
    if (!outcome) return;

    const reviews = Object.values(outcome.review_results);
    const passCount = reviews.filter(r => r === 'PASSED' || r === 'APPROVE').length;
    let computedScore = reviews.length > 0 ? passCount / reviews.length : 0;

    if (!outcome.rework_required) {
      computedScore = Math.min(1.0, computedScore + 0.1);
    }

    const database = this.db.getDatabase();
    database.run(
      `UPDATE trajectories SET outcome = ?, score = ?, scored_by = 'review-gates', score_details = ?, scored_at = datetime('now') WHERE id = ?`,
      [
        JSON.stringify(outcome),
        computedScore,
        JSON.stringify({
          pass_count: passCount,
          total_reviews: reviews.length,
          rework_bonus: !outcome.rework_required,
        }),
        trajectoryId,
      ]
    );
  }

  async getUnscored(storyKey: string): Promise<Trajectory[]> {
    const database = this.db.getDatabase();
    const result = database.exec(
      'SELECT * FROM trajectories WHERE story_key = ? AND score IS NULL',
      [storyKey]
    );
    if (!result.length) return [];
    return result[0].values.map(row => this.rowToTrajectory(result[0].columns, row));
  }

  async getAgentTrajectories(agentId: string, opts?: {
    workflow?: string;
    minScore?: number;
    limit?: number;
  }): Promise<Trajectory[]> {
    const database = this.db.getDatabase();
    const conditions: string[] = ['agent_id = ?'];
    const values: unknown[] = [agentId];

    if (opts?.workflow) { conditions.push('workflow = ?'); values.push(opts.workflow); }
    if (opts?.minScore !== undefined) { conditions.push('score >= ?'); values.push(opts.minScore); }

    const limit = opts?.limit || 50;
    values.push(limit);

    const sql = `SELECT * FROM trajectories WHERE ${conditions.join(' AND ')} AND score IS NOT NULL ORDER BY score DESC LIMIT ?`;
    const result = database.exec(sql, values);
    if (!result.length) return [];
    return result[0].values.map(row => this.rowToTrajectory(result[0].columns, row));
  }

  async getAllScored(opts?: { minScore?: number; limit?: number }): Promise<Trajectory[]> {
    const database = this.db.getDatabase();
    const conditions: string[] = ['score IS NOT NULL'];
    const values: unknown[] = [];

    if (opts?.minScore !== undefined) { conditions.push('score >= ?'); values.push(opts.minScore); }

    const limit = opts?.limit || 100;
    values.push(limit);

    const sql = `SELECT * FROM trajectories WHERE ${conditions.join(' AND ')} ORDER BY score DESC LIMIT ?`;
    const result = database.exec(sql, values);
    if (!result.length) return [];
    return result[0].values.map(row => this.rowToTrajectory(result[0].columns, row));
  }

  private rowToTrajectory(columns: string[], row: unknown[]): Trajectory {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });

    return {
      id: obj.id as number,
      agent_id: obj.agent_id as string,
      workflow: obj.workflow as string,
      story_key: obj.story_key as string | undefined,
      state_context: JSON.parse(obj.state_context as string),
      action_taken: JSON.parse(obj.action_taken as string),
      outcome: obj.outcome ? JSON.parse(obj.outcome as string) : undefined,
      score: obj.score as number | undefined,
      scored_by: obj.scored_by as string | undefined,
      created_at: obj.created_at as string,
      scored_at: obj.scored_at as string | undefined,
    };
  }
}
