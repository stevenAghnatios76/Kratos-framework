# Phase 4: Observability — The Eyes

**Version target:** 2.3.0 "Argus"
**Depends on:** Phase 1 (memory DB), Phase 2 (CLI, hooks), Phase 3 (providers, cost tracking)
**Upgrades:** 10 (Metrics Engine), 11 (Codebase Intelligence), 12 (Plugin System), 13 (Context Optimization)

---

## Pre-Phase Checklist

Before starting, verify:

- [ ] Phase 1, 2, 3 completed (checkpoints exist)
- [ ] All intelligence modules functional (memory, learning, collective, validation)
- [ ] CLI fully operational with memory, learn, sprint, providers, cost, validate commands
- [ ] Hooks system configured
- [ ] `npx kratos doctor` passes
- [ ] TypeScript compiles cleanly

---

## Upgrade 10: Comprehensive Metrics Engine

### Context

**Current state:** Kratos has a basic dashboard (`dashboard/server.js` on port 3456) that reads Claude session data. There's no structured metrics collection — no sprint velocity tracking, no quality trends, no per-agent performance, no cost analytics. You can't answer "are we getting faster?" or "which agent produces the most review failures?"

**What we're building:** An automatic metrics collection layer that records sprint, agent, quality, and cost metrics to the memory database (metrics table from Phase 1 schema). Integrates with the existing dashboard for visualization.

### Architecture

```
_kratos/observability/metrics/
├── collector.ts              # Central metrics collection + recording
├── sprint-metrics.ts         # Velocity, cycle time, burndown, throughput
├── agent-metrics.ts          # Per-agent success rates, token usage, learning trends
├── quality-metrics.ts        # Review pass rates, defect rates, test coverage
├── cost-metrics.ts           # Cost per story/sprint/agent, tier distribution
└── index.ts                  # Public API exports
```

### Step 10.1: Implement the Metrics Collector

**File:** `_kratos/observability/metrics/collector.ts`

```typescript
interface MetricEvent {
  type: 'sprint' | 'agent' | 'quality' | 'cost';
  name: string;                  // e.g., "velocity", "review_pass_rate", "cost_per_story"
  value: number;
  unit?: string;                 // e.g., "stories", "percent", "usd", "ms"
  dimensions: Record<string, string>;  // e.g., { sprint_id, agent_id, story_key }
}

class MetricsCollector {
  constructor(private db: MemoryManager)

  // Record a single metric
  async record(event: MetricEvent): Promise<void>
  // Inserts into metrics table in memory.db

  // Record multiple metrics
  async recordBatch(events: MetricEvent[]): Promise<void>

  // Query metrics
  async query(opts: {
    type?: string;
    name?: string;
    dimensions?: Record<string, string>;
    from?: string;               // ISO date
    to?: string;                 // ISO date
    limit?: number;
  }): Promise<MetricEvent[]>

  // Get time series for a metric
  async getTimeSeries(name: string, opts?: {
    group_by?: 'day' | 'week' | 'sprint';
    from?: string;
    to?: string;
  }): Promise<{ date: string; value: number }[]>

  // Aggregate metrics
  async aggregate(name: string, operation: 'avg' | 'sum' | 'min' | 'max' | 'count', opts?: {
    dimensions?: Record<string, string>;
    from?: string;
    to?: string;
  }): Promise<number>

  // Export all metrics
  async export(format: 'json' | 'csv'): Promise<string>
}
```

### Step 10.2: Implement Sprint Metrics

**File:** `_kratos/observability/metrics/sprint-metrics.ts`

```typescript
class SprintMetrics {
  constructor(
    private collector: MetricsCollector,
    private sprintStatusPath: string
  )

  // Calculate and record all sprint metrics
  async collectAll(sprintId: string): Promise<void>

  // Velocity: stories completed per sprint
  async calculateVelocity(sprintId: string): Promise<number>
  // Parse sprint-status.yaml, count stories with status 'done'

  // Cycle time: average time from ready-for-dev to done
  async calculateCycleTime(sprintId: string): Promise<number>
  // For each done story: diff between ready-for-dev timestamp and done timestamp
  // Return average in hours

  // Throughput: stories completed per day
  async calculateThroughput(sprintId: string): Promise<number>

  // Rolling velocity: 3-sprint average
  async calculateRollingVelocity(): Promise<number>
  // Query last 3 sprints' velocity metrics, return average

  // Burndown: remaining stories by day
  async calculateBurndown(sprintId: string): Promise<{ day: number; remaining: number }[]>

  // Sprint health score (composite)
  async calculateHealthScore(sprintId: string): Promise<number>
  // Formula:
  //   velocity_factor = actual_velocity / planned_velocity (capped at 1.0)
  //   quality_factor = first_pass_review_rate
  //   cost_factor = 1 - (actual_cost / budget) (higher = more budget remaining)
  //   health = (velocity_factor * 0.4) + (quality_factor * 0.4) + (cost_factor * 0.2)
  //   Scale to 0-100

  // Format sprint report
  async formatReport(sprintId: string): Promise<string>
  // Output:
  //   ## Sprint Metrics: Sprint-3
  //
  //   | Metric | Value | Trend |
  //   |--------|-------|-------|
  //   | Velocity | 8 stories | ↑ (+2 vs last sprint) |
  //   | Cycle Time | 4.2 hours avg | ↓ (-0.8h, improving) |
  //   | Throughput | 1.6 stories/day | → (stable) |
  //   | First-Pass Rate | 75% | ↑ (+10%) |
  //   | Health Score | 82/100 | ↑ |
  //   | Cost | $34.56 | ↓ (-15%, saving) |
}
```

### Step 10.3: Implement Agent Metrics

**File:** `_kratos/observability/metrics/agent-metrics.ts`

```typescript
class AgentMetrics {
  constructor(private collector: MetricsCollector, private db: MemoryManager)

  // Calculate per-agent performance
  async collectAll(): Promise<void>

  // Review pass rate: % of stories where agent's work passed all reviews first try
  async calculatePassRate(agentId: string): Promise<number>

  // Token usage per agent
  async calculateTokenUsage(agentId: string, period?: string): Promise<{
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: number;
  }>

  // Learning trend: average trajectory score over time
  async calculateLearningTrend(agentId: string): Promise<{
    current_avg: number;
    previous_avg: number;
    trend: 'improving' | 'stable' | 'declining';
    improvement_pct: number;
  }>

  // Memory utilization: how many entries per agent, partition sizes
  async calculateMemoryUsage(agentId: string): Promise<{
    total_entries: number;
    by_partition: Record<string, number>;
    active: number;
    stale: number;
  }>

  // Agent efficiency: stories completed per token spent
  async calculateEfficiency(agentId: string): Promise<number>

  // Format agent report
  async formatReport(agentId?: string): Promise<string>
  // If agentId: detailed report for one agent
  // If no agentId: summary table of all agents
  //
  // Output:
  //   ## Agent Performance Report
  //
  //   | Agent | Pass Rate | Avg Score | Learning | Cost | Efficiency |
  //   |-------|-----------|-----------|----------|------|------------|
  //   | Theo  | 85%       | 0.82      | ↑ +12%   | $12  | 2.3        |
  //   | Avery | 78%       | 0.75      | ↑ +8%    | $8   | 3.1        |
  //   | Rowan | 82%       | 0.79      | → stable | $10  | 2.7        |
  //   | Zara  | 95%       | 0.91      | ↑ +5%    | $6   | 4.2        |
}
```

### Step 10.4: Implement Quality Metrics

**File:** `_kratos/observability/metrics/quality-metrics.ts`

```typescript
class QualityMetrics {
  constructor(private collector: MetricsCollector)

  // First-pass review rate: % stories passing all 6 gates first try
  async calculateFirstPassRate(sprintId?: string): Promise<number>

  // Per-gate pass rate
  async calculateGatePassRates(sprintId?: string): Promise<Record<string, number>>
  // Returns: { code-review: 85, qa-tests: 78, security: 92, ... }

  // Defect escape rate: bugs found post-deployment / total stories
  async calculateDefectEscapeRate(): Promise<number>

  // Test coverage trend
  async getTestCoverageTrend(): Promise<{ date: string; coverage: number }[]>

  // Security findings trend
  async getSecurityTrend(): Promise<{ sprint: string; findings: number; critical: number }[]>

  // Quality score (composite)
  async calculateQualityScore(): Promise<number>
  // Formula:
  //   first_pass_weight = 0.3
  //   gate_avg_weight = 0.3
  //   coverage_weight = 0.2
  //   security_weight = 0.2
  //   score = weighted average, scaled to 0-100

  // Format quality report
  async formatReport(): Promise<string>
}
```

### Step 10.5: Implement Cost Metrics

**File:** `_kratos/observability/metrics/cost-metrics.ts`

```typescript
class CostMetrics {
  constructor(private collector: MetricsCollector, private budgetTracker: any)

  // Cost per story average
  async calculateCostPerStory(sprintId?: string): Promise<number>

  // Cost per sprint
  async calculateCostPerSprint(): Promise<Record<string, number>>

  // Tier distribution: what % of tasks go to each model tier
  async calculateTierDistribution(sprintId?: string): Promise<Record<string, number>>

  // Savings from cost routing
  async calculateSavings(sprintId?: string): Promise<{
    all_opus_cost: number;
    actual_cost: number;
    saved: number;
    pct: number;
  }>

  // Cost forecast: projected cost for remaining sprint
  async forecastRemainingCost(sprintId: string): Promise<{
    stories_remaining: number;
    estimated_cost: number;
    daily_burn_rate: number;
    days_of_budget_remaining: number;
  }>

  // Format cost report
  async formatReport(): Promise<string>
}
```

### Step 10.6: Integrate with Dashboard

Update the existing dashboard to read from memory.db metrics table:

**File:** `dashboard/metrics-api.js` (new file alongside existing server.js)

```javascript
// REST API endpoints for dashboard to consume metrics from memory.db
// GET /api/metrics/sprint/:sprintId
// GET /api/metrics/agents
// GET /api/metrics/quality
// GET /api/metrics/cost
// GET /api/metrics/timeseries/:metricName
```

### Step 10.7: Add CLI commands

Add to `cli.ts`:

```typescript
const metrics = program.command('metrics').description('Metrics and reporting');

metrics
  .command('sprint [sprintId]')
  .description('Show sprint metrics')
  .action(async (sprintId) => {
    // Display sprint metrics report
  });

metrics
  .command('agents [agentId]')
  .description('Show agent performance metrics')
  .action(async (agentId) => {
    // Display agent metrics (one or all)
  });

metrics
  .command('quality')
  .description('Show quality metrics and trends')
  .action(async () => {
    // Display quality report
  });

metrics
  .command('cost')
  .description('Show cost metrics and savings')
  .action(async () => {
    // Display cost report with savings
  });

metrics
  .command('export')
  .description('Export all metrics')
  .option('-f, --format <fmt>', 'Export format: json | csv', 'json')
  .option('-o, --output <path>', 'Output file path')
  .action(async (opts) => {
    // Export metrics to file
  });
```

### Step 10.8: Update global.yaml

```yaml
observability:
  metrics:
    enabled: true
    collect_sprint: true
    collect_agent: true
    collect_quality: true
    collect_cost: true
    auto_collect_on: ["sprint-complete", "story-complete", "review-complete"]
    export_format: "json"
    retention_days: 365
```

### Verification — Upgrade 10

- [ ] Metrics collector stores and queries metrics from memory.db
- [ ] Sprint metrics calculates velocity, cycle time, throughput
- [ ] Agent metrics tracks per-agent pass rates and learning trends
- [ ] Quality metrics computes first-pass rate and gate pass rates
- [ ] Cost metrics tracks spending and savings
- [ ] Time series queries return data grouped by period
- [ ] `npx kratos metrics sprint` shows formatted report
- [ ] `npx kratos metrics agents` shows agent leaderboard
- [ ] `npx kratos metrics export --format json` exports data
- [ ] Dashboard API endpoints serve metrics data

### Files Created — Upgrade 10

| File | Action |
|------|--------|
| `_kratos/observability/metrics/collector.ts` | Created |
| `_kratos/observability/metrics/sprint-metrics.ts` | Created |
| `_kratos/observability/metrics/agent-metrics.ts` | Created |
| `_kratos/observability/metrics/quality-metrics.ts` | Created |
| `_kratos/observability/metrics/cost-metrics.ts` | Created |
| `_kratos/observability/metrics/index.ts` | Created |
| `dashboard/metrics-api.js` | Created |
| `_kratos/core/runtime/cli.ts` | Modified (added metrics commands) |
| `_kratos/_config/global.yaml` | Modified (added observability.metrics) |

---

## Upgrade 11: Continuous Codebase Intelligence

### Context

**Current state:** `/kratos-brownfield` scans a codebase once and generates docs. It doesn't track changes over time. There's no way to detect when actual code drifts from architecture.md, when technical debt is growing, or which files are hotspots for conflicts.

**What we're building:** An always-on codebase intelligence system that incrementally scans changes, detects architecture drift, tracks technical debt, and maintains a code ownership map.

### Architecture

```
_kratos/observability/codebase/
├── scanner.ts                # Incremental codebase scanner
├── drift-detector.ts         # Architecture vs. reality comparison
├── debt-tracker.ts           # Technical debt monitoring
├── ownership-map.ts          # File → agent/story mapping
└── index.ts                  # Public API exports
```

### Step 11.1: Implement the Incremental Scanner

**File:** `_kratos/observability/codebase/scanner.ts`

```typescript
interface ScanResult {
  files_scanned: number;
  files_added: number;
  files_modified: number;
  files_deleted: number;
  scan_duration_ms: number;
  snapshot: FileSnapshot[];
}

interface FileSnapshot {
  path: string;
  size_bytes: number;
  line_count: number;
  last_modified: string;
  checksum: string;              // SHA256
  language: string;              // Detected from extension
  imports: string[];             // Parsed import statements
  exports: string[];             // Parsed export statements
}

class CodebaseScanner {
  constructor(private db: MemoryManager, private projectPath: string)

  // Full scan (first run or on demand)
  async fullScan(): Promise<ScanResult>
  // 1. Walk all source files (respect .gitignore)
  // 2. For each file: compute snapshot (size, lines, checksum, imports, exports)
  // 3. Store snapshots in memory DB (facts partition)
  // 4. Return scan result

  // Incremental scan (only changed files since last scan)
  async incrementalScan(): Promise<ScanResult>
  // 1. Get last scan timestamp from DB
  // 2. Use git diff or file modification times to find changed files
  // 3. Only scan changed files
  // 4. Update DB with new snapshots
  // 5. Detect deleted files (in previous scan but not found now)

  // Get dependency graph
  async getDependencyGraph(): Promise<{
    nodes: string[];             // File paths
    edges: { from: string; to: string }[];  // Import relationships
  }>
  // Parse import statements from all scanned files
  // Build directed graph of file dependencies

  // Get file statistics
  async getStats(): Promise<{
    total_files: number;
    total_lines: number;
    by_language: Record<string, { files: number; lines: number }>;
    largest_files: { path: string; lines: number }[];
    most_imported: { path: string; importers: number }[];
  }>

  // Detect file patterns
  async detectPatterns(): Promise<{
    test_files: string[];
    config_files: string[];
    entry_points: string[];
    dead_code: string[];         // Files with no importers (potential dead code)
  }>
}
```

### Step 11.2: Implement the Architecture Drift Detector

**File:** `_kratos/observability/codebase/drift-detector.ts`

```typescript
interface DriftFinding {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  category: 'structural' | 'dependency' | 'pattern' | 'naming';
  description: string;
  architecture_says: string;     // What architecture.md describes
  reality_shows: string;         // What the code actually looks like
  affected_files: string[];
  suggestion: string;
}

class DriftDetector {
  constructor(
    private scanner: CodebaseScanner,
    private db: MemoryManager
  )

  // Run drift detection
  async detect(architecturePath: string): Promise<DriftFinding[]>
  // Algorithm:
  //   1. Parse architecture.md for structural claims:
  //      - Component/module descriptions
  //      - Layer separation rules (e.g., "controllers don't import repositories directly")
  //      - Technology choices (e.g., "uses PostgreSQL")
  //      - Directory structure expectations
  //   2. Scan actual codebase
  //   3. Compare:
  //      - Are described modules present? (CRITICAL if missing)
  //      - Are layer violations occurring? (WARNING)
  //      - Are undocumented modules present? (INFO)
  //      - Does directory structure match? (WARNING if diverged)
  //   4. Return findings sorted by severity

  // Check layer violations
  async checkLayerViolations(layers: {
    name: string;
    directories: string[];
    allowed_imports: string[];    // Which other layers it can import from
  }[]): Promise<DriftFinding[]>
  // For each file in a layer: check if its imports stay within allowed layers

  // Check for undocumented dependencies
  async checkUndocumentedDeps(architecturePath: string): Promise<DriftFinding[]>
  // Compare package.json dependencies with those mentioned in architecture.md

  // Format drift report
  formatReport(findings: DriftFinding[]): string
  // Output:
  //   ## Architecture Drift Report
  //
  //   **Overall: 2 critical, 3 warnings, 5 info**
  //
  //   ### CRITICAL
  //   - Architecture describes `payment-service` module — NOT FOUND in codebase
  //     Affected: architecture.md line 45
  //
  //   ### WARNING
  //   - Layer violation: `src/controllers/user.ts` imports `src/repositories/user-repo.ts`
  //     Architecture says controllers should only import services
  //
  //   ### INFO
  //   - Undocumented module: `src/utils/cache.ts` (45 files, 2800 lines)
  //     Not mentioned in architecture.md — consider documenting
}
```

### Step 11.3: Implement the Technical Debt Tracker

**File:** `_kratos/observability/codebase/debt-tracker.ts`

```typescript
interface DebtItem {
  id?: number;
  category: 'complexity' | 'duplication' | 'size' | 'dependency' | 'test-gap' | 'stale';
  severity: 'high' | 'medium' | 'low';
  file_path: string;
  description: string;
  metric_value: number;          // e.g., cyclomatic complexity score, line count
  threshold: number;             // The limit that was exceeded
  first_detected: string;        // ISO date
  story_source?: string;         // Which story introduced this
  estimated_effort: string;      // e.g., "1h", "4h", "1d"
}

class DebtTracker {
  constructor(private scanner: CodebaseScanner, private db: MemoryManager)

  // Scan for technical debt
  async scan(): Promise<DebtItem[]>
  // Detection rules:
  //
  // complexity: Files with estimated high cyclomatic complexity
  //   - Proxy: count of if/else/switch/for/while/try/catch + nesting depth
  //   - Threshold: > 20 per function → high, > 10 → medium
  //
  // size: Files exceeding size limits
  //   - > 500 lines → medium
  //   - > 1000 lines → high
  //
  // duplication: Similar file names suggesting copy-paste
  //   - Files with similar names in different directories
  //
  // dependency: Outdated or excessive dependencies
  //   - Packages with known vulnerabilities (npm audit)
  //   - Packages not imported anywhere (unused dependencies)
  //
  // test-gap: Source files without corresponding test files
  //   - src/auth/login.ts exists but no test file found
  //
  // stale: Files not modified in > 6 months with no test coverage

  // Get debt trend over time
  async getTrend(): Promise<{
    date: string;
    total_items: number;
    by_severity: Record<string, number>;
  }[]>

  // Get debt by category
  async getByCategory(): Promise<Record<string, DebtItem[]>>

  // Calculate debt score (lower is better)
  async calculateScore(): Promise<{
    score: number;               // 0-100 (100 = no debt, 0 = critical)
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    items: number;
    top_offenders: DebtItem[];
  }>

  // Format debt report
  formatReport(items: DebtItem[]): string
  // Output:
  //   ## Technical Debt Report
  //
  //   **Debt Score: 72/100 (Grade: B)**
  //
  //   ### High Severity (3 items)
  //   - `src/api/routes.ts` — 1,245 lines (threshold: 500)
  //     Source: E2-S3 (user management story)
  //     Effort: ~4h to split into route modules
  //
  //   ### Test Gaps (5 files missing tests)
  //   - `src/auth/oauth.ts` — no test file found
  //   - `src/utils/cache.ts` — no test file found
}
```

### Step 11.4: Implement the Code Ownership Map

**File:** `_kratos/observability/codebase/ownership-map.ts`

```typescript
interface FileOwnership {
  file_path: string;
  stories: string[];             // Story keys that modified this file
  agents: string[];              // Agent IDs that modified this file
  change_count: number;          // Total modifications
  last_modified_by: string;      // Most recent story
  hotspot_score: number;         // Higher = more frequently changed (conflict risk)
}

class OwnershipMap {
  constructor(private db: MemoryManager)

  // Build ownership map from checkpoint files_touched data
  async build(): Promise<void>
  // 1. Scan all checkpoints (active + completed)
  // 2. For each checkpoint: extract files_touched, story_key, agent_id
  // 3. Build file → [stories, agents, change_count] mapping
  // 4. Store in memory DB

  // Update map after a story completes
  async updateFromCheckpoint(checkpointPath: string): Promise<void>

  // Get ownership for a specific file
  async getOwnership(filePath: string): Promise<FileOwnership | null>

  // Get hotspot files (most frequently changed)
  async getHotspots(limit?: number): Promise<FileOwnership[]>
  // Sorted by change_count descending
  // These are files most likely to cause merge conflicts in parallel execution

  // Get files owned by a specific story
  async getFilesByStory(storyKey: string): Promise<string[]>

  // Get files touched by a specific agent
  async getFilesByAgent(agentId: string): Promise<string[]>

  // Predict conflicts for parallel stories
  async predictConflicts(storyKeys: string[]): Promise<{
    high_risk: string[];         // Files touched by 3+ of the listed stories
    medium_risk: string[];       // Files touched by 2 of the listed stories
    safe: string[];              // Files touched by only 1 story
  }>

  // Format ownership report
  formatReport(): string
}
```

### Step 11.5: Add CLI commands

Add to `cli.ts`:

```typescript
const codebase = program.command('codebase').description('Codebase intelligence');

codebase
  .command('scan')
  .description('Scan codebase (incremental)')
  .option('--full', 'Force full scan')
  .action(async (opts) => {
    // Run incremental or full scan, display results
  });

codebase
  .command('drift')
  .description('Detect architecture drift')
  .option('-a, --arch <path>', 'Architecture document path')
  .action(async (opts) => {
    // Run drift detection, display findings
  });

codebase
  .command('debt')
  .description('Show technical debt report')
  .action(async () => {
    // Run debt scan, display report with score and grade
  });

codebase
  .command('hotspots')
  .description('Show most frequently changed files')
  .option('-l, --limit <n>', 'Max results', '10')
  .action(async (opts) => {
    // Display hotspot files from ownership map
  });

codebase
  .command('ownership <file>')
  .description('Show ownership history for a file')
  .action(async (file) => {
    // Display which stories and agents touched this file
  });

codebase
  .command('stats')
  .description('Show codebase statistics')
  .action(async () => {
    // Display file counts, line counts, language breakdown
  });
```

### Step 11.6: Update global.yaml

```yaml
observability:
  # ... metrics section from Upgrade 10 ...
  codebase:
    incremental_scan: true
    scan_on: ["story-complete", "sprint-complete"]
    drift_detection: true
    drift_check_on: ["sprint-complete"]
    debt_tracking: true
    debt_scan_on: ["sprint-complete"]
    ignore_patterns: ["node_modules", "dist", ".git", "*.min.js"]
```

### Verification — Upgrade 11

- [ ] Full scan discovers all source files
- [ ] Incremental scan only processes changed files
- [ ] Dependency graph built from import analysis
- [ ] Drift detector identifies missing modules described in architecture
- [ ] Drift detector catches layer violations
- [ ] Debt tracker finds files exceeding size thresholds
- [ ] Debt tracker identifies test gaps
- [ ] Ownership map tracks which stories modified which files
- [ ] Hotspot detection identifies most-changed files
- [ ] `npx kratos codebase scan` runs successfully
- [ ] `npx kratos codebase drift` shows drift findings
- [ ] `npx kratos codebase debt` shows debt score and grade

### Files Created — Upgrade 11

| File | Action |
|------|--------|
| `_kratos/observability/codebase/scanner.ts` | Created |
| `_kratos/observability/codebase/drift-detector.ts` | Created |
| `_kratos/observability/codebase/debt-tracker.ts` | Created |
| `_kratos/observability/codebase/ownership-map.ts` | Created |
| `_kratos/observability/codebase/index.ts` | Created |
| `_kratos/core/runtime/cli.ts` | Modified (added codebase commands) |
| `_kratos/_config/global.yaml` | Modified (added observability.codebase) |

---

## Upgrade 12: Plugin & Extension System

### Context

**Current state:** Kratos has 15 agents, 64 workflows, 8 skills, and 16 tasks — all hardcoded in the framework. To add a new agent, workflow, or skill, you must modify framework files and update manifests manually. No way for teams to add custom capabilities without forking.

**What we're building:** A plugin system where users drop agent, workflow, skill, and hook files into a `_kratos/plugins/` directory. The plugin loader discovers, validates, and merges them into the framework at runtime.

### Architecture

```
_kratos/observability/plugins/
├── plugin-loader.ts          # Discover and load plugins
├── plugin-manifest.ts        # Plugin validation and manifest handling
├── plugin-registry.ts        # Plugin lifecycle management
└── index.ts                  # Public API exports

_kratos/plugins/              # Drop-in plugin directory
├── agents/                   # Custom agent files
├── workflows/                # Custom workflow directories
├── skills/                   # Custom skill files
├── tasks/                    # Custom task files
└── hooks/                    # Custom hook scripts

_kratos/_config/
└── plugins.yaml              # Plugin configuration and manifest
```

### Step 12.1: Create the plugin directory structure

```bash
mkdir -p _kratos/plugins/{agents,workflows,skills,tasks,hooks}
mkdir -p _kratos/observability/plugins
```

### Step 12.2: Create the plugin configuration

**File:** `_kratos/_config/plugins.yaml`

```yaml
# Kratos Plugin Configuration
# Plugins extend the framework without modifying core files.

settings:
  enabled: true
  plugin_dir: "{installed_path}/plugins"
  auto_discover: true            # Scan plugin_dir on startup
  validate_on_load: true         # Validate plugin files before loading
  allow_override: false          # Plugins cannot override core agents/workflows

plugins: []
  # Plugin entries are auto-populated on discovery, or manually added:
  #
  # - name: "jira-integration"
  #   version: "1.0.0"
  #   author: "Your Name"
  #   description: "Sync stories with Jira"
  #   components:
  #     agents: ["jira-sync"]
  #     workflows: ["sync-to-jira"]
  #     skills: []
  #     tasks: ["jira-update"]
  #     hooks:
  #       post-review: "hooks/jira-notify.js"
  #   enabled: true
```

### Step 12.3: Implement the Plugin Loader

**File:** `_kratos/observability/plugins/plugin-loader.ts`

```typescript
interface PluginComponent {
  type: 'agent' | 'workflow' | 'skill' | 'task' | 'hook';
  name: string;
  file_path: string;
  valid: boolean;
  errors: string[];
}

interface Plugin {
  name: string;
  version: string;
  author?: string;
  description?: string;
  components: PluginComponent[];
  enabled: boolean;
  loaded_at?: string;
}

class PluginLoader {
  constructor(private pluginDir: string, private configPath: string)

  // Discover all plugins in the plugin directory
  async discover(): Promise<Plugin[]>
  // Algorithm:
  //   1. Scan plugins/agents/ for *.md files → agent components
  //   2. Scan plugins/workflows/ for dirs containing workflow.yaml → workflow components
  //   3. Scan plugins/skills/ for *.md files → skill components
  //   4. Scan plugins/tasks/ for *.md files → task components
  //   5. Scan plugins/hooks/ for *.js files → hook components
  //   6. Group components into plugins (by plugins.yaml entries, or auto-group by name)
  //   7. Return discovered plugins

  // Validate a plugin component
  async validate(component: PluginComponent): Promise<{ valid: boolean; errors: string[] }>
  // Validation rules:
  //   agent: must contain <agent> XML block, id must not conflict with core agents
  //   workflow: must have valid workflow.yaml with required fields
  //   skill: must contain <!-- SECTION: --> markers
  //   task: must contain valid task definition
  //   hook: must be executable JS/TS file

  // Load a single plugin
  async load(plugin: Plugin): Promise<boolean>
  // 1. Validate all components
  // 2. Check for name conflicts with core (reject if allow_override is false)
  // 3. Register components in the runtime

  // Load all enabled plugins
  async loadAll(): Promise<{
    loaded: number;
    failed: number;
    errors: string[];
  }>

  // Generate updated manifests (merge plugins into core manifests)
  async generateMergedManifests(): Promise<{
    agents: string;              // Updated agent-manifest.csv content
    workflows: string;           // Updated workflow-manifest.csv content
    skills: string;              // Updated skill-manifest.csv content
    tasks: string;               // Updated task-manifest.csv content
  }>
}
```

### Step 12.4: Implement the Plugin Registry

**File:** `_kratos/observability/plugins/plugin-registry.ts`

```typescript
class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();

  constructor(private loader: PluginLoader)

  // Initialize: discover and load all plugins
  async init(): Promise<void>

  // Register a new plugin
  async register(plugin: Plugin): Promise<boolean>

  // Unregister a plugin
  async unregister(pluginName: string): Promise<void>

  // Enable/disable a plugin
  async setEnabled(pluginName: string, enabled: boolean): Promise<void>

  // Get all registered plugins
  getPlugins(): Plugin[]

  // Get plugin by name
  getPlugin(name: string): Plugin | undefined

  // Get all components of a specific type
  getComponents(type: 'agent' | 'workflow' | 'skill' | 'task' | 'hook'): PluginComponent[]

  // Check if a component name is provided by a plugin
  isPlugin(componentName: string): boolean

  // Get merged manifests (core + plugins)
  async getMergedManifest(type: 'agent' | 'workflow' | 'skill' | 'task'): Promise<string>
}
```

### Step 12.5: Implement the Plugin Manifest Handler

**File:** `_kratos/observability/plugins/plugin-manifest.ts`

```typescript
class PluginManifest {
  // Read plugins.yaml
  async read(configPath: string): Promise<Plugin[]>

  // Write plugins.yaml (after discovery)
  async write(configPath: string, plugins: Plugin[]): Promise<void>

  // Add a plugin entry
  async addPlugin(configPath: string, plugin: Plugin): Promise<void>

  // Remove a plugin entry
  async removePlugin(configPath: string, pluginName: string): Promise<void>

  // Validate manifest structure
  async validate(configPath: string): Promise<{ valid: boolean; errors: string[] }>
}
```

### Step 12.6: Add CLI commands

Add to `cli.ts`:

```typescript
const plugins = program.command('plugins').description('Plugin management');

plugins
  .command('list')
  .description('List all discovered plugins')
  .action(async () => {
    // Discover and display all plugins with status
  });

plugins
  .command('discover')
  .description('Scan for new plugins')
  .action(async () => {
    // Run PluginLoader.discover(), update plugins.yaml
  });

plugins
  .command('validate [pluginName]')
  .description('Validate a plugin or all plugins')
  .action(async (pluginName) => {
    // Validate and display errors
  });

plugins
  .command('enable <pluginName>')
  .description('Enable a plugin')
  .action(async (pluginName) => {
    // Set enabled: true in plugins.yaml
  });

plugins
  .command('disable <pluginName>')
  .description('Disable a plugin')
  .action(async (pluginName) => {
    // Set enabled: false in plugins.yaml
  });

plugins
  .command('create <pluginName>')
  .description('Scaffold a new plugin')
  .option('-t, --type <types>', 'Component types: agent,workflow,skill,task,hook')
  .action(async (pluginName, opts) => {
    // Create plugin directory with boilerplate files
  });
```

### Step 12.7: Update global.yaml

```yaml
observability:
  # ... metrics and codebase sections ...
  plugins:
    enabled: true
    plugin_dir: "{installed_path}/plugins"
    manifest_path: "{config_path}/plugins.yaml"
    auto_discover: true
    validate_on_load: true
    allow_override: false
```

### Verification — Upgrade 12

- [ ] Plugin directory structure exists
- [ ] Plugin loader discovers agent files in plugins/agents/
- [ ] Plugin loader discovers workflows in plugins/workflows/
- [ ] Plugin validation catches invalid agent files (missing `<agent>` block)
- [ ] Plugin validation rejects name conflicts with core agents
- [ ] Merged manifests include plugin components
- [ ] `npx kratos plugins list` shows all plugins
- [ ] `npx kratos plugins discover` finds new plugins
- [ ] `npx kratos plugins create my-plugin --type agent,workflow` scaffolds files
- [ ] `npx kratos plugins enable/disable` toggles plugins
- [ ] plugins.yaml is updated after discovery

### Files Created — Upgrade 12

| File | Action |
|------|--------|
| `_kratos/observability/plugins/plugin-loader.ts` | Created |
| `_kratos/observability/plugins/plugin-manifest.ts` | Created |
| `_kratos/observability/plugins/plugin-registry.ts` | Created |
| `_kratos/observability/plugins/index.ts` | Created |
| `_kratos/_config/plugins.yaml` | Created |
| `_kratos/plugins/agents/.gitkeep` | Created |
| `_kratos/plugins/workflows/.gitkeep` | Created |
| `_kratos/plugins/skills/.gitkeep` | Created |
| `_kratos/plugins/tasks/.gitkeep` | Created |
| `_kratos/plugins/hooks/.gitkeep` | Created |
| `_kratos/core/runtime/cli.ts` | Modified (added plugins commands) |
| `_kratos/_config/global.yaml` | Modified (added observability.plugins) |

---

## Upgrade 13: Context Optimization Engine

### Context

**Current state:** Every Claude Code activation re-reads the same files. The 40K token budget is consumed by re-loading agent personas, skills, and configs that haven't changed. No caching between sessions. No smart summarization of completed steps.

**What we're building:** A context optimization engine that pre-compiles agent contexts, indexes skill sections, enables incremental context loading on resume, and summarizes completed steps to free budget for active work.

### Architecture

```
_kratos/core/engine/
├── context-cache.ts          # Pre-compiled contexts + caching
├── skill-index.ts            # Skill section indexer
└── ... (existing workflow.xml)

_kratos/.cache/               # Pre-compiled cache directory
├── agents/                   # Pre-compiled agent contexts
├── skills/                   # Skill section indexes
└── configs/                  # Pre-resolved config snapshots
```

### Step 13.1: Implement the Skill Section Index

**File:** `_kratos/core/engine/skill-index.ts`

```typescript
interface SkillSection {
  skill_name: string;
  section_name: string;
  start_line: number;
  end_line: number;
  line_count: number;
  preview: string;               // First 50 chars of section content
}

interface SkillIndex {
  skills: Record<string, {       // skill_name → sections
    file_path: string;
    total_lines: number;
    sections: SkillSection[];
  }>;
  built_at: string;
  version: string;
}

class SkillIndexer {
  constructor(private skillsDir: string, private cacheDir: string)

  // Build index of all skill files and their sections
  async buildIndex(): Promise<SkillIndex>
  // Algorithm:
  //   1. Glob all *.md files in skills directory
  //   2. For each skill file:
  //      a. Scan for <!-- SECTION: section-name --> markers
  //      b. Record start line, end line (next section or EOF)
  //      c. Calculate line count
  //      d. Extract preview (first 50 chars)
  //   3. Write index to _kratos/.cache/skills/skill-index.yaml

  // Load a specific section without reading the entire skill file
  async loadSection(skillName: string, sectionName: string): Promise<string>
  // 1. Look up section in index
  // 2. Read only the lines between start_line and end_line
  // 3. Return content

  // Get estimated token count for a section
  async estimateTokens(skillName: string, sectionName: string): Promise<number>
  // Rough estimate: word_count * 1.3

  // List all available sections
  listSections(skillName?: string): SkillSection[]

  // Read cached index
  async readIndex(): Promise<SkillIndex | null>

  // Rebuild index (called by /kratos-build-configs)
  async rebuild(): Promise<SkillIndex>
}
```

### Step 13.2: Implement the Context Cache

**File:** `_kratos/core/engine/context-cache.ts`

```typescript
interface AgentContext {
  agent_id: string;
  essential_context: string;     // Compressed version (persona + key rules)
  full_context: string;          // Complete agent file content
  essential_tokens: number;      // Estimated token count for essential
  full_tokens: number;           // Estimated token count for full
  compiled_at: string;
  source_checksum: string;       // SHA256 of source file (for invalidation)
}

interface ContextBudget {
  total_budget: number;          // 40000
  used: number;
  remaining: number;
  breakdown: {
    agent: number;
    skills: number;
    config: number;
    instructions: number;
    other: number;
  };
}

class ContextCache {
  constructor(private cacheDir: string)

  // Pre-compile agent contexts (called by /kratos-build-configs)
  async compileAgents(agentsDir: string): Promise<void>
  // For each agent file:
  //   1. Read full content
  //   2. Extract essential context:
  //      - Persona (first 3-4 sentences)
  //      - Communication style (key bullet points)
  //      - Rules (all rules)
  //      - Responsibilities (first 5)
  //   3. Estimate token counts
  //   4. Save to _kratos/.cache/agents/{agent-id}.json

  // Get agent context (essential or full)
  async getAgentContext(agentId: string, mode: 'essential' | 'full'): Promise<string>
  // 1. Check cache for compiled context
  // 2. Verify source checksum (invalidate if agent file changed)
  // 3. Return requested mode

  // Calculate current context budget usage
  calculateBudget(loaded: {
    agent?: number;
    skills?: number;
    config?: number;
    instructions?: number;
  }): ContextBudget

  // Smart summarization of completed steps
  summarizeCompletedSteps(steps: {
    number: number;
    title: string;
    output_path?: string;
    key_decisions: string[];
  }[]): string
  // Converts each completed step to a 1-line summary:
  //   "Step 1 (Load PRD): ✓ Loaded requirements — 12 FRs, 5 NFRs identified"
  // Instead of keeping the full step content in context

  // Incremental context for resume
  async getIncrementalContext(checkpointPath: string): Promise<{
    changed_files: string[];     // Files changed since checkpoint
    unchanged_summary: string;   // Summary of unchanged state
    new_context: string;         // Only the changed content
  }>
  // 1. Read checkpoint with checksums
  // 2. Compare current file checksums
  // 3. Only load files that changed
  // 4. Summarize unchanged files as 1-liners

  // Cross-session context transfer
  async transferContext(fromSession: string, toWorkflow: string): Promise<string>
  // 1. Query memory DB for key decisions from the previous session
  // 2. Filter by relevance to the target workflow
  // 3. Format as concise context injection
  // 4. Estimate: ~200-500 tokens

  // Cache invalidation
  async invalidate(type?: 'agents' | 'skills' | 'configs' | 'all'): Promise<void>
  // Clear cached files for the specified type

  // Get cache stats
  async getStats(): Promise<{
    agents_cached: number;
    skills_indexed: number;
    cache_size_bytes: number;
    last_built: string;
    savings_estimate_pct: number;  // Estimated token savings vs. no cache
  }>
}
```

### Step 13.3: Create cache directory

```bash
mkdir -p _kratos/.cache/{agents,skills,configs}
```

### Step 13.4: Add CLI commands

Add to `cli.ts`:

```typescript
const context = program.command('context').description('Context optimization');

context
  .command('build')
  .description('Pre-compile agent contexts and skill indexes')
  .action(async () => {
    // Run ContextCache.compileAgents() and SkillIndexer.buildIndex()
  });

context
  .command('stats')
  .description('Show context cache statistics')
  .action(async () => {
    // Display cache stats: agents compiled, skills indexed, savings estimate
  });

context
  .command('invalidate')
  .description('Clear context cache')
  .option('-t, --type <type>', 'Type to invalidate: agents | skills | configs | all', 'all')
  .action(async (opts) => {
    // Clear cache for specified type
  });

context
  .command('budget')
  .description('Show current context budget breakdown')
  .action(async () => {
    // Display 40K budget usage breakdown
  });

context
  .command('skill-sections [skillName]')
  .description('List indexed skill sections')
  .action(async (skillName) => {
    // Display skill sections with line counts and token estimates
  });
```

### Step 13.5: Update global.yaml

```yaml
observability:
  # ... metrics, codebase, plugins sections ...
  context:
    cache_enabled: true
    cache_dir: "{installed_path}/.cache"
    precompile_agents: true
    skill_index: true
    summarize_completed_steps: true
    cross_session_transfer: true
    max_transfer_tokens: 500
```

### Step 13.6: Integration with /kratos-build-configs

Update the build-configs workflow to also:
1. Pre-compile agent contexts
2. Build skill section indexes
3. Cache resolved configs
4. Report cache statistics

This ensures the cache is rebuilt whenever configs change.

### Verification — Upgrade 13

- [ ] Skill indexer finds all `<!-- SECTION: -->` markers in skill files
- [ ] `loadSection()` returns only the requested section content
- [ ] Agent pre-compilation extracts essential context (under 50 lines)
- [ ] Cache invalidation detects when source files change (checksum mismatch)
- [ ] Context budget calculation is accurate
- [ ] Smart summarization reduces completed steps to 1-liners
- [ ] Incremental context only loads changed files on resume
- [ ] Cross-session transfer injects relevant decisions from previous session
- [ ] `npx kratos context build` compiles cache
- [ ] `npx kratos context stats` shows savings estimate
- [ ] `npx kratos context skill-sections git-workflow` lists sections

### Files Created — Upgrade 13

| File | Action |
|------|--------|
| `_kratos/core/engine/context-cache.ts` | Created |
| `_kratos/core/engine/skill-index.ts` | Created |
| `_kratos/.cache/agents/.gitkeep` | Created |
| `_kratos/.cache/skills/.gitkeep` | Created |
| `_kratos/.cache/configs/.gitkeep` | Created |
| `_kratos/core/runtime/cli.ts` | Modified (added context commands) |
| `_kratos/_config/global.yaml` | Modified (added observability.context) |

---

## Phase 4 Completion Checklist

- [ ] Metrics engine collects sprint, agent, quality, and cost metrics
- [ ] Dashboard API serves metrics data
- [ ] Codebase scanner performs incremental scans
- [ ] Architecture drift detector finds divergences
- [ ] Technical debt tracker calculates debt score
- [ ] Ownership map tracks file → story → agent relationships
- [ ] Plugin system discovers, validates, and loads custom plugins
- [ ] Plugin CLI scaffolds new plugins
- [ ] Context cache pre-compiles agent contexts
- [ ] Skill indexer enables section-level loading
- [ ] All CLI commands work
- [ ] TypeScript compiles cleanly
- [ ] `npx kratos doctor` passes

### Checkpoint

```yaml
# _kratos/_memory/checkpoints/upgrade-phase-4.yaml
upgrade: "Phase 4 - Observability"
version: "2.3.0-argus"
status: "completed"
completed_at: "{ISO 8601}"
upgrades:
  - id: 10
    name: "Metrics Engine"
    status: "completed"
    files_created: 7
  - id: 11
    name: "Codebase Intelligence"
    status: "completed"
    files_created: 5
  - id: 12
    name: "Plugin System"
    status: "completed"
    files_created: 5
  - id: 13
    name: "Context Optimization"
    status: "completed"
    files_created: 3
total_files_created: 20
config_changes: ["global.yaml: added full observability section", "plugins.yaml created"]
```

---

## All Phases Complete — Kratos Ultimate v3.0.0

After all 4 phases, bump the framework version to **3.0.0** and update:

1. **`_kratos/_config/global.yaml`** — set `framework_version: "3.0.0"`
2. **`package.json`** — set `"version": "3.0.0"`
3. **`CLAUDE.md`** — update version reference and add new capabilities
4. **`README.md`** — update with new features, CLI commands, architecture

### Final CLI Command Summary

```
kratos
├── memory      (search, stats, export, migrate, expire)
├── learn       (distill, patterns, report, protect)
├── sprint      (plan, run, reviews)
├── status
├── doctor
├── dashboard
├── hooks       (list, test)
├── providers   (list, test, cost-estimate)
├── cost        (report, route, savings)
├── validate    (artifact, refresh-ground-truth, ground-truth)
├── metrics     (sprint, agents, quality, cost, export)
├── codebase    (scan, drift, debt, hotspots, ownership, stats)
├── plugins     (list, discover, validate, enable, disable, create)
└── context     (build, stats, invalidate, budget, skill-sections)
```

### Total Files Created Across All Phases

| Phase | Files Created | Files Modified |
|-------|---------------|----------------|
| Phase 1 | 15 | 2 |
| Phase 2 | 13 | 2 |
| Phase 3 | 16 | 3 |
| Phase 4 | 20 | 3 |
| **Total** | **64** | **10** |
