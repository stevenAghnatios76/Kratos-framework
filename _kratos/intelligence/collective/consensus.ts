import { MemoryManager } from '../memory/memory-manager';

export interface Conflict {
  id?: number;
  agents: string[];
  topic: string;
  positions: {
    agent_id: string;
    position: string;
    reasoning: string;
    confidence: number;
  }[];
  resolution?: {
    resolved_by: 'authority-matrix' | 'human' | 'score';
    winner_agent: string;
    rationale: string;
    resolved_at: string;
  };
  created_at?: string;
}

export class ConsensusProtocol {
  private db: MemoryManager;

  private authorityMatrix: Record<string, string[]> = {
    'architecture': ['architect'],
    'security': ['security'],
    'testing': ['test-architect', 'qa'],
    'infrastructure': ['devops'],
    'requirements': ['pm'],
    'ux': ['ux-designer'],
    'sprint': ['sm'],
    'frontend': ['senior-frontend'],
    'backend': ['senior-backend'],
  };

  // Store conflicts in memory_entries with partition 'context'
  private conflicts = new Map<number, Conflict>();
  private nextConflictId = 1;

  constructor(db: MemoryManager) {
    this.db = db;
  }

  async registerConflict(conflict: Omit<Conflict, 'id' | 'resolution'>): Promise<number> {
    const id = this.nextConflictId++;
    const fullConflict: Conflict = {
      ...conflict,
      id,
      created_at: new Date().toISOString(),
    };
    this.conflicts.set(id, fullConflict);

    // Also persist in memory_entries for durability
    await this.db.store({
      partition: 'context',
      agent_id: 'system',
      access_level: 'global',
      title: `Conflict: ${conflict.topic}`,
      content: JSON.stringify(fullConflict),
      tags: ['conflict', ...conflict.agents],
      metadata: { conflict_id: id, status: 'unresolved' },
      score: 0.0,
      status: 'active',
      ttl_days: 30,
    });

    return id;
  }

  async autoResolve(conflictId: number): Promise<boolean> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return false;

    const domain = this.classifyDomain(conflict.topic);
    if (!domain) return false;

    const authorities = this.authorityMatrix[domain];
    if (!authorities) return false;

    // Check if any conflicting agent IS the authority
    const authorityAgent = conflict.positions.find(p =>
      authorities.includes(p.agent_id)
    );

    if (!authorityAgent) return false;

    conflict.resolution = {
      resolved_by: 'authority-matrix',
      winner_agent: authorityAgent.agent_id,
      rationale: `${authorityAgent.agent_id} has domain authority over "${domain}" per the authority matrix.`,
      resolved_at: new Date().toISOString(),
    };

    this.conflicts.set(conflictId, conflict);
    return true;
  }

  async formatForHumanResolution(conflictId: number): Promise<string> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return 'Conflict not found.';

    let output = `## Agent Disagreement — Needs Your Decision\n\n`;
    output += `**Topic:** ${conflict.topic}\n\n`;

    for (let i = 0; i < conflict.positions.length; i++) {
      const pos = conflict.positions[i];
      const label = String.fromCharCode(65 + i); // A, B, C, ...
      output += `### Position ${label} — ${pos.agent_id} (confidence: ${pos.confidence.toFixed(2)})\n`;
      output += `${pos.reasoning}\n\n`;
    }

    const domain = this.classifyDomain(conflict.topic);
    if (domain && this.authorityMatrix[domain]) {
      output += `**Authority matrix suggests:** ${this.authorityMatrix[domain].join(', ')} has domain authority over "${domain}"\n\n`;
    }

    output += `Which position do you prefer? [${conflict.positions.map((_, i) => String.fromCharCode(65 + i)).join('] [')}] [Other]\n`;

    return output;
  }

  async resolveByHuman(conflictId: number, winnerAgent: string, rationale: string): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return;

    conflict.resolution = {
      resolved_by: 'human',
      winner_agent: winnerAgent,
      rationale,
      resolved_at: new Date().toISOString(),
    };

    this.conflicts.set(conflictId, conflict);
  }

  async learnFromResolution(conflictId: number): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict || !conflict.resolution) return;

    const winnerPosition = conflict.positions.find(
      p => p.agent_id === conflict.resolution!.winner_agent
    );

    if (winnerPosition) {
      await this.db.storePattern(
        conflict.resolution.winner_agent,
        `Resolved: ${conflict.topic}`,
        `Position: ${winnerPosition.position}\nReasoning: ${winnerPosition.reasoning}\nResolution: ${conflict.resolution.rationale}`,
        0.9
      );
    }
  }

  private classifyDomain(topic: string): string | null {
    const lower = topic.toLowerCase();
    const domainKeywords: Record<string, string[]> = {
      'architecture': ['architecture', 'design', 'pattern', 'structure', 'component', 'module', 'system design'],
      'security': ['security', 'vulnerability', 'auth', 'encryption', 'owasp', 'threat', 'injection'],
      'testing': ['test', 'qa', 'quality', 'coverage', 'regression', 'e2e'],
      'infrastructure': ['infrastructure', 'deploy', 'ci/cd', 'pipeline', 'docker', 'kubernetes', 'cloud'],
      'requirements': ['requirement', 'feature', 'story', 'epic', 'prd', 'acceptance criteria'],
      'ux': ['ux', 'ui', 'design', 'accessibility', 'user experience', 'wireframe'],
      'sprint': ['sprint', 'velocity', 'capacity', 'backlog', 'standup', 'retro'],
      'frontend': ['frontend', 'react', 'css', 'html', 'component', 'client-side', 'browser'],
      'backend': ['backend', 'api', 'database', 'server', 'endpoint', 'service'],
    };

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some(kw => lower.includes(kw))) {
        return domain;
      }
    }

    return null;
  }
}
