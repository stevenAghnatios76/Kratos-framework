import * as fs from 'fs';
import * as path from 'path';
import { MemoryManager, MemoryEntry } from './memory-manager';

export class SidecarMigration {
  private manager: MemoryManager;
  private sidecarDir: string;

  constructor(memoryManager: MemoryManager, sidecarDir: string) {
    this.manager = memoryManager;
    this.sidecarDir = sidecarDir;
  }

  async discoverSidecars(): Promise<string[]> {
    if (!fs.existsSync(this.sidecarDir)) return [];

    const entries = fs.readdirSync(this.sidecarDir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && e.name.endsWith('-sidecar'))
      .map(e => e.name);
  }

  async parseSidecar(agentId: string, filePath: string): Promise<MemoryEntry[]> {
    if (!fs.existsSync(filePath)) return [];

    const content = fs.readFileSync(filePath, 'utf-8');
    const entries: MemoryEntry[] = [];
    const lines = content.split('\n');

    let currentTitle = '';
    let currentContent: string[] = [];
    let currentPartition: MemoryEntry['partition'] = 'decisions';

    const flush = () => {
      if (currentTitle && currentContent.length > 0) {
        entries.push({
          partition: currentPartition,
          agent_id: agentId,
          access_level: 'agent-private',
          title: currentTitle,
          content: currentContent.join('\n').trim(),
          tags: [],
          metadata: { migrated_from: filePath },
          score: 0.5,
          status: 'active',
          ttl_days: 90,
        });
      }
    };

    for (const line of lines) {
      const h2Match = line.match(/^##\s+(.+)/);
      const h3Match = line.match(/^###\s+(.+)/);

      if (h2Match || h3Match) {
        flush();
        currentTitle = (h2Match || h3Match)![1].trim();
        currentContent = [];
        currentPartition = this.classifyHeading(currentTitle);
      } else if (currentTitle) {
        currentContent.push(line);
      }
    }

    flush();
    return entries;
  }

  async migrate(): Promise<{
    agents_migrated: number;
    entries_imported: number;
    errors: string[];
  }> {
    const sidecars = await this.discoverSidecars();
    let agents_migrated = 0;
    let entries_imported = 0;
    const errors: string[] = [];

    for (const sidecarDir of sidecars) {
      const agentId = sidecarDir.replace('-sidecar', '');
      const sidecarPath = path.join(this.sidecarDir, sidecarDir);

      try {
        const files = fs.readdirSync(sidecarPath).filter(f => f.endsWith('.md'));

        if (files.length === 0) continue;

        let agentHadEntries = false;

        for (const file of files) {
          const filePath = path.join(sidecarPath, file);
          const entries = await this.parseSidecar(agentId, filePath);

          for (const entry of entries) {
            try {
              await this.manager.store(entry);
              entries_imported++;
              agentHadEntries = true;
            } catch (err) {
              errors.push(`Failed to store entry "${entry.title}" for ${agentId}: ${err}`);
            }
          }
        }

        if (agentHadEntries) agents_migrated++;
      } catch (err) {
        errors.push(`Failed to process sidecar for ${agentId}: ${err}`);
      }
    }

    return { agents_migrated, entries_imported, errors };
  }

  private classifyHeading(heading: string): MemoryEntry['partition'] {
    const lower = heading.toLowerCase();
    if (lower.includes('decision:') || lower.includes('decided')) return 'decisions';
    if (lower.includes('pattern:')) return 'patterns';
    if (lower.includes('anti-pattern:') || lower.includes('antipattern')) return 'anti-patterns';
    if (lower.includes('fact:') || lower.includes('finding:')) return 'facts';
    if (lower.includes('context:')) return 'context';
    return 'decisions';
  }
}
