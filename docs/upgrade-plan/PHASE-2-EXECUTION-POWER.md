# Phase 2: Execution Power — The Muscle

**Version target:** 2.1.0 "Briareus"
**Depends on:** Phase 1 (memory database must exist)
**Upgrades:** 4 (Parallel Execution), 5 (TypeScript CLI), 6 (Lifecycle Hooks)

---

## Pre-Phase Checklist

Before starting, verify:

- [ ] Phase 1 completed (checkpoint exists at `_kratos/_memory/checkpoints/upgrade-phase-1.yaml`)
- [ ] `_kratos/intelligence/` directory exists with memory, learning, collective modules
- [ ] `sql.js` is installed (`node -e "require('sql.js')"`)
- [ ] `_kratos/_memory/memory.db` exists (or will be created on first run)

---

## Upgrade 4: Parallel Execution Engine

### Context

**Current state:** Kratos runs all workflows step-by-step, sequentially. A 10-story sprint takes 10x as long as it should. The 6-gate review process runs sequentially via `/kratos-run-all-reviews`. The workflow engine XML even lists `parallel` as a "deferred-v2" tag.

**What we're building:** A dependency-aware parallel execution engine that can run independent stories concurrently, run all 6 reviews in parallel, detect file conflicts between workers, and coordinate via heartbeat monitoring.

**Key constraint:** The parallel executor runs AROUND the existing workflow engine, not inside it. Each worker still executes workflows sequentially (the XML engine is unchanged). The parallelism is at the story/review level.

### Architecture

```
_kratos/core/runtime/
├── parallel-executor.ts      # Dependency graph + worker pool + coordination
├── dependency-graph.ts       # Build DAG from sprint-status.yaml
├── worker.ts                 # Individual worker (runs one workflow)
├── conflict-detector.ts      # Detect file conflicts between parallel workers
├── heartbeat.ts              # Monitor worker health
└── index.ts                  # Public API exports
```

### Step 4.1: Implement the Dependency Graph

**File:** `_kratos/core/runtime/dependency-graph.ts`

```typescript
interface StoryNode {
  story_key: string;
  status: string;               // From sprint state machine
  depends_on: string[];         // Story keys this depends on
  blocks: string[];             // Story keys blocked by this
  files_touched: string[];      // Files this story modifies (from checkpoint)
  assigned_agent?: string;
}

interface ExecutionPlan {
  waves: StoryNode[][];          // Groups of stories that can run in parallel
  total_stories: number;
  parallelizable: number;        // Stories that CAN run in parallel
  sequential: number;            // Stories that MUST be sequential
  blocked: string[];             // Stories blocked by incomplete dependencies
}

class DependencyGraph {
  private nodes: Map<string, StoryNode> = new Map();

  // Build graph from sprint-status.yaml
  async buildFromSprint(sprintStatusPath: string): Promise<void>
  // Parse YAML, extract stories with their depends_on fields
  // For each story: create a StoryNode

  // Add a node manually
  addNode(node: StoryNode): void

  // Get stories ready to execute (no unmet dependencies, status = ready-for-dev)
  getReady(): StoryNode[]

  // Get stories blocked by incomplete dependencies
  getBlocked(): StoryNode[]

  // Generate execution plan (topological sort into parallel waves)
  generatePlan(): ExecutionPlan
  // Algorithm:
  //   1. Find all stories with NO unmet dependencies → Wave 1
  //   2. Remove Wave 1 from graph
  //   3. Find newly unblocked stories → Wave 2
  //   4. Repeat until all stories assigned to a wave
  //   5. Stories with circular deps → flag as error

  // Check if two stories can safely run in parallel (no file conflicts)
  canRunInParallel(storyA: string, storyB: string): boolean
  // Compare files_touched arrays — if any overlap, return false

  // Mark a story as completed and update the graph
  markComplete(storyKey: string): string[]  // Returns newly unblocked story keys

  // Visualize the graph as text
  toText(): string
  // Output:
  //   Wave 1 (parallel): E1-S1, E1-S2, E2-S1
  //   Wave 2 (parallel): E1-S3, E2-S2
  //   Wave 3 (sequential): E2-S3 (depends on E2-S2)
  //   Blocked: E3-S1 (missing: E2-S3)
}
```

### Step 4.2: Implement the Worker

**File:** `_kratos/core/runtime/worker.ts`

```typescript
interface WorkerConfig {
  id: string;                    // Worker ID (e.g., "worker-1")
  story_key: string;             // Story to execute
  workflow: string;              // Workflow command (e.g., "/kratos-dev-story")
  mode: 'normal' | 'yolo';      // Execution mode
  timeout_sec: number;           // Max execution time
}

interface WorkerResult {
  worker_id: string;
  story_key: string;
  status: 'completed' | 'failed' | 'timeout' | 'conflict';
  files_modified: string[];
  duration_sec: number;
  error?: string;
  checkpoint_path?: string;
}

type WorkerState = 'idle' | 'running' | 'completed' | 'failed' | 'stalled';

class Worker {
  readonly id: string;
  state: WorkerState = 'idle';
  lastHeartbeat: Date;

  constructor(config: WorkerConfig)

  // Start executing the workflow
  // Implementation: spawns a Claude Code subagent process
  async execute(): Promise<WorkerResult>

  // Send heartbeat
  heartbeat(): void

  // Check if worker is stalled (no heartbeat for > timeout)
  isStalled(timeoutSec: number): boolean

  // Abort the worker
  async abort(): Promise<void>

  // Get current status
  getStatus(): { state: WorkerState; elapsed_sec: number; story_key: string }
}
```

### Step 4.3: Implement the Parallel Executor

**File:** `_kratos/core/runtime/parallel-executor.ts`

```typescript
interface ParallelExecutorConfig {
  max_concurrent: number;        // Default: 6
  mode: 'auto' | 'sequential' | 'parallel';
  conflict_detection: boolean;   // Default: true
  heartbeat_interval_sec: number; // Default: 60
  stall_timeout_sec: number;     // Default: 300
  execution_mode: 'normal' | 'yolo';
}

interface SprintExecutionReport {
  sprint_id: string;
  total_stories: number;
  completed: number;
  failed: number;
  skipped: number;
  conflicts_detected: number;
  total_duration_sec: number;
  wave_results: {
    wave: number;
    stories: WorkerResult[];
    duration_sec: number;
  }[];
}

class ParallelExecutor {
  private workers: Map<string, Worker> = new Map();
  private graph: DependencyGraph;
  private config: ParallelExecutorConfig;

  constructor(config: ParallelExecutorConfig)

  // Execute all ready stories in a sprint
  async executeSprint(sprintStatusPath: string): Promise<SprintExecutionReport>
  // Algorithm:
  //   1. Build dependency graph from sprint-status.yaml
  //   2. Generate execution plan (waves)
  //   3. For each wave:
  //      a. Spawn workers for all stories in the wave (up to max_concurrent)
  //      b. Monitor heartbeats
  //      c. Wait for all workers to complete or timeout
  //      d. Collect results
  //      e. Check for file conflicts between completed workers
  //      f. Update dependency graph (mark completed stories)
  //      g. If conflicts detected: flag and pause for human review
  //   4. Generate execution report

  // Execute all 6 reviews for a story in parallel
  async executeReviewsParallel(storyKey: string): Promise<{
    results: Record<string, 'PASSED' | 'FAILED'>;
    all_passed: boolean;
    duration_sec: number;
  }>
  // Spawns 6 workers simultaneously:
  //   - /kratos-code-review
  //   - /kratos-qa-tests
  //   - /kratos-security-review
  //   - /kratos-test-automate
  //   - /kratos-test-review
  //   - /kratos-performance-review
  // Waits for all to complete. Aggregates results.

  // Monitor running workers
  async monitorWorkers(): Promise<void>
  // Runs on heartbeat_interval_sec
  // Detects stalled workers, reports status

  // Get current execution status
  getStatus(): {
    running_workers: number;
    completed: number;
    failed: number;
    queue_size: number;
  }

  // Stop all workers
  async stopAll(): Promise<void>
}
```

### Step 4.4: Implement the Conflict Detector

**File:** `_kratos/core/runtime/conflict-detector.ts`

```typescript
interface FileConflict {
  file_path: string;
  stories: string[];             // Story keys that touched this file
  type: 'concurrent-edit' | 'delete-edit' | 'create-create';
  severity: 'critical' | 'warning';
}

class ConflictDetector {
  // Check for conflicts between parallel worker results
  async detect(results: WorkerResult[]): Promise<FileConflict[]>
  // Algorithm:
  //   1. Collect all files_modified from each result
  //   2. Find files that appear in 2+ results
  //   3. For each overlap:
  //      - concurrent-edit: both modified same file → critical
  //      - delete-edit: one deleted, other edited → critical
  //      - create-create: both created same file → warning
  //   4. Return conflicts sorted by severity

  // Pre-check: estimate potential conflicts before execution
  async estimateConflicts(stories: StoryNode[]): Promise<FileConflict[]>
  // Uses files_touched from previous checkpoints to predict

  // Format conflicts for human review
  formatForReview(conflicts: FileConflict[]): string
  // Output:
  //   ## File Conflicts Detected
  //
  //   ### CRITICAL: src/auth/login.ts
  //   - E1-S2 modified lines 45-67 (added JWT validation)
  //   - E2-S1 modified lines 50-60 (added rate limiting)
  //   → These changes may conflict. Please review and merge manually.
  //
  //   ### WARNING: src/models/user.ts
  //   - E1-S3 created this file
  //   - E2-S2 also created this file
  //   → One version must be chosen.
}
```

### Step 4.5: Implement the Heartbeat Monitor

**File:** `_kratos/core/runtime/heartbeat.ts`

```typescript
class HeartbeatMonitor {
  private workers: Map<string, Worker>;
  private intervalId?: NodeJS.Timeout;

  constructor(workers: Map<string, Worker>, intervalSec: number)

  // Start monitoring
  start(): void

  // Stop monitoring
  stop(): void

  // Check all workers
  check(): {
    healthy: string[];           // Worker IDs
    stalled: string[];           // Worker IDs with no recent heartbeat
    completed: string[];
    failed: string[];
  }

  // Handle a stalled worker
  async handleStalled(workerId: string): Promise<void>
  // 1. Log warning
  // 2. Wait one more interval
  // 3. If still stalled: abort worker, mark as failed
}
```

### Step 4.6: Update global.yaml

```yaml
execution:
  parallel:
    enabled: true
    max_concurrent: 6
    mode: "auto"
    conflict_detection: true
    heartbeat_interval_sec: 60
    stall_timeout_sec: 300
```

### Verification — Upgrade 4

- [ ] Dependency graph correctly parses sprint-status.yaml
- [ ] Execution plan groups independent stories into parallel waves
- [ ] Dependent stories are correctly ordered
- [ ] Worker can spawn and track a subprocess
- [ ] Heartbeat detects stalled workers
- [ ] Conflict detector finds overlapping file modifications
- [ ] Parallel review execution runs all 6 reviews simultaneously
- [ ] Sprint execution report is generated correctly
- [ ] `global.yaml` has the execution.parallel section

### Files Created — Upgrade 4

| File | Action |
|------|--------|
| `_kratos/core/runtime/parallel-executor.ts` | Created |
| `_kratos/core/runtime/dependency-graph.ts` | Created |
| `_kratos/core/runtime/worker.ts` | Created |
| `_kratos/core/runtime/conflict-detector.ts` | Created |
| `_kratos/core/runtime/heartbeat.ts` | Created |
| `_kratos/core/runtime/index.ts` | Created |
| `_kratos/_config/global.yaml` | Modified |

---

## Upgrade 5: TypeScript CLI

### Context

**Current state:** Kratos has no executable code. Everything depends on Claude Code interpreting XML/YAML at runtime. The only code is `bin/kratos-install.sh` (installer) and `dashboard/server.js` (web UI). There is no programmatic way to manage memory, run workflows, check status, or invoke the intelligence layer.

**What we're building:** A `kratos` CLI that wraps the existing framework with programmatic control. The CLI does NOT replace the workflow engine — it adds management capabilities around it.

### Architecture

```
_kratos/core/runtime/
├── cli.ts                    # CLI entry point (commander.js)
├── workflow-runner.ts        # Programmatic workflow invocation
├── checkpoint-manager.ts     # Read/write/validate checkpoints
├── gate-checker.ts           # Quality gate verification
└── ... (parallel files from Upgrade 4)

bin/
├── kratos-install.sh         # EXISTING
└── kratos                    # NEW: CLI entry point (symlink to compiled output)
```

### Step 5.1: Install CLI dependencies

```bash
cd /path/to/Kratos-framework
npm install commander chalk ora yaml
npm install -D typescript @types/node
```

### Step 5.2: Create TypeScript config

**File:** `tsconfig.json` (project root)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["_kratos/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 5.3: Implement the CLI

**File:** `_kratos/core/runtime/cli.ts`

```typescript
#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('kratos')
  .description('Kratos Framework CLI — AI-powered product development')
  .version('2.1.0');

// ============================================================
// MEMORY COMMANDS
// ============================================================
const memory = program.command('memory').description('Manage agent memory');

memory
  .command('search <query>')
  .description('Semantic search across all agent memory')
  .option('-a, --agent <id>', 'Filter by agent ID')
  .option('-p, --partition <name>', 'Filter by partition')
  .option('-l, --limit <n>', 'Max results', '10')
  .action(async (query, opts) => {
    // Implementation:
    // 1. Initialize MemoryManager
    // 2. Call search(query, { agent_id: opts.agent, partition: opts.partition, limit: opts.limit })
    // 3. Format and display results
  });

memory
  .command('stats')
  .description('Show memory statistics')
  .action(async () => {
    // Implementation:
    // 1. Initialize MemoryManager
    // 2. Call getStats()
    // 3. Display: total entries, by partition, by agent, stale count
  });

memory
  .command('export')
  .description('Export memory to markdown sidecars')
  .option('-a, --agent <id>', 'Export specific agent only')
  .option('-o, --output <dir>', 'Output directory', '_kratos/_memory')
  .action(async (opts) => {
    // Implementation:
    // 1. Initialize MemoryManager
    // 2. Call exportAllSidecars() or exportAgentSidecar()
    // 3. Write markdown files to output dir
  });

memory
  .command('migrate')
  .description('Import existing markdown sidecars into database')
  .action(async () => {
    // Implementation:
    // 1. Initialize MemoryManager + SidecarMigration
    // 2. Run migration
    // 3. Display results
  });

memory
  .command('expire')
  .description('Remove expired entries')
  .action(async () => {
    // Implementation: call expireStaleEntries() + evictLRU()
  });

// ============================================================
// LEARN COMMANDS
// ============================================================
const learn = program.command('learn').description('Self-learning system');

learn
  .command('distill')
  .description('Extract patterns from scored trajectories')
  .option('-a, --agent <id>', 'Distill for specific agent')
  .action(async (opts) => {
    // Implementation:
    // 1. Initialize PatternDistiller
    // 2. Run distillation cycle
    // 3. Display created patterns and anti-patterns
  });

learn
  .command('patterns')
  .description('List learned patterns')
  .option('-a, --agent <id>', 'Filter by agent')
  .option('--anti', 'Show anti-patterns instead')
  .action(async (opts) => {
    // Implementation: query memory_entries where partition = 'patterns' or 'anti-patterns'
  });

learn
  .command('report')
  .description('Show learning trends per agent')
  .action(async () => {
    // Implementation:
    // 1. Query trajectories, group by agent_id
    // 2. Calculate avg score per agent over time
    // 3. Show improvement trend
  });

learn
  .command('protect')
  .description('Run forgetting shield protection cycle')
  .action(async () => {
    // Implementation: call ForgettingShield.runProtectionCycle()
  });

// ============================================================
// SPRINT COMMANDS
// ============================================================
const sprint = program.command('sprint').description('Sprint execution');

sprint
  .command('plan')
  .description('Generate parallel execution plan for current sprint')
  .option('-s, --status <path>', 'Sprint status file path')
  .action(async (opts) => {
    // Implementation:
    // 1. Build DependencyGraph from sprint-status.yaml
    // 2. Generate execution plan
    // 3. Display waves with parallelization info
  });

sprint
  .command('run')
  .description('Execute sprint stories')
  .option('--parallel', 'Run independent stories in parallel')
  .option('--max <n>', 'Max concurrent workers', '6')
  .option('--mode <m>', 'Execution mode: normal | yolo', 'yolo')
  .action(async (opts) => {
    // Implementation:
    // 1. Build execution plan
    // 2. Confirm with user
    // 3. Execute via ParallelExecutor
    // 4. Display execution report
  });

sprint
  .command('reviews <story_key>')
  .description('Run all 6 review gates in parallel for a story')
  .action(async (storyKey) => {
    // Implementation: call ParallelExecutor.executeReviewsParallel(storyKey)
  });

// ============================================================
// STATUS COMMANDS
// ============================================================
program
  .command('status')
  .description('Show current sprint status + agent health')
  .action(async () => {
    // Implementation:
    // 1. Read sprint-status.yaml
    // 2. Display story statuses
    // 3. Show any running workers
    // 4. Show memory stats summary
  });

// ============================================================
// DOCTOR COMMAND
// ============================================================
program
  .command('doctor')
  .description('System health check')
  .action(async () => {
    // Checks:
    // 1. Node.js version >= 18
    // 2. _kratos/ directory exists
    // 3. global.yaml is valid
    // 4. memory.db is accessible
    // 5. All agent files exist
    // 6. All workflow files exist
    // 7. No orphaned checkpoints
    // 8. Dependencies installed
  });

// ============================================================
// DASHBOARD COMMAND
// ============================================================
program
  .command('dashboard')
  .description('Launch web dashboard')
  .option('-p, --port <n>', 'Port number', '3456')
  .action(async (opts) => {
    // Implementation: spawn dashboard/server.js with port option
  });

program.parse();
```

### Step 5.4: Implement the Checkpoint Manager

**File:** `_kratos/core/runtime/checkpoint-manager.ts`

```typescript
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import yaml from 'yaml';

interface Checkpoint {
  workflow: string;
  step: number;
  total_steps: number;
  variables: Record<string, string>;
  output_path?: string;
  files_touched: {
    path: string;
    checksum: string;          // sha256:{hex}
    last_modified: string;     // ISO 8601
  }[];
  created_at: string;
  status: 'active' | 'completed';
}

class CheckpointManager {
  constructor(private checkpointDir: string)

  // Write a checkpoint
  async write(checkpoint: Checkpoint): Promise<string>  // Returns checkpoint file path
  // File name: {workflow}-step-{n}-{timestamp}.yaml
  // Computes SHA256 for each file in files_touched

  // Read the latest checkpoint for a workflow
  async getLatest(workflow: string): Promise<Checkpoint | null>
  // Scan checkpoint dir, find most recent for this workflow

  // Validate checkpoint integrity (verify SHA256 checksums)
  async validate(checkpoint: Checkpoint): Promise<{
    valid: boolean;
    changed_files: string[];
    missing_files: string[];
  }>
  // For each file in files_touched:
  //   1. Check file exists
  //   2. Compute current SHA256
  //   3. Compare with stored checksum

  // Archive a completed checkpoint
  async archive(checkpointPath: string): Promise<void>
  // Move to checkpoints/completed/

  // List all active checkpoints
  async listActive(): Promise<Checkpoint[]>

  // Clean up old completed checkpoints (older than 30 days)
  async cleanup(maxAgeDays: number): Promise<number>
}
```

### Step 5.5: Implement the Gate Checker

**File:** `_kratos/core/runtime/gate-checker.ts`

```typescript
interface GateResult {
  gate_name: string;
  passed: boolean;
  reason?: string;              // Why it failed
  checked_at: string;
}

class GateChecker {
  // Check pre-start gates for a workflow
  async checkPreStart(workflowConfig: any): Promise<GateResult[]>
  // Reads quality_gates.pre_start from workflow.yaml
  // For each gate condition:
  //   - "file_exists: {path}" → check file exists
  //   - "story_status: ready-for-dev" → check sprint-status.yaml
  //   - "depends_on_complete: {story_key}" → check dependency status

  // Check post-complete gates for a workflow
  async checkPostComplete(workflowConfig: any, checkpoint: Checkpoint): Promise<GateResult[]>
  // Reads quality_gates.post_complete from workflow.yaml
  // For each gate condition:
  //   - "all_tests_pass" → run test command, check exit code
  //   - "all_subtasks_complete" → check story file
  //   - "dod_items_checked" → check story file DoD section

  // Check review gates for a story
  async checkReviewGates(storyFilePath: string): Promise<{
    all_passed: boolean;
    gates: Record<string, 'PASSED' | 'FAILED' | 'PENDING'>;
  }>
  // Parse story file for Review Gate table
  // Check each of the 6 review results

  // Format gate results for display
  formatResults(results: GateResult[]): string
}
```

### Step 5.6: Update package.json

Add to package.json:

```json
{
  "bin": {
    "kratos": "./dist/_kratos/core/runtime/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "kratos": "node dist/_kratos/core/runtime/cli.js"
  }
}
```

### Verification — Upgrade 5

- [ ] `npm run build` compiles TypeScript without errors
- [ ] `npx kratos --version` outputs 2.1.0
- [ ] `npx kratos doctor` runs all health checks
- [ ] `npx kratos memory stats` shows memory statistics
- [ ] `npx kratos memory search "architecture"` returns results
- [ ] `npx kratos memory migrate` imports existing sidecars
- [ ] `npx kratos learn patterns` lists learned patterns
- [ ] `npx kratos sprint plan` generates parallel execution plan
- [ ] `npx kratos status` shows sprint status
- [ ] `npx kratos dashboard` launches web UI

### Files Created — Upgrade 5

| File | Action |
|------|--------|
| `_kratos/core/runtime/cli.ts` | Created |
| `_kratos/core/runtime/checkpoint-manager.ts` | Created |
| `_kratos/core/runtime/gate-checker.ts` | Created |
| `tsconfig.json` | Created |
| `package.json` | Modified (added bin, scripts, dependencies) |

---

## Upgrade 6: Lifecycle Hook System

### Context

**Current state:** To add behavior to Kratos, you must modify workflow YAML or agent markdown. There's no way to inject custom logic at key lifecycle points (pre-commit, post-review, on-error) without forking framework files.

**What we're building:** A hook system where users define shell commands that execute at specific lifecycle points. Hooks are configured in `_kratos/_config/hooks.yaml` and executed by the workflow engine at the appropriate times.

### Architecture

```
_kratos/core/runtime/
├── hook-executor.ts          # Load hooks config, execute at lifecycle points
└── ... (other runtime files)

_kratos/_config/
├── hooks.yaml                # Hook definitions
└── ... (other config files)
```

### Step 6.1: Create the hooks configuration

**File:** `_kratos/_config/hooks.yaml`

```yaml
# Kratos Lifecycle Hooks Configuration
# Hooks execute shell commands at specific lifecycle points.
# Each hook can halt the workflow on failure or just warn.
#
# Hook points:
#   pre-workflow    — Before any workflow starts
#   post-step       — After each workflow step completes
#   pre-gate        — Before a quality gate check
#   post-gate       — After a quality gate passes or fails
#   pre-commit      — Before a git commit
#   post-review     — After a review gate completes
#   on-error        — When any workflow step fails
#   on-resume       — When checkpoint recovery triggers
#   post-learning   — After a trajectory is scored
#
# Hook properties:
#   command   — Shell command to execute
#   on_fail   — What to do if command exits non-zero: halt | warn | skip
#   timeout   — Max execution time in seconds (default: 30)
#   condition — Optional: only run if condition is met
#   env       — Optional: extra environment variables

hooks:
  pre-workflow: []
    # Example:
    # - command: "npm test --bail"
    #   on_fail: "halt"
    #   timeout: 120
    #   condition: "workflow.has_tests"

  post-step: []
    # Example:
    # - command: "npx eslint --fix {files_modified}"
    #   on_fail: "warn"
    #   timeout: 60

  pre-gate: []
    # Example:
    # - command: "npx tsc --noEmit"
    #   on_fail: "halt"
    #   timeout: 60

  post-gate: []
    # Example:
    # - command: "node scripts/notify-slack.js --gate={gate_name} --result={gate_result}"
    #   on_fail: "skip"

  pre-commit: []
    # Example:
    # - command: "npx lint-staged"
    #   on_fail: "halt"

  post-review: []
    # Example:
    # - command: "node scripts/update-dashboard.js --review={review_type} --result={review_result}"
    #   on_fail: "skip"

  on-error: []
    # Example:
    # - command: "node scripts/alert-team.js --workflow={workflow_name} --error={error_message}"
    #   on_fail: "skip"

  on-resume: []
    # Example:
    # - command: "node scripts/validate-env.js"
    #   on_fail: "warn"

  post-learning: []
    # Example:
    # - command: "node scripts/learning-report.js --agent={agent_id} --score={score}"
    #   on_fail: "skip"
```

### Step 6.2: Implement the Hook Executor

**File:** `_kratos/core/runtime/hook-executor.ts`

```typescript
import { execSync } from 'child_process';
import yaml from 'yaml';

interface HookDefinition {
  command: string;
  on_fail: 'halt' | 'warn' | 'skip';
  timeout?: number;              // Seconds, default 30
  condition?: string;            // Optional condition expression
  env?: Record<string, string>;  // Extra environment variables
}

interface HookContext {
  workflow_name?: string;
  step_number?: number;
  gate_name?: string;
  gate_result?: string;
  review_type?: string;
  review_result?: string;
  agent_id?: string;
  story_key?: string;
  error_message?: string;
  files_modified?: string[];
  score?: number;
  [key: string]: unknown;        // Allow custom variables
}

interface HookResult {
  hook_point: string;
  command: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
  action_taken: 'continued' | 'warned' | 'halted';
}

class HookExecutor {
  private hooks: Record<string, HookDefinition[]> = {};

  constructor(hooksConfigPath: string)

  // Load hooks from YAML config
  async loadConfig(): Promise<void>

  // Execute all hooks for a given lifecycle point
  async execute(hookPoint: string, context: HookContext): Promise<HookResult[]>
  // Algorithm:
  //   1. Get hooks for this hookPoint
  //   2. For each hook:
  //      a. Resolve variables in command string using context
  //         e.g., "{workflow_name}" → "dev-story"
  //      b. Check condition if present
  //      c. Execute command with timeout
  //      d. If exit code != 0:
  //         - on_fail: 'halt' → throw HaltError (workflow stops)
  //         - on_fail: 'warn' → log warning, continue
  //         - on_fail: 'skip' → silently continue
  //      e. Record result
  //   3. Return all results

  // Resolve template variables in a command string
  private resolveCommand(command: string, context: HookContext): string
  // Replace {variable_name} with context[variable_name]
  // {files_modified} → join with spaces if array

  // Add a hook programmatically (for plugins)
  addHook(hookPoint: string, hook: HookDefinition): void

  // Remove a hook
  removeHook(hookPoint: string, index: number): void

  // List all configured hooks
  listHooks(): Record<string, HookDefinition[]>
}

class HaltError extends Error {
  constructor(hookPoint: string, command: string, stderr: string) {
    super(`Hook halted workflow at ${hookPoint}: ${command}\n${stderr}`);
  }
}
```

### Step 6.3: Integration with Workflow Engine

The hook executor integrates with the existing workflow engine by adding a protocol. Create an integration guide that describes where hooks fire:

**File:** `_kratos/core/protocols/hooks-integration.md`

```markdown
# Hooks Integration Protocol

## Where Hooks Fire in the Workflow Engine

The hook executor is called at these points in `workflow.xml` execution:

### pre-workflow
- **When:** After Step 2 (Preflight Validation) passes, before Step 3 (Load Agent)
- **Context:** `{ workflow_name, story_key }`
- **If halted:** Workflow does not start

### post-step
- **When:** After Step 6 processes each instruction step
- **Context:** `{ workflow_name, step_number, story_key, files_modified }`
- **If halted:** Workflow stops at current step

### pre-gate
- **When:** Before Step 2 (pre-start gates) and Step 7 (post-complete gates)
- **Context:** `{ workflow_name, gate_name }`
- **If halted:** Gate check is skipped, workflow halts

### post-gate
- **When:** After any quality gate check completes
- **Context:** `{ workflow_name, gate_name, gate_result: 'passed' | 'failed' }`
- **If halted:** N/A (post-gate can only warn or skip)

### pre-commit
- **When:** Before `git commit` in dev-story workflow
- **Context:** `{ workflow_name, story_key, files_modified }`
- **If halted:** Commit does not execute

### post-review
- **When:** After any of the 6 review gate workflows complete
- **Context:** `{ workflow_name, review_type, review_result, story_key }`
- **If halted:** N/A (post-review can only warn or skip)

### on-error
- **When:** Any step throws an error or fails
- **Context:** `{ workflow_name, step_number, error_message, story_key }`
- **If halted:** N/A (on-error is best-effort notification)

### on-resume
- **When:** `/kratos-resume` activates checkpoint recovery
- **Context:** `{ workflow_name, step_number, checkpoint_path }`
- **If halted:** Resume aborts, user must fix the hook issue first

### post-learning
- **When:** After a trajectory is scored by the learning system
- **Context:** `{ agent_id, workflow_name, story_key, score }`
- **If halted:** N/A (post-learning is notification only)
```

### Step 6.4: Add CLI command for hooks

Add to `cli.ts`:

```typescript
const hooks = program.command('hooks').description('Manage lifecycle hooks');

hooks
  .command('list')
  .description('List all configured hooks')
  .action(async () => {
    // Load hooks.yaml, display all hook points and their commands
  });

hooks
  .command('test <hookPoint>')
  .description('Test-fire a hook point with sample context')
  .action(async (hookPoint) => {
    // Execute hooks for the given point with test context
    // Display results without affecting real workflows
  });
```

### Step 6.5: Update global.yaml

```yaml
execution:
  # ... parallel section from Upgrade 4 ...
  hooks:
    config_path: "{config_path}/hooks.yaml"
    enabled: true
    log_results: true
    max_hook_timeout_sec: 120
```

### Verification — Upgrade 6

- [ ] `hooks.yaml` exists with all 9 hook points defined
- [ ] HookExecutor loads and parses hooks.yaml correctly
- [ ] Variable resolution works (`{workflow_name}` → actual value)
- [ ] `on_fail: halt` stops workflow execution
- [ ] `on_fail: warn` logs warning but continues
- [ ] `on_fail: skip` silently continues
- [ ] Timeout kills long-running hook commands
- [ ] `npx kratos hooks list` displays all hooks
- [ ] `npx kratos hooks test pre-workflow` fires test hooks
- [ ] Integration protocol documents all hook points

### Files Created — Upgrade 6

| File | Action |
|------|--------|
| `_kratos/_config/hooks.yaml` | Created |
| `_kratos/core/runtime/hook-executor.ts` | Created |
| `_kratos/core/protocols/hooks-integration.md` | Created |
| `_kratos/core/runtime/cli.ts` | Modified (added hooks commands) |
| `_kratos/_config/global.yaml` | Modified (added hooks section) |

---

## Phase 2 Completion Checklist

- [ ] Parallel executor with dependency graph and worker pool
- [ ] Conflict detection between parallel workers
- [ ] Heartbeat monitoring for stalled workers
- [ ] TypeScript CLI with memory, learn, sprint, status, doctor, dashboard, hooks commands
- [ ] Checkpoint manager with SHA256 validation
- [ ] Gate checker for pre-start and post-complete gates
- [ ] Lifecycle hooks system with 9 hook points
- [ ] `npm run build` compiles all TypeScript without errors
- [ ] `npx kratos doctor` passes all checks

### Checkpoint

```yaml
# _kratos/_memory/checkpoints/upgrade-phase-2.yaml
upgrade: "Phase 2 - Execution Power"
version: "2.1.0-briareus"
status: "completed"
completed_at: "{ISO 8601}"
upgrades:
  - id: 4
    name: "Parallel Execution"
    status: "completed"
    files_created: 6
  - id: 5
    name: "TypeScript CLI"
    status: "completed"
    files_created: 4
  - id: 6
    name: "Lifecycle Hooks"
    status: "completed"
    files_created: 3
total_files_created: 13
dependencies_added: ["commander", "chalk", "ora", "yaml", "typescript"]
config_changes: ["global.yaml: added execution section", "hooks.yaml created"]
```

### Next Phase

```
Read docs/upgrade-plan/PHASE-3-REACH.md and implement Upgrade 7
```
