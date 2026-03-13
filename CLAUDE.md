# GAIA Framework v1.27.54

This project uses the **GAIA** (Generative Agile Intelligence Architecture) framework — an AI agent framework for Claude Code that orchestrates software product development through 25 specialized agents, 62 workflows, and 8 shared skills.

## How to Start

The primary entry point is `/gaia` — this activates the orchestrator (Gaia) who routes you to the right agent or workflow. You do not need to memorize all commands.

**5 essential commands:**
- `/gaia` — Start here. Gaia shows categories and routes you.
- `/gaia-dev-story` — Implement a user story
- `/gaia-quick-spec` — Rapid spec for small changes
- `/gaia-quick-dev` — Rapid implementation of a quick spec
- `/gaia-help` — Context-sensitive help

## Responding to `/gaia-*` Commands

When any `/gaia-*` command is invoked:
1. Load `{project-root}/_gaia/core/engine/workflow.xml` — this is the execution engine
2. The command file specifies a workflow.yaml or agent.md to process
3. If a workflow: load the pre-resolved config from `_gaia/{module}/.resolved/` first; fall back to runtime resolution
4. Follow the engine instructions EXACTLY — execute steps in order, save outputs at checkpoints
5. Write a checkpoint to `_gaia/_memory/checkpoints/` after each significant step

## Framework Location

```
_gaia/                    # Framework root
├── core/                 # Engine, protocols, shared tasks
├── lifecycle/            # Product lifecycle (5 phases: analysis → deployment)
├── dev/                  # Developer agents (6 stacks) + shared skills (8)
├── creative/             # Creative intelligence workflows
├── testing/              # Test architecture + knowledge base
├── _config/              # Global config, manifests
│   └── global.yaml       # Shared settings — single source of truth
└── _memory/              # Persistent agent memory + checkpoints
```

**Artifact outputs:**
- `docs/planning-artifacts/` — PRDs, UX, architecture, epics
- `docs/implementation-artifacts/` — Sprint status, stories, changelogs
- `docs/test-artifacts/` — Test plans, traceability
- `docs/creative-artifacts/` — Design thinking, innovation outputs

## Project Path

GAIA supports separating the framework from the application source code. The `project_path` setting in `global.yaml` controls where application code lives:

- `project_path: "."` (default) — project code lives at the root alongside `_gaia/`. This is backward compatible.
- `project_path: "my-app"` — project code lives in a subdirectory. GAIA framework stays at root, code goes in `my-app/`.

**Resolved variables:**
- `{project-root}` — always the root directory where `_gaia/` lives. Used for framework paths, docs, and artifacts.
- `{project-path}` — where application source code lives. Equals `{project-root}` if project_path is `"."`, otherwise `{project-root}/{project_path}`.

**Rules:**
- Dev agents MUST write application code to `{project-path}`, not `{project-root}`
- Brownfield onboarding scans `{project-path}` for codebase discovery
- Framework artifacts (docs/, _gaia/) always stay at `{project-root}`
- Commands like `npm install`, `git`, test runners use `{project-path}` as working directory

## Global Rules (apply to ALL agents and workflows)

### Config Resolution
1. Check for pre-resolved config in `_gaia/{module}/.resolved/{workflow}.yaml`
2. If not found: load `workflow.yaml` → module `config.yaml` (which inherits `global.yaml`)
3. Resolve `{project-root}`, `{project-path}`, `{installed_path}`, system-generated values
4. After any config change, run `/gaia-build-configs` to regenerate resolved configs

### Context Budget
- **40K token max** for framework content per activation
- Never pre-load skills or knowledge fragments — load JIT when a step references them
- Use sectioned skill loading when only a subset of a skill is needed
- Release prior step content before loading the next step
- Agent persona files: max 200 lines
- Instruction step files: max 150 lines each
- Skill files: max 300 lines (or load individual sections at ~50 lines each)

### Step Execution
- Execute ALL steps in exact order — no skipping, no reordering
- Read the ENTIRE step file before acting on it
- Save output at every `<template-output>` checkpoint
- In normal mode: WAIT for user confirmation at template-outputs
- In YOLO mode: auto-proceed (user can toggle back to normal with "switch to normal mode")
- In planning mode: present execution plan BEFORE processing steps; wait for user approval; user selects normal or yolo for runtime

### Checkpoint Discipline
- Write a checkpoint to `_gaia/_memory/checkpoints/` after each step completes
- Include: workflow name, step number, key variables, output file path
- Include `files_touched` with sha256 checksums (`shasum -a 256`) for every file created/modified during the workflow
- On resume: validate checksums — warn user of changed files, offer Proceed / Start fresh / Review
- If context is lost, `/gaia-resume` recovers from the last checkpoint

### Quality Gates
- Gates are **enforced**, not advisory — workflow HALTS on gate failure
- Pre-start gates must pass before workflow execution begins
- Post-complete gates must pass before marking a workflow done
- Never mark a task complete without all tests passing

**Testing integration gates (enforced):**
- `create-epics-stories` requires `test-plan.md` — run `/gaia-test-design` after architecture
- `implementation-readiness` requires `traceability-matrix.md` + `ci-setup.md` — run `/gaia-trace` + `/gaia-ci-setup`
- `dev-story` requires `atdd-{story_key}.md` for high-risk stories — run `/gaia-atdd`
- `deployment-checklist` requires traceability + CI + readiness report PASS
- `brownfield-onboarding` requires NFR assessment + performance test plan (output to `test-artifacts/`)

### Sprint-Status Write Safety
- **Story file is source of truth** — sprint-status.yaml is a derived/cached view
- **Review workflows (6)** MUST NOT write to sprint-status.yaml — update only the story file
- **All other workflows** MUST re-read sprint-status.yaml immediately before writing
- Running `/gaia-sprint-status` reconciles sprint-status.yaml with story files

## Naming Conventions

- Slash commands: `gaia-{action}` for workflows, `gaia-agent-{name}` for agents
- Workflow dirs: `{phase}/{workflow-name}/`
- Workflow files: `workflow.yaml` + `instructions.xml` + `checklist.md` + optional `template.md`
- Agent files: `{agent-id}.md` with XML `<agent>` block
- Skill files: `{skill-name}.md` in `_gaia/dev/skills/`
- Knowledge fragments: `{topic}.md` in `_gaia/{module}/knowledge/{category}/`
- Story files: `{story_key}-{story_title_slug}.md` (e.g., `E1-S1-user-login.md`) — canonical name set by `/gaia-create-story`
- Story file lookups use glob `{story_key}-*.md` to match regardless of slug

## Developer Agent System

- 6 specialized developers extend `_gaia/dev/agents/_base-dev.md`
- Stack agents: angular (Lena), typescript (Cleo), flutter (Freya), java (Hugo), python (Ravi), mobile (Talia)
- 8 shared skills: git-workflow, api-design, database-design, docker-workflow, testing-patterns, code-review-standards, documentation-standards, security-basics
- Skills use sectioned loading — only the sections needed by the current step are loaded

## Sprint State Machine

```
backlog → validating → ready-for-dev → in-progress → blocked → review → done
```

**Review Gate:** A story in `review` requires ALL six reviews to pass before moving to `done`:
- `/gaia-code-review` — APPROVE or REQUEST_CHANGES
- `/gaia-qa-tests` — PASSED or FAILED
- `/gaia-security-review` — PASSED or FAILED
- `/gaia-test-automate` — PASSED or FAILED
- `/gaia-test-review` — PASSED or FAILED
- `/gaia-review-perf` — PASSED or FAILED

Run `/gaia-run-all-reviews` to execute all six reviews sequentially via subagents — one command instead of six.

If any review fails, the story returns to `in-progress`. The Review Gate table in the story file tracks progress.

## Memory Hygiene

Agent memory sidecars accumulate decisions across sessions. Run `/gaia-memory-hygiene` periodically (recommended before each sprint) to detect stale, contradicted, or orphaned entries by cross-referencing sidecar decisions against current planning and architecture artifacts.

## Do Not

- Pre-load files — load at runtime when needed
- Skip steps in a workflow — execute ALL steps in order
- Proceed past a template-output without user confirmation (unless YOLO mode)
- Modify files outside the workflow's declared output locations
- Commit secrets, credentials, or .env files
- Create agent files over 200 lines — delegate depth to skills and knowledge fragments
- Chase config inheritance chains at runtime — use pre-resolved configs
- Load more than 40K tokens of framework content in a single activation
