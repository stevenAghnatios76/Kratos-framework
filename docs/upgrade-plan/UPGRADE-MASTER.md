# Kratos Ultimate Platform — Upgrade Master Plan

## Purpose

This document orchestrates the transformation of Kratos from a structured AI agent framework into the **ultimate AI-powered product development platform**. It combines the best of three analyzed platforms:

- **Kratos** (v1.27.57) — Disciplined lifecycle, quality gates, role-based agents
- **Kratos** (v1.48.0) — Mature product development methodology, validator agent
- **Ruflo** (v3.5.0) — Structured memory, self-learning, swarm coordination

## How to Use This Plan

Each phase is a self-contained MD file. Open the phase file and tell Claude:

```
Read docs/upgrade-plan/PHASE-{N}-{NAME}.md and implement Upgrade {X}
```

### Execution Order

Phases MUST be implemented in order — each phase depends on the previous.

| Phase | File | Upgrades | Depends On | What It Delivers |
|-------|------|----------|------------|------------------|
| **1** | `PHASE-1-INTELLIGENCE-CORE.md` | 1, 2, 3 | Nothing | Memory DB, learning loop, collective intelligence |
| **2** | `PHASE-2-EXECUTION-POWER.md` | 4, 5, 6 | Phase 1 | Parallel execution, CLI, lifecycle hooks |
| **3** | `PHASE-3-REACH.md` | 7, 8, 9 | Phase 1, 2 | Multi-provider, cost routing, validator agent |
| **4** | `PHASE-4-OBSERVABILITY.md` | 10, 11, 12, 13 | Phase 1, 2, 3 | Metrics, codebase intel, plugins, context cache |

### Within Each Phase

Each upgrade inside a phase file follows this structure:

1. **Context** — What exists today, what's missing, why it matters
2. **Architecture** — Where files go, how components connect
3. **Implementation Steps** — Numbered steps with exact file paths, code specs, and acceptance criteria
4. **Integration Points** — How this upgrade connects to existing Kratos systems
5. **Verification** — How to confirm the upgrade works
6. **Files Changed** — Summary of every file created or modified

### Session Management

Each upgrade is designed to fit within a single Claude Code session. If context runs long:

1. Complete the current upgrade step
2. End the session
3. Start a new session and say: `Read docs/upgrade-plan/PHASE-{N}-{NAME}.md — resume at Upgrade {X}, Step {Y}`
4. Claude reads the phase file and picks up where you left off

### Checkpoint Protocol

After completing each upgrade:

1. Claude writes a checkpoint to `_kratos/_memory/checkpoints/upgrade-{N}.yaml`
2. Checkpoint includes: upgrade number, completed steps, files created/modified with SHA256
3. On resume: Claude reads checkpoint to verify state before continuing

---

## Architecture Overview

### New Directory Structure (after all 4 phases)

```
_kratos/
├── core/
│   ├── engine/
│   │   ├── workflow.xml              # EXISTING — no changes
│   │   ├── parallel-executor.ts      # NEW (Phase 2) — parallel orchestration
│   │   └── context-cache.ts          # NEW (Phase 4) — context optimization
│   ├── protocols/                    # EXISTING — no changes
│   ├── tasks/                        # EXISTING — no changes
│   └── runtime/                      # NEW (Phase 2) — TypeScript CLI runtime
│       ├── cli.ts                    # CLI entry point
│       ├── workflow-runner.ts        # Programmatic workflow executor
│       ├── checkpoint-manager.ts     # Checkpoint read/write/validate
│       └── gate-checker.ts           # Quality gate enforcement
│
├── intelligence/                     # NEW (Phase 1) — the brain
│   ├── memory/
│   │   ├── memory-manager.ts         # Partitioned memory with TTL
│   │   ├── schema.sql                # SQLite schema
│   │   ├── migration.ts              # Markdown sidecar → DB migration
│   │   └── search.ts                 # Semantic search
│   ├── learning/
│   │   ├── trajectory-recorder.ts    # Records state → action → outcome
│   │   ├── pattern-distiller.ts      # Extracts high-value patterns
│   │   ├── reasoning-bank.ts         # Retrieves similar past decisions
│   │   └── forgetting-shield.ts      # Protects high-scoring patterns
│   └── collective/
│       ├── knowledge-base.ts         # Shared facts, patterns, decisions
│       ├── subscriptions.ts          # Cross-agent notification system
│       └── consensus.ts              # Conflict resolution protocol
│
├── providers/                        # NEW (Phase 3) — multi-LLM
│   ├── provider-registry.ts          # Provider abstraction layer
│   ├── cost-router.ts                # Complexity scoring + tier routing
│   └── adapters/
│       ├── anthropic.ts              # Claude adapter
│       ├── openai.ts                 # GPT adapter
│       ├── google.ts                 # Gemini adapter
│       └── ollama.ts                 # Local model adapter
│
├── observability/                    # NEW (Phase 4) — the eyes
│   ├── metrics/
│   │   ├── collector.ts              # Automatic metrics collection
│   │   ├── sprint-metrics.ts         # Velocity, cycle time, burndown
│   │   ├── agent-metrics.ts          # Per-agent success rates, tokens
│   │   └── cost-metrics.ts           # Cost per story/sprint/agent
│   ├── codebase/
│   │   ├── scanner.ts                # Incremental codebase scanner
│   │   ├── drift-detector.ts         # Architecture drift detection
│   │   ├── debt-tracker.ts           # Technical debt monitoring
│   │   └── ownership-map.ts          # File → agent/story mapping
│   └── plugins/
│       ├── plugin-loader.ts          # Discover and load plugins
│       ├── plugin-manifest.ts        # Plugin validation
│       └── plugin-registry.ts        # Plugin lifecycle management
│
├── lifecycle/                        # EXISTING — add validator agent
│   └── agents/
│       └── validator.md              # NEW (Phase 3) — Val agent
│
├── dev/                              # EXISTING — no structural changes
├── creative/                         # EXISTING — no structural changes
├── testing/                          # EXISTING — no structural changes
├── _config/
│   ├── global.yaml                   # MODIFIED — new sections added
│   ├── hooks.yaml                    # NEW (Phase 2) — lifecycle hooks
│   ├── providers.yaml                # NEW (Phase 3) — LLM provider config
│   └── plugins.yaml                  # NEW (Phase 4) — plugin manifest
│
├── _memory/
│   ├── memory.db                     # NEW (Phase 1) — SQLite database
│   ├── checkpoints/                  # EXISTING
│   └── {agent}-sidecar/              # EXISTING — becomes export view of DB
│
└── plugins/                          # NEW (Phase 4) — drop-in extensions
    ├── agents/
    ├── workflows/
    ├── skills/
    └── hooks/
```

### New Dependencies

```json
// Added to package.json
{
  "dependencies": {
    "sql.js": "^1.10.0",          // Phase 1: WASM SQLite (zero native deps)
    "commander": "^12.0.0",        // Phase 2: CLI framework
    "chokidar": "^3.6.0",         // Phase 4: File watcher for codebase scanner
    "ws": "^8.16.0"               // Phase 2: WebSocket for dashboard integration
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^2.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## Global.yaml Additions (cumulative across all phases)

```yaml
# === PHASE 1 ADDITIONS ===
intelligence:
  memory:
    backend: "sqlite"                    # sqlite | file (fallback to markdown)
    db_path: "{memory_path}/memory.db"
    partitions: [decisions, patterns, facts, context]
    ttl_days: 90                         # Default TTL for entries
    max_entries_per_partition: 5000
    eviction: "lru"                      # lru | fifo | ttl-only
  learning:
    enabled: true
    trajectory_recording: true
    pattern_distillation: true
    min_trajectories_before_distill: 10
    forgetting_protection: true
    feedback_source: "review-gates"      # review-gates | manual | both
  collective:
    enabled: true
    shared_partitions: [facts, patterns, decisions, anti-patterns]
    subscription_mode: "automatic"       # automatic | manual

# === PHASE 2 ADDITIONS ===
execution:
  parallel:
    enabled: true
    max_concurrent: 6
    mode: "auto"                         # auto | sequential | parallel
    conflict_detection: true
    heartbeat_interval_sec: 60
    stall_timeout_sec: 300
  hooks:
    config_path: "{config_path}/hooks.yaml"
    enabled: true

# === PHASE 3 ADDITIONS ===
providers:
  config_path: "{config_path}/providers.yaml"
  default: "anthropic"
  cost_routing:
    enabled: true
    daily_budget_usd: 50.00
    alert_threshold: 0.8
  validator:
    enabled: true
    auto_validate: false                  # true = validate every template-output
    ground_truth_refresh_days: 7

# === PHASE 4 ADDITIONS ===
observability:
  metrics:
    enabled: true
    collect_sprint: true
    collect_agent: true
    collect_cost: true
    export_format: "json"                # json | csv | both
  codebase:
    incremental_scan: true
    drift_detection: true
    debt_tracking: true
  plugins:
    enabled: true
    plugin_dir: "{installed_path}/plugins"
    manifest_path: "{config_path}/plugins.yaml"
  context:
    cache_enabled: true
    cache_dir: "{installed_path}/.cache"
    precompile_agents: true
    skill_index: true
```

---

## Version Progression

| After Phase | Framework Version | Codename |
|-------------|-------------------|----------|
| Phase 1 | 2.0.0 | "Mneme" (Greek Titan of memory) |
| Phase 2 | 2.1.0 | "Briareus" (100-handed giant — parallelism) |
| Phase 3 | 2.2.0 | "Hermes" (messenger god — multi-provider) |
| Phase 4 | 2.3.0 | "Argus" (100-eyed giant — observability) |
| All complete | 3.0.0 | "Kratos Ultimate" |

---

## Quick Reference: What Each Upgrade Delivers

| # | Upgrade | Phase | Key Deliverable |
|---|---------|-------|-----------------|
| 1 | Structured Memory | 1 | SQLite DB replacing flat markdown sidecars |
| 2 | Self-Learning Loop | 1 | Agents improve from review feedback |
| 3 | Collective Intelligence | 1 | Agents share knowledge cross-team |
| 4 | Parallel Execution | 2 | 6x sprint throughput |
| 5 | TypeScript CLI | 2 | `kratos` CLI for programmatic control |
| 6 | Lifecycle Hooks | 2 | Extensibility without modifying core |
| 7 | Multi-Provider LLM | 3 | Claude + GPT + Gemini + Ollama |
| 8 | Cost Router | 3 | 60-75% cost reduction |
| 9 | Validator Agent | 3 | Automated artifact fact-checking |
| 10 | Metrics Engine | 4 | Sprint/agent/cost dashboards |
| 11 | Codebase Intelligence | 4 | Architecture drift + debt tracking |
| 12 | Plugin System | 4 | Drop-in custom agents/workflows |
| 13 | Context Optimization | 4 | 40% less token waste |

---

## Getting Started

Open Phase 1:

```
Read docs/upgrade-plan/PHASE-1-INTELLIGENCE-CORE.md and implement Upgrade 1
```
