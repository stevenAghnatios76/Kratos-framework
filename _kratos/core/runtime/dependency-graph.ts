import * as fs from 'fs';
import * as yaml from 'yaml';

export interface StoryNode {
  story_key: string;
  status: string;
  depends_on: string[];
  blocks: string[];
  files_touched: string[];
  assigned_agent?: string;
}

export interface ExecutionPlan {
  waves: StoryNode[][];
  total_stories: number;
  parallelizable: number;
  sequential: number;
  blocked: string[];
}

export class DependencyGraph {
  private nodes: Map<string, StoryNode> = new Map();

  async buildFromSprint(sprintStatusPath: string): Promise<void> {
    if (!fs.existsSync(sprintStatusPath)) {
      throw new Error(`Sprint status file not found: ${sprintStatusPath}`);
    }

    const content = fs.readFileSync(sprintStatusPath, 'utf-8');
    const data = yaml.parse(content);

    if (!data?.stories) return;

    for (const story of data.stories) {
      this.addNode({
        story_key: story.story_key || story.key,
        status: story.status || 'backlog',
        depends_on: story.depends_on || [],
        blocks: story.blocks || [],
        files_touched: story.files_touched || [],
        assigned_agent: story.assigned_agent || story.agent,
      });
    }

    // Build reverse blocks references
    for (const [key, node] of this.nodes) {
      for (const dep of node.depends_on) {
        const depNode = this.nodes.get(dep);
        if (depNode && !depNode.blocks.includes(key)) {
          depNode.blocks.push(key);
        }
      }
    }
  }

  addNode(node: StoryNode): void {
    this.nodes.set(node.story_key, node);
  }

  getReady(): StoryNode[] {
    return [...this.nodes.values()].filter(node => {
      if (node.status !== 'ready-for-dev') return false;
      return node.depends_on.every(dep => {
        const depNode = this.nodes.get(dep);
        return depNode && depNode.status === 'done';
      });
    });
  }

  getBlocked(): StoryNode[] {
    return [...this.nodes.values()].filter(node => {
      if (node.status === 'done') return false;
      return node.depends_on.some(dep => {
        const depNode = this.nodes.get(dep);
        return !depNode || depNode.status !== 'done';
      });
    });
  }

  generatePlan(): ExecutionPlan {
    const remaining = new Map(this.nodes);
    const completed = new Set<string>();
    const waves: StoryNode[][] = [];
    const blocked: string[] = [];

    // Pre-populate completed stories
    for (const [key, node] of remaining) {
      if (node.status === 'done') {
        completed.add(key);
        remaining.delete(key);
      }
    }

    let maxIterations = remaining.size + 1;
    while (remaining.size > 0 && maxIterations > 0) {
      maxIterations--;

      const wave: StoryNode[] = [];
      for (const [key, node] of remaining) {
        const depsResolved = node.depends_on.every(dep => completed.has(dep));
        if (depsResolved) {
          wave.push(node);
        }
      }

      if (wave.length === 0) {
        // All remaining have unmet deps — circular or blocked
        for (const [key] of remaining) {
          blocked.push(key);
        }
        break;
      }

      waves.push(wave);
      for (const node of wave) {
        completed.add(node.story_key);
        remaining.delete(node.story_key);
      }
    }

    const parallelizable = waves.filter(w => w.length > 1).reduce((sum, w) => sum + w.length, 0);
    const sequential = waves.filter(w => w.length === 1).length;

    return {
      waves,
      total_stories: this.nodes.size,
      parallelizable,
      sequential,
      blocked,
    };
  }

  canRunInParallel(storyA: string, storyB: string): boolean {
    const nodeA = this.nodes.get(storyA);
    const nodeB = this.nodes.get(storyB);
    if (!nodeA || !nodeB) return false;

    // Check dependency relationship
    if (nodeA.depends_on.includes(storyB) || nodeB.depends_on.includes(storyA)) {
      return false;
    }

    // Check file conflicts
    const filesA = new Set(nodeA.files_touched);
    return !nodeB.files_touched.some(f => filesA.has(f));
  }

  markComplete(storyKey: string): string[] {
    const node = this.nodes.get(storyKey);
    if (!node) return [];

    node.status = 'done';
    const unblocked: string[] = [];

    for (const blockedKey of node.blocks) {
      const blockedNode = this.nodes.get(blockedKey);
      if (!blockedNode) continue;

      const allDepsComplete = blockedNode.depends_on.every(dep => {
        const depNode = this.nodes.get(dep);
        return depNode && depNode.status === 'done';
      });

      if (allDepsComplete) {
        unblocked.push(blockedKey);
      }
    }

    return unblocked;
  }

  toText(): string {
    const plan = this.generatePlan();
    const lines: string[] = [];

    for (let i = 0; i < plan.waves.length; i++) {
      const wave = plan.waves[i];
      const mode = wave.length > 1 ? 'parallel' : 'sequential';
      const stories = wave.map(n => n.story_key).join(', ');
      lines.push(`Wave ${i + 1} (${mode}): ${stories}`);
    }

    if (plan.blocked.length > 0) {
      lines.push(`Blocked: ${plan.blocked.join(', ')}`);
    }

    lines.push('');
    lines.push(`Total: ${plan.total_stories} stories | Parallelizable: ${plan.parallelizable} | Sequential: ${plan.sequential} | Blocked: ${plan.blocked.length}`);

    return lines.join('\n');
  }
}
