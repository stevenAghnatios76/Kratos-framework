# Phase 1: Intelligence Core — The Brain

**Version target:** 2.0.0 "Mneme"
**Depends on:** Nothing (this is the foundation)
**Upgrades:** 1 (Structured Memory), 2 (Self-Learning Loop), 3 (Collective Intelligence)

---

## Pre-Phase Checklist

Before starting, verify:

- [ ] Node.js 18+ installed (`node --version`)
- [ ] Kratos framework exists at `_kratos/`
- [ ] `_kratos/_config/global.yaml` is readable
- [ ] `_kratos/_memory/` directory exists with agent sidecars

---

## Upgrade 1: Structured Memory System

### Context

**Current state:** Agent memory lives in flat markdown files at `_kratos/_memory/{agent}-sidecar/decision-log.md`. No indexing, no search, no expiration, no partitioning. The `/kratos-memory-hygiene` workflow manually detects stale entries.

**What we're building:** A SQLite-backed (via sql.js WASM) partitioned memory system with TTL expiration, access control, LRU eviction, and semantic search. Existing markdown sidecars become a human-readable export view generated FROM the database.

**Why sql.js:** Zero native dependencies. Runs anywhere Node.js runs. No compilation step. Single `memory.db` file.

### Architecture

```
_kratos/intelligence/memory/
├── schema.sql              # Database schema
├── memory-manager.ts       # Core CRUD + partitioning + TTL + eviction
├── search.ts               # Semantic search (keyword + embedding-ready)
├── migration.ts            # One-time import of existing markdown sidecars
└── index.ts                # Public API exports
```

### Step 1.1: Create the directory structure

```bash
mkdir -p _kratos/intelligence/memory
mkdir -p _kratos/intelligence/learning
mkdir -p _kratos/intelligence/collective
```

### Step 1.2: Create the SQLite schema

**File:** `_kratos/intelligence/memory/schema.sql`

```sql
-- Kratos Memory Database Schema v1.0
-- Backend: sql.js (WASM SQLite)

-- Core memory entries table
CREATE TABLE IF NOT EXISTS memory_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    partition TEXT NOT NULL CHECK(partition IN ('decisions', 'patterns', 'facts', 'context', 'anti-patterns', 'trajectories')),
    agent_id TEXT NOT NULL,
    access_level TEXT NOT NULL DEFAULT 'agent-private' CHECK(access_level IN ('agent-private', 'team-shared', 'global')),

    -- Content
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT DEFAULT '[]',              -- JSON array of tags
    metadata TEXT DEFAULT '{}',          -- JSON object for flexible data

    -- Scoring & relevance
    score REAL DEFAULT 0.0,             -- Quality score (0.0 - 1.0)
    use_count INTEGER DEFAULT 0,        -- Times retrieved and used
    last_used_at TEXT,                   -- ISO 8601

    -- Lifecycle
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'stale', 'contradicted', 'archived')),
    ttl_days INTEGER DEFAULT 90,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,                     -- Computed: created_at + ttl_days

    -- Source tracking
    source_workflow TEXT,                -- Which workflow created this
    source_story TEXT,                   -- Which story context
    source_session TEXT                  -- Session ID for grouping
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_entries_partition ON memory_entries(partition);
CREATE INDEX IF NOT EXISTS idx_entries_agent ON memory_entries(agent_id);
CREATE INDEX IF NOT EXISTS idx_entries_access ON memory_entries(access_level);
CREATE INDEX IF NOT EXISTS idx_entries_status ON memory_entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_tags ON memory_entries(tags);
CREATE INDEX IF NOT EXISTS idx_entries_expires ON memory_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_entries_score ON memory_entries(score DESC);

-- Trajectories table (for Upgrade 2: Learning)
CREATE TABLE IF NOT EXISTS trajectories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    workflow TEXT NOT NULL,
    story_key TEXT,

    -- Trajectory data
    state_context TEXT NOT NULL,         -- JSON: what the agent saw before acting
    action_taken TEXT NOT NULL,          -- JSON: what the agent decided
    outcome TEXT,                        -- JSON: what happened

    -- Scoring
    score REAL,                          -- 0.0 - 1.0 from review gates
    scored_by TEXT,                      -- Which review scored this
    score_details TEXT,                  -- JSON: per-review breakdown

    -- Pattern extraction
    distilled_pattern_id INTEGER,        -- FK to memory_entries if pattern was extracted

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    scored_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_traj_agent ON trajectories(agent_id);
CREATE INDEX IF NOT EXISTS idx_traj_workflow ON trajectories(workflow);
CREATE INDEX IF NOT EXISTS idx_traj_score ON trajectories(score DESC);

-- Cross-agent subscriptions (for Upgrade 3: Collective)
CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscriber_agent TEXT NOT NULL,      -- Who receives notifications
    publisher_agent TEXT NOT NULL,       -- Who triggers notifications
    event_type TEXT NOT NULL,            -- 'decision', 'finding', 'pattern', 'anti-pattern'
    partition_filter TEXT,               -- Optional: only notify for specific partition
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subs_subscriber ON subscriptions(subscriber_agent);
CREATE INDEX IF NOT EXISTS idx_subs_publisher ON subscriptions(publisher_agent);

-- Notification queue
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL,
    entry_id INTEGER NOT NULL,
    recipient_agent TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
    FOREIGN KEY (entry_id) REFERENCES memory_entries(id)
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_agent, read);

-- Metrics table (for Phase 4, but schema defined now)
CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_type TEXT NOT NULL,           -- 'sprint', 'agent', 'cost', 'quality'
    metric_name TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT,
    dimensions TEXT DEFAULT '{}',        -- JSON: {sprint_id, agent_id, story_key, etc.}
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(metric_type, metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON metrics(recorded_at);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    description TEXT
);

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (1, 'Initial schema: memory entries, trajectories, subscriptions, metrics');
```

### Step 1.3: Implement the Memory Manager

**File:** `_kratos/intelligence/memory/memory-manager.ts`

Implement a class `MemoryManager` with these methods:

```typescript
interface MemoryEntry {
  id?: number;
  partition: 'decisions' | 'patterns' | 'facts' | 'context' | 'anti-patterns' | 'trajectories';
  agent_id: string;
  access_level: 'agent-private' | 'team-shared' | 'global';
  title: string;
  content: string;
  tags: string[];
  metadata: Record<string, unknown>;
  score: number;
  status: 'active' | 'stale' | 'contradicted' | 'archived';
  ttl_days: number;
  source_workflow?: string;
  source_story?: string;
}

class MemoryManager {
  constructor(dbPath: string)

  // Initialize database (create tables if not exist)
  async init(): Promise<void>

  // CRUD
  async store(entry: MemoryEntry): Promise<number>  // Returns entry ID
  async get(id: number): Promise<MemoryEntry | null>
  async update(id: number, changes: Partial<MemoryEntry>): Promise<void>
  async delete(id: number): Promise<void>

  // Query
  async query(opts: {
    partition?: string;
    agent_id?: string;
    access_level?: string;
    status?: string;
    tags?: string[];       // Match any tag
    limit?: number;
    offset?: number;
    order_by?: 'score' | 'created_at' | 'last_used_at';
  }): Promise<MemoryEntry[]>

  // Search
  async search(query: string, opts?: {
    partition?: string;
    agent_id?: string;
    limit?: number;
  }): Promise<MemoryEntry[]>   // Full-text search on title + content

  // Agent-scoped helpers
  async getAgentMemory(agent_id: string): Promise<MemoryEntry[]>  // Private + shared + global
  async storeDecision(agent_id: string, title: string, content: string, opts?: Partial<MemoryEntry>): Promise<number>
  async storeFact(agent_id: string, title: string, content: string): Promise<number>
  async storePattern(agent_id: string, title: string, content: string, score: number): Promise<number>
  async storeAntiPattern(agent_id: string, title: string, content: string): Promise<number>

  // Lifecycle
  async expireStaleEntries(): Promise<number>       // Delete entries past TTL, returns count
  async evictLRU(partition: string, maxEntries: number): Promise<number>  // Evict oldest, returns count
  async markStale(id: number): Promise<void>
  async markContradicted(id: number, reason: string): Promise<void>

  // Export (generates markdown from DB — replaces static sidecars)
  async exportAgentSidecar(agent_id: string): Promise<string>  // Returns markdown string
  async exportAllSidecars(outputDir: string): Promise<void>    // Writes markdown files

  // Stats
  async getStats(): Promise<{
    total_entries: number;
    by_partition: Record<string, number>;
    by_agent: Record<string, number>;
    stale_count: number;
    expired_count: number;
  }>

  // Close database connection
  async close(): Promise<void>
}
```

**Implementation notes:**
- Use `sql.js` (WASM) — `import initSqlJs from 'sql.js'`
- Database file: `_kratos/_memory/memory.db`
- On `init()`: read `schema.sql` and execute it
- `search()`: use SQLite `LIKE` on title + content for now (upgrade to FTS5 later if needed)
- `expireStaleEntries()`: `DELETE FROM memory_entries WHERE expires_at < datetime('now') AND status = 'active'`
- `evictLRU()`: `DELETE FROM memory_entries WHERE id IN (SELECT id FROM memory_entries WHERE partition = ? ORDER BY last_used_at ASC LIMIT ?)`
- `exportAgentSidecar()`: query all entries for agent, format as markdown with sections per partition
- All timestamps: ISO 8601 format

### Step 1.4: Implement the migration script

**File:** `_kratos/intelligence/memory/migration.ts`

This runs once to import existing markdown sidecars into the database.

```typescript
class SidecarMigration {
  constructor(memoryManager: MemoryManager, sidecarDir: string)

  // Scan _kratos/_memory/ for *-sidecar/ directories
  async discoverSidecars(): Promise<string[]>

  // Parse a decision-log.md file into structured entries
  async parseSidecar(agentId: string, filePath: string): Promise<MemoryEntry[]>

  // Run full migration
  async migrate(): Promise<{
    agents_migrated: number;
    entries_imported: number;
    errors: string[];
  }>
}
```

**Parsing strategy for decision-log.md:**
- Each H2 (`##`) or H3 (`###`) heading = one entry title
- Content until next heading = entry content
- If heading contains "Decision:" → partition = `decisions`
- If heading contains "Pattern:" → partition = `patterns`
- If heading contains "Fact:" or "Finding:" → partition = `facts`
- Default partition: `decisions`
- Agent ID: derived from directory name (e.g., `architect-sidecar` → `architect`)
- Access level: `agent-private` for all migrated entries (user can promote later)

### Step 1.5: Create the index file

**File:** `_kratos/intelligence/memory/index.ts`

```typescript
export { MemoryManager } from './memory-manager';
export { SidecarMigration } from './migration';
export type { MemoryEntry } from './memory-manager';
```

### Step 1.6: Install dependencies

```bash
cd _kratos && npm install sql.js
```

### Step 1.7: Integration with existing framework

**Modify:** `_kratos/_config/global.yaml` — add the intelligence section:

```yaml
# Intelligence system (Phase 1)
intelligence:
  memory:
    backend: "sqlite"
    db_path: "{memory_path}/memory.db"
    partitions: [decisions, patterns, facts, context, anti-patterns, trajectories]
    ttl_days: 90
    max_entries_per_partition: 5000
    eviction: "lru"
```

### Verification — Upgrade 1

- [ ] `_kratos/intelligence/memory/` directory exists with 4 files
- [ ] `schema.sql` creates all tables without errors
- [ ] `memory-manager.ts` compiles without TypeScript errors
- [ ] Can store and retrieve a memory entry
- [ ] Can search entries by keyword
- [ ] Can expire stale entries
- [ ] Can export agent sidecar as markdown
- [ ] Migration imports at least 1 existing sidecar file
- [ ] `global.yaml` has the intelligence.memory section

### Files Created — Upgrade 1

| File | Action |
|------|--------|
| `_kratos/intelligence/memory/schema.sql` | Created |
| `_kratos/intelligence/memory/memory-manager.ts` | Created |
| `_kratos/intelligence/memory/migration.ts` | Created |
| `_kratos/intelligence/memory/search.ts` | Created |
| `_kratos/intelligence/memory/index.ts` | Created |
| `_kratos/_config/global.yaml` | Modified (added intelligence section) |
| `package.json` | Modified (added sql.js dependency) |

---

## Upgrade 2: Self-Learning Loop

### Context

**Current state:** Agents make decisions, log them in markdown, and forget. There's no feedback loop. An agent that made a bad architecture decision 10 sprints ago will make the same mistake.

**What we're building:** A trajectory recording system that captures every significant agent action (state → action → outcome), scores outcomes using review gate results, distills high-scoring patterns, and retrieves relevant patterns before future decisions.

**Depends on:** Upgrade 1 (uses the memory database and `trajectories` table)

### Architecture

```
_kratos/intelligence/learning/
├── trajectory-recorder.ts    # Records agent actions as trajectories
├── pattern-distiller.ts      # Extracts patterns from scored trajectories
├── reasoning-bank.ts         # Retrieves relevant past patterns before decisions
├── forgetting-shield.ts      # Protects high-value patterns from eviction
└── index.ts                  # Public API exports
```

### Step 2.1: Implement the Trajectory Recorder

**File:** `_kratos/intelligence/learning/trajectory-recorder.ts`

```typescript
interface Trajectory {
  id?: number;
  agent_id: string;
  workflow: string;
  story_key?: string;
  state_context: {
    // Snapshot of what the agent saw before deciding
    input_files: string[];        // Files the agent read
    requirements: string[];       // Key requirements/AC being addressed
    constraints: string[];        // Architecture/security constraints considered
    similar_patterns: string[];   // Patterns retrieved from reasoning bank
  };
  action_taken: {
    // What the agent decided
    decision: string;             // Description of the decision
    files_modified: string[];     // Files created/modified
    approach: string;             // Approach taken (e.g., "microservices", "monolith")
    alternatives_considered: string[];  // Other options evaluated
  };
  outcome?: {
    // Filled in after review gates
    review_results: Record<string, 'PASSED' | 'FAILED' | 'APPROVE' | 'REQUEST_CHANGES'>;
    issues_found: string[];
    rework_required: boolean;
  };
  score?: number;                 // 0.0 - 1.0 computed from review results
  scored_by?: string;
}

class TrajectoryRecorder {
  constructor(db: MemoryManager)

  // Record a new trajectory (before outcome is known)
  async record(trajectory: Omit<Trajectory, 'id' | 'outcome' | 'score'>): Promise<number>

  // Score a trajectory after reviews complete
  async score(trajectoryId: number, outcome: Trajectory['outcome']): Promise<void>
  // Score computation:
  //   - Each PASSED/APPROVE = +1.0
  //   - Each FAILED/REQUEST_CHANGES = +0.0
  //   - Final score = sum / count of reviews
  //   - Bonus: +0.1 if no rework required (capped at 1.0)

  // Get unscored trajectories for a story
  async getUnscored(storyKey: string): Promise<Trajectory[]>

  // Get all trajectories for an agent, ordered by score
  async getAgentTrajectories(agentId: string, opts?: {
    workflow?: string;
    minScore?: number;
    limit?: number;
  }): Promise<Trajectory[]>
}
```

**Integration point:** The trajectory recording hooks into the workflow engine at two points:
1. **Record:** After each `/kratos-dev-story` subtask completion (in the dev-story instructions)
2. **Score:** After `/kratos-run-all-reviews` completes (reads review gate results → scores trajectories)

### Step 2.2: Implement the Pattern Distiller

**File:** `_kratos/intelligence/learning/pattern-distiller.ts`

```typescript
interface DistilledPattern {
  title: string;
  description: string;
  conditions: string[];       // When to apply this pattern
  approach: string;           // What to do
  avg_score: number;          // Average score across source trajectories
  frequency: number;          // How many trajectories support this
  source_trajectories: number[];  // IDs
}

class PatternDistiller {
  constructor(db: MemoryManager)

  // Analyze scored trajectories and extract patterns
  async distill(opts?: {
    agent_id?: string;
    min_trajectories?: number;  // Default: 3 (need at least 3 similar outcomes)
    min_score?: number;         // Default: 0.7 (only learn from good outcomes)
  }): Promise<DistilledPattern[]>

  // Distillation algorithm:
  //   1. Group trajectories by agent_id + workflow
  //   2. Within each group, find clusters with similar action_taken.approach
  //   3. For clusters with 3+ trajectories and avg score >= 0.7:
  //      - Extract common conditions from state_context
  //      - Extract common approach from action_taken
  //      - Create a pattern entry in memory_entries (partition: 'patterns')
  //   4. For clusters with avg score < 0.3:
  //      - Create an anti-pattern entry (partition: 'anti-patterns')
  //   5. Return all distilled patterns

  // Store a distilled pattern in the memory database
  async storePattern(pattern: DistilledPattern): Promise<number>

  // Store a distilled anti-pattern
  async storeAntiPattern(pattern: DistilledPattern): Promise<number>

  // Run full distillation cycle
  async runDistillationCycle(): Promise<{
    patterns_created: number;
    anti_patterns_created: number;
    trajectories_analyzed: number;
  }>
}
```

**Trigger:** Distillation runs:
- After each sprint completes (triggered by `/kratos-retro`)
- On demand via the CLI: `kratos learn distill`

### Step 2.3: Implement the Reasoning Bank

**File:** `_kratos/intelligence/learning/reasoning-bank.ts`

```typescript
class ReasoningBank {
  constructor(db: MemoryManager)

  // Retrieve relevant patterns BEFORE an agent makes a decision
  async retrievePatterns(opts: {
    agent_id: string;
    workflow: string;
    context_keywords: string[];   // Keywords from current task
    limit?: number;               // Default: 5
  }): Promise<{
    patterns: MemoryEntry[];      // High-scoring patterns to follow
    anti_patterns: MemoryEntry[]; // Low-scoring patterns to avoid
    similar_trajectories: Trajectory[];  // Raw past experiences
  }>

  // Retrieval algorithm:
  //   1. Search patterns partition for agent_id + keyword match
  //   2. Search anti-patterns partition for same
  //   3. Search trajectories for similar workflow + context
  //   4. Sort by score descending
  //   5. Return top N of each

  // Format patterns for injection into agent prompt
  async formatForPrompt(patterns: MemoryEntry[], antiPatterns: MemoryEntry[]): Promise<string>
  // Output format:
  //   ## Learned Patterns (apply these)
  //   1. **{title}** (score: {score}) — {description}
  //
  //   ## Anti-Patterns (avoid these)
  //   1. **{title}** (score: {score}) — {description}

  // Record that a pattern was used (bumps use_count and last_used_at)
  async markUsed(entryId: number): Promise<void>
}
```

**Integration point:** The reasoning bank is queried:
- At the START of `/kratos-dev-story` — injects learned patterns into dev agent context
- At the START of `/kratos-create-arch` — injects architecture patterns into Theo's context
- At the START of any review workflow — injects review patterns into reviewer context

### Step 2.4: Implement the Forgetting Shield

**File:** `_kratos/intelligence/learning/forgetting-shield.ts`

```typescript
class ForgettingShield {
  constructor(db: MemoryManager)

  // Protect high-value patterns from TTL expiration and LRU eviction
  async protectHighValuePatterns(opts?: {
    min_score?: number;         // Default: 0.85
    min_frequency?: number;     // Default: 5 (used at least 5 times)
  }): Promise<number>           // Returns count of protected entries

  // Protection mechanism:
  //   1. Find patterns with score >= 0.85 AND use_count >= 5
  //   2. Set their ttl_days to 9999 (effectively permanent)
  //   3. Set their status to 'active' (can't be marked stale)
  //   4. Add metadata tag: { "protected": true, "protected_at": "ISO date" }

  // Unprotect patterns that have degraded
  async reviewProtections(): Promise<number>
  //   1. Find protected patterns that haven't been used in 180 days
  //   2. Remove protection (reset TTL to default)
  //   3. Return count of unprotected entries

  // Run protection cycle
  async runProtectionCycle(): Promise<{
    newly_protected: number;
    unprotected: number;
    total_protected: number;
  }>
}
```

### Step 2.5: Create the learning index

**File:** `_kratos/intelligence/learning/index.ts`

```typescript
export { TrajectoryRecorder } from './trajectory-recorder';
export { PatternDistiller } from './pattern-distiller';
export { ReasoningBank } from './reasoning-bank';
export { ForgettingShield } from './forgetting-shield';
```

### Step 2.6: Update global.yaml

Add to the intelligence section in `_kratos/_config/global.yaml`:

```yaml
intelligence:
  # ... memory section from Upgrade 1 ...
  learning:
    enabled: true
    trajectory_recording: true
    pattern_distillation: true
    min_trajectories_before_distill: 3
    min_score_for_pattern: 0.7
    max_score_for_anti_pattern: 0.3
    forgetting_protection: true
    protection_min_score: 0.85
    protection_min_uses: 5
    feedback_source: "review-gates"
```

### Verification — Upgrade 2

- [ ] Can record a trajectory with state_context and action_taken
- [ ] Can score a trajectory with review gate results
- [ ] Score computation is correct (PASSED=1, FAILED=0, average)
- [ ] Pattern distiller extracts patterns from 3+ similar high-scoring trajectories
- [ ] Anti-patterns extracted from low-scoring clusters
- [ ] Reasoning bank retrieves relevant patterns for a given agent + context
- [ ] `formatForPrompt()` generates clean markdown for injection
- [ ] Forgetting shield protects patterns with score >= 0.85 and uses >= 5
- [ ] `global.yaml` has the intelligence.learning section

### Files Created — Upgrade 2

| File | Action |
|------|--------|
| `_kratos/intelligence/learning/trajectory-recorder.ts` | Created |
| `_kratos/intelligence/learning/pattern-distiller.ts` | Created |
| `_kratos/intelligence/learning/reasoning-bank.ts` | Created |
| `_kratos/intelligence/learning/forgetting-shield.ts` | Created |
| `_kratos/intelligence/learning/index.ts` | Created |
| `_kratos/_config/global.yaml` | Modified (added learning section) |

---

## Upgrade 3: Collective Intelligence

### Context

**Current state:** Each agent's sidecar is isolated. Theo's architecture decisions don't inform Vera's test strategy. Zara's security findings don't reach Avery/Rowan/Jordan during implementation.

**What we're building:** A cross-agent knowledge sharing system with subscriptions and notifications. When one agent records a significant decision, relevant agents are automatically notified.

**Depends on:** Upgrade 1 (uses the memory database, subscriptions table, notifications table)

### Architecture

```
_kratos/intelligence/collective/
├── knowledge-base.ts       # Shared knowledge CRUD
├── subscriptions.ts        # Cross-agent subscription management
├── consensus.ts            # Conflict resolution when agents disagree
└── index.ts                # Public API exports
```

### Step 3.1: Implement the Knowledge Base

**File:** `_kratos/intelligence/collective/knowledge-base.ts`

```typescript
class CollectiveKnowledge {
  constructor(db: MemoryManager)

  // Store a shared fact (visible to all agents)
  async shareFact(publisherAgent: string, title: string, content: string, tags: string[]): Promise<number>

  // Store a shared decision (visible to subscribed agents)
  async shareDecision(publisherAgent: string, title: string, content: string, tags: string[]): Promise<number>

  // Store a shared pattern (from distillation, promoted to global)
  async sharePattern(publisherAgent: string, title: string, content: string, score: number): Promise<number>

  // Share an anti-pattern warning
  async shareAntiPattern(publisherAgent: string, title: string, content: string): Promise<number>

  // Query shared knowledge for an agent (respects access levels)
  async getSharedKnowledge(agentId: string, opts?: {
    partition?: string;
    tags?: string[];
    limit?: number;
  }): Promise<MemoryEntry[]>

  // Get recent decisions that affect a specific agent
  async getRelevantDecisions(agentId: string, limit?: number): Promise<MemoryEntry[]>

  // Implementation: queries memory_entries where access_level IN ('team-shared', 'global')
  // and either agent_id matches OR notification exists for this agent
}
```

### Step 3.2: Implement the Subscription System

**File:** `_kratos/intelligence/collective/subscriptions.ts`

```typescript
interface Subscription {
  id?: number;
  subscriber_agent: string;
  publisher_agent: string;
  event_type: 'decision' | 'finding' | 'pattern' | 'anti-pattern';
  partition_filter?: string;
  enabled: boolean;
}

class SubscriptionManager {
  constructor(db: MemoryManager)

  // Create a subscription
  async subscribe(sub: Omit<Subscription, 'id'>): Promise<number>

  // Remove a subscription
  async unsubscribe(id: number): Promise<void>

  // Get all subscriptions for an agent
  async getSubscriptions(agentId: string): Promise<Subscription[]>

  // Setup default subscriptions (called on first init)
  async setupDefaults(): Promise<void>
  // Default subscriptions:
  //
  // Architect (Theo) publishes → notify:
  //   - All dev agents (Avery, Rowan, Jordan)
  //   - QA (Vera)
  //   - Security (Zara)
  //   - Test Architect (Sable)
  //
  // Security (Zara) publishes → notify:
  //   - All dev agents
  //   - Architect (Theo)
  //   - DevOps (Soren)
  //
  // QA (Vera) publishes findings → notify:
  //   - All dev agents
  //   - Architect (Theo)
  //
  // DevOps (Soren) publishes → notify:
  //   - Architect (Theo)
  //   - All dev agents
  //
  // Test Architect (Sable) publishes → notify:
  //   - QA (Vera)
  //   - All dev agents
  //
  // PM (Derek) publishes → notify:
  //   - Architect (Theo)
  //   - Scrum Master (Nate)

  // Notify subscribers when a new entry is shared
  async notifySubscribers(publisherAgent: string, entryId: number, eventType: string): Promise<number>
  // Returns count of notifications created

  // Get unread notifications for an agent
  async getUnreadNotifications(agentId: string): Promise<{
    entry: MemoryEntry;
    notification_id: number;
    publisher_agent: string;
  }[]>

  // Mark notifications as read
  async markRead(notificationIds: number[]): Promise<void>

  // Format notifications for injection into agent prompt
  async formatNotificationsForPrompt(agentId: string): Promise<string>
  // Output format:
  //   ## Recent Updates From Other Agents
  //
  //   ### From Theo (Architect) — 2 new decisions
  //   1. **Chose event-driven architecture** — Kafka for async messaging...
  //   2. **API gateway pattern** — Kong for routing...
  //
  //   ### From Zara (Security) — 1 new finding
  //   1. **SQL injection risk in user input handler** — Parameterize all queries...
}
```

### Step 3.3: Implement the Consensus Protocol

**File:** `_kratos/intelligence/collective/consensus.ts`

```typescript
interface Conflict {
  id?: number;
  agents: string[];              // Agents who disagree
  topic: string;                 // What they disagree about
  positions: {
    agent_id: string;
    position: string;            // Their stance
    reasoning: string;           // Why they think this
    confidence: number;          // 0.0 - 1.0
  }[];
  resolution?: {
    resolved_by: string;         // 'authority-matrix' | 'human' | 'score'
    winner_agent: string;
    rationale: string;
    resolved_at: string;
  };
  created_at?: string;
}

class ConsensusProtocol {
  constructor(db: MemoryManager)

  // Decision Authority Matrix (from Kratos agent-specification-protocol)
  private authorityMatrix: Record<string, string[]> = {
    'architecture': ['architect'],           // Theo has final say
    'security': ['security'],                // Zara has final say
    'testing': ['test-architect', 'qa'],     // Sable/Vera
    'infrastructure': ['devops'],            // Soren
    'requirements': ['pm'],                  // Derek
    'ux': ['ux-designer'],                   // Christy
    'sprint': ['sm'],                        // Nate
    'frontend': ['senior-frontend'],         // Avery
    'backend': ['senior-backend'],           // Rowan
  };

  // Register a conflict between agents
  async registerConflict(conflict: Omit<Conflict, 'id' | 'resolution'>): Promise<number>

  // Try to auto-resolve using authority matrix
  async autoResolve(conflictId: number): Promise<boolean>
  // Algorithm:
  //   1. Classify the topic into a domain (architecture, security, etc.)
  //   2. Check authority matrix for that domain
  //   3. If one of the conflicting agents IS the authority → they win
  //   4. If no clear authority → escalate to human
  //   5. Store resolution in conflict record

  // Escalate to human (format for prompt)
  async formatForHumanResolution(conflictId: number): Promise<string>
  // Output:
  //   ## Agent Disagreement — Needs Your Decision
  //
  //   **Topic:** {topic}
  //
  //   ### Position A — {agent} (confidence: {n})
  //   {reasoning}
  //
  //   ### Position B — {agent} (confidence: {n})
  //   {reasoning}
  //
  //   **Authority matrix suggests:** {authority agent} has domain authority
  //
  //   Which position do you prefer? [A] [B] [Other]

  // Record human resolution
  async resolveByHuman(conflictId: number, winnerAgent: string, rationale: string): Promise<void>

  // Store resolution as a high-weight pattern for future
  async learnFromResolution(conflictId: number): Promise<void>
}
```

### Step 3.4: Create the collective index

**File:** `_kratos/intelligence/collective/index.ts`

```typescript
export { CollectiveKnowledge } from './knowledge-base';
export { SubscriptionManager } from './subscriptions';
export { ConsensusProtocol } from './consensus';
```

### Step 3.5: Create the intelligence module index

**File:** `_kratos/intelligence/index.ts`

```typescript
// Kratos Intelligence Module
// Phase 1: The Brain

export * from './memory';
export * from './learning';
export * from './collective';
```

### Step 3.6: Update global.yaml

Add to the intelligence section:

```yaml
intelligence:
  # ... memory and learning sections from Upgrades 1-2 ...
  collective:
    enabled: true
    shared_partitions: [facts, patterns, decisions, anti-patterns]
    subscription_mode: "automatic"
    auto_setup_defaults: true
    notification_retention_days: 30
    consensus:
      auto_resolve: true
      authority_matrix_enabled: true
      escalate_to_human: true
```

### Verification — Upgrade 3

- [ ] Can share a fact/decision/pattern across agents
- [ ] Default subscriptions are created on first init
- [ ] When Theo stores a decision, Avery/Rowan/Jordan get notifications
- [ ] When Zara stores a finding, all dev agents get notifications
- [ ] `getUnreadNotifications()` returns only unread items
- [ ] `formatNotificationsForPrompt()` generates clean markdown
- [ ] Conflict registration works
- [ ] Auto-resolve uses authority matrix correctly
- [ ] Human resolution path formats properly
- [ ] Resolutions are stored as learned patterns
- [ ] `global.yaml` has the intelligence.collective section

### Files Created — Upgrade 3

| File | Action |
|------|--------|
| `_kratos/intelligence/collective/knowledge-base.ts` | Created |
| `_kratos/intelligence/collective/subscriptions.ts` | Created |
| `_kratos/intelligence/collective/consensus.ts` | Created |
| `_kratos/intelligence/collective/index.ts` | Created |
| `_kratos/intelligence/index.ts` | Created |
| `_kratos/_config/global.yaml` | Modified (added collective section) |

---

## Phase 1 Completion Checklist

- [ ] All 14 TypeScript files created in `_kratos/intelligence/`
- [ ] `schema.sql` executes without errors
- [ ] `sql.js` dependency installed
- [ ] `global.yaml` updated with full intelligence section
- [ ] Migration script successfully imports existing sidecars
- [ ] Memory CRUD operations work (store, get, update, delete, search)
- [ ] Trajectory recording and scoring works
- [ ] Pattern distillation extracts patterns from scored trajectories
- [ ] Reasoning bank retrieves relevant patterns
- [ ] Collective knowledge sharing triggers notifications
- [ ] Default subscriptions are configured
- [ ] Consensus protocol resolves conflicts via authority matrix

### Checkpoint

After completing Phase 1, write checkpoint:

```yaml
# _kratos/_memory/checkpoints/upgrade-phase-1.yaml
upgrade: "Phase 1 - Intelligence Core"
version: "2.0.0-mneme"
status: "completed"
completed_at: "{ISO 8601}"
upgrades:
  - id: 1
    name: "Structured Memory"
    status: "completed"
    files_created: 5
  - id: 2
    name: "Self-Learning Loop"
    status: "completed"
    files_created: 5
  - id: 3
    name: "Collective Intelligence"
    status: "completed"
    files_created: 5
total_files_created: 15
dependencies_added: ["sql.js"]
config_changes: ["global.yaml: added intelligence section"]
```

### Next Phase

```
Read docs/upgrade-plan/PHASE-2-EXECUTION-POWER.md and implement Upgrade 4
```
