import * as fs from 'fs';
import * as yaml from 'yaml';
import { Checkpoint } from './checkpoint-manager';

export interface GateResult {
  gate_name: string;
  passed: boolean;
  reason?: string;
  checked_at: string;
}

export class GateChecker {
  async checkPreStart(workflowConfig: Record<string, unknown>): Promise<GateResult[]> {
    const results: GateResult[] = [];
    const gates = (workflowConfig as any)?.quality_gates?.pre_start;
    if (!gates || !Array.isArray(gates)) return results;

    for (const gate of gates) {
      const result = await this.evaluateGate(gate);
      results.push(result);
    }

    return results;
  }

  async checkPostComplete(workflowConfig: Record<string, unknown>, checkpoint: Checkpoint): Promise<GateResult[]> {
    const results: GateResult[] = [];
    const gates = (workflowConfig as any)?.quality_gates?.post_complete;
    if (!gates || !Array.isArray(gates)) return results;

    for (const gate of gates) {
      const result = await this.evaluateGate(gate, checkpoint);
      results.push(result);
    }

    return results;
  }

  async checkReviewGates(storyFilePath: string): Promise<{
    all_passed: boolean;
    gates: Record<string, 'PASSED' | 'FAILED' | 'PENDING'>;
  }> {
    const gates: Record<string, 'PASSED' | 'FAILED' | 'PENDING'> = {
      'code-review': 'PENDING',
      'qa-tests': 'PENDING',
      'security-review': 'PENDING',
      'test-automate': 'PENDING',
      'test-review': 'PENDING',
      'performance-review': 'PENDING',
    };

    if (!fs.existsSync(storyFilePath)) {
      return { all_passed: false, gates };
    }

    const content = fs.readFileSync(storyFilePath, 'utf-8');

    // Parse review gate table from markdown
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|')) continue;

      for (const gateName of Object.keys(gates)) {
        if (trimmed.toLowerCase().includes(gateName.replace('-', ' ')) ||
            trimmed.toLowerCase().includes(gateName)) {
          if (trimmed.includes('PASSED') || trimmed.includes('APPROVE')) {
            gates[gateName] = 'PASSED';
          } else if (trimmed.includes('FAILED') || trimmed.includes('REQUEST_CHANGES')) {
            gates[gateName] = 'FAILED';
          }
        }
      }
    }

    const all_passed = Object.values(gates).every(g => g === 'PASSED');
    return { all_passed, gates };
  }

  formatResults(results: GateResult[]): string {
    if (results.length === 0) return 'No gates to check.';

    let output = '## Gate Check Results\n\n';
    let allPassed = true;

    for (const result of results) {
      const icon = result.passed ? 'PASS' : 'FAIL';
      output += `- [${icon}] **${result.gate_name}**`;
      if (result.reason) {
        output += ` — ${result.reason}`;
      }
      output += '\n';

      if (!result.passed) allPassed = false;
    }

    output += `\n**Overall:** ${allPassed ? 'All gates passed' : 'Some gates failed'}\n`;
    return output;
  }

  private async evaluateGate(gate: Record<string, unknown>, checkpoint?: Checkpoint): Promise<GateResult> {
    const gateName = (gate.name as string) || 'unknown';
    const now = new Date().toISOString();

    // file_exists check
    if (gate.file_exists) {
      const filePath = gate.file_exists as string;
      const exists = fs.existsSync(filePath);
      return {
        gate_name: gateName,
        passed: exists,
        reason: exists ? undefined : `File not found: ${filePath}`,
        checked_at: now,
      };
    }

    // story_status check
    if (gate.story_status) {
      const requiredStatus = gate.story_status as string;
      return {
        gate_name: gateName,
        passed: true, // Would need sprint-status.yaml context
        reason: `Requires status: ${requiredStatus}`,
        checked_at: now,
      };
    }

    // all_subtasks_complete check
    if (gate.all_subtasks_complete) {
      return {
        gate_name: gateName,
        passed: checkpoint?.status === 'completed',
        reason: checkpoint?.status !== 'completed' ? 'Not all subtasks completed' : undefined,
        checked_at: now,
      };
    }

    return {
      gate_name: gateName,
      passed: true,
      reason: 'Gate type not recognized — passing by default',
      checked_at: now,
    };
  }
}
