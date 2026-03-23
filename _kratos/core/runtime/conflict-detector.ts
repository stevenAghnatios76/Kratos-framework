import { WorkerResult } from './worker';
import { StoryNode } from './dependency-graph';

export interface FileConflict {
  file_path: string;
  stories: string[];
  type: 'concurrent-edit' | 'delete-edit' | 'create-create';
  severity: 'critical' | 'warning';
}

export class ConflictDetector {
  async detect(results: WorkerResult[]): Promise<FileConflict[]> {
    const fileMap = new Map<string, string[]>();

    for (const result of results) {
      if (result.status !== 'completed') continue;
      for (const file of result.files_modified) {
        if (!fileMap.has(file)) fileMap.set(file, []);
        fileMap.get(file)!.push(result.story_key);
      }
    }

    const conflicts: FileConflict[] = [];

    for (const [filePath, stories] of fileMap) {
      if (stories.length < 2) continue;

      conflicts.push({
        file_path: filePath,
        stories,
        type: 'concurrent-edit',
        severity: 'critical',
      });
    }

    return conflicts.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (a.severity !== 'critical' && b.severity === 'critical') return 1;
      return 0;
    });
  }

  async estimateConflicts(stories: StoryNode[]): Promise<FileConflict[]> {
    const fileMap = new Map<string, string[]>();

    for (const story of stories) {
      for (const file of story.files_touched) {
        if (!fileMap.has(file)) fileMap.set(file, []);
        fileMap.get(file)!.push(story.story_key);
      }
    }

    const conflicts: FileConflict[] = [];

    for (const [filePath, storyKeys] of fileMap) {
      if (storyKeys.length < 2) continue;

      conflicts.push({
        file_path: filePath,
        stories: storyKeys,
        type: 'concurrent-edit',
        severity: 'warning',
      });
    }

    return conflicts;
  }

  formatForReview(conflicts: FileConflict[]): string {
    if (conflicts.length === 0) return 'No file conflicts detected.';

    let output = '## File Conflicts Detected\n\n';

    const critical = conflicts.filter(c => c.severity === 'critical');
    const warnings = conflicts.filter(c => c.severity === 'warning');

    for (const conflict of critical) {
      output += `### CRITICAL: ${conflict.file_path}\n`;
      for (const story of conflict.stories) {
        output += `- ${story} modified this file\n`;
      }
      output += `→ These changes may conflict. Please review and merge manually.\n\n`;
    }

    for (const conflict of warnings) {
      output += `### WARNING: ${conflict.file_path}\n`;
      for (const story of conflict.stories) {
        output += `- ${story} touches this file\n`;
      }
      output += `→ Potential conflict — verify before parallel execution.\n\n`;
    }

    output += `**Summary:** ${critical.length} critical, ${warnings.length} warnings across ${conflicts.length} files\n`;

    return output;
  }
}
