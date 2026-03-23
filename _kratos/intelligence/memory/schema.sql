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
