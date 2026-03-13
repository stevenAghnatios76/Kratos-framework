# Kratos Framework v1.27.4

This project uses the **KRATOS** (Generative Agile Intelligence Architecture) framework — an AI agent framework for Claude Code that orchestrates software product development through 15 specialized agents, 64 workflows, and 8 shared skills. KRATOS is the lightweight edition of [GAIA](https://github.com/jlouage/Gaia-framework) (25 agents) — optimized for fast, low-token-cost workflows. GitHub Copilot support is provided separately through `.github/copilot-instructions.md` because Copilot does not consume Claude slash-command frontmatter.

## How to Start

The primary entry point is `/kratos` — this activates the orchestrator (Kratos) who routes you to the right agent or workflow. When model selection matters, Kratos should hand off to the exact slash command so Claude Code applies that command's model frontmatter. You do not need to memorize all commands.

**5 essential commands:**
- `/kratos` — Start here. Kratos shows categories and routes you.
- `/kratos-dev-story` — Implement a user story
- `/kratos-quick-spec` — Rapid spec for small changes
- `/kratos-quick-dev` — Rapid implementation of a quick spec
- `/kratos-help` — Context-sensitive help

## Responding to `/kratos-*` Commands

When any `/kratos-*` command is invoked:
1. Load `{project-root}/_kratos/core/engine/workflow.xml` — this is the execution engine
2. The command file specifies a workflow.yaml or agent.md to process
3. If a workflow: load the pre-resolved config from `_kratos/{module}/.resolved/` first; fall back to runtime resolution
4. Follow the engine instructions EXACTLY — execute steps in order, save outputs at checkpoints
5. Write a checkpoint to `_kratos/_memory/checkpoints/` after each significant step

## Framework Location

```
_kratos/                    # Framework root
├── core/                 # Engine, protocols, shared tasks
├── lifecycle/            # Product lifecycle (5 phases: analysis → deployment)
├── dev/                  # Developer agents (senior frontend/backend/fullstack) + shared skills (8)
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

## Global Rules (apply to ALL agents and workflows)

### Config Resolution
1. Check for pre-resolved config in `_kratos/{module}/.resolved/{workflow}.yaml`
2. If not found: load `workflow.yaml` → module `config.yaml` (which inherits `global.yaml`)
3. Resolve `{project-root}`, `{installed_path}`, system-generated values
4. After any config change, run `/kratos-build-configs` to regenerate resolved configs

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
- Write a checkpoint to `_kratos/_memory/checkpoints/` after each step completes
- Include: workflow name, step number, key variables, output file path
- Include `files_touched` with sha256 checksums (`shasum -a 256`) for every file created/modified during the workflow
- On resume: validate checksums — warn user of changed files, offer Proceed / Start fresh / Review
- If context is lost, `/kratos-resume` recovers from the last checkpoint

### Quality Gates
- Gates are **enforced**, not advisory — workflow HALTS on gate failure
- Pre-start gates must pass before workflow execution begins
- Post-complete gates must pass before marking a workflow done
- Never mark a task complete without all tests passing

**Testing integration gates (enforced):**
- `create-epics-stories` requires `test-plan.md` — run `/kratos-test-design` after architecture
- `implementation-readiness` requires `traceability-matrix.md` + `ci-setup.md` — run `/kratos-trace` + `/kratos-ci-setup`
- `dev-story` requires `atdd-{story_key}.md` for high-risk stories — run `/kratos-atdd`
- `deployment-checklist` requires traceability + CI + readiness report PASS
- `brownfield-onboarding` requires NFR assessment + performance test plan (output to `test-artifacts/`)

### Sprint-Status Write Safety
- **Story file is source of truth** — sprint-status.yaml is a derived/cached view
- **Review workflows (6)** MUST NOT write to sprint-status.yaml — update only the story file
- **All other workflows** MUST re-read sprint-status.yaml immediately before writing
- Running `/kratos-sprint-status` reconciles sprint-status.yaml with story files

## Naming Conventions

- Slash commands: `kratos-{action}` for workflows, `kratos-agent-{name}` for agents
- Workflow dirs: `{phase}/{workflow-name}/`
- Workflow files: `workflow.yaml` + `instructions.xml` + `checklist.md` + optional `template.md`
- Agent files: `{agent-id}.md` with XML `<agent>` block
- Skill files: `{skill-name}.md` in `_kratos/dev/skills/`
- Knowledge fragments: `{topic}.md` in `_kratos/{module}/knowledge/{category}/`

## Developer Agent System

- 3 role-based senior developers extend `_kratos/dev/agents/_base-dev.md`
- Senior roles: frontend (Avery), backend (Rowan), fullstack (Jordan)
- 8 shared skills: git-workflow, api-design, database-design, docker-workflow, testing-patterns, code-review-standards, documentation-standards, security-basics
- Skills use sectioned loading — only the sections needed by the current step are loaded

## Sprint State Machine

```
backlog → validating → ready-for-dev → in-progress → blocked → review → done
```

**Review Gate:** A story in `review` requires ALL six reviews to pass before moving to `done`:
- `/kratos-code-review` — APPROVE or REQUEST_CHANGES
- `/kratos-qa-tests` — PASSED or FAILED
- `/kratos-security-review` — PASSED or FAILED
- `/kratos-test-automate` — PASSED or FAILED
- `/kratos-test-review` — PASSED or FAILED
- `/kratos-review-perf` — PASSED or FAILED

Run `/kratos-run-all-reviews` to execute all six reviews sequentially via subagents — one command instead of six.

If any review fails, the story returns to `in-progress`. The Review Gate table in the story file tracks progress.

## Memory Hygiene

Agent memory sidecars accumulate decisions across sessions. Run `/kratos-memory-hygiene` periodically (recommended before each sprint) to detect stale, contradicted, or orphaned entries by cross-referencing sidecar decisions against current planning and architecture artifacts.

## Do Not

- Pre-load files — load at runtime when needed
- Skip steps in a workflow — execute ALL steps in order
- Proceed past a template-output without user confirmation (unless YOLO mode)
- Modify files outside the workflow's declared output locations
- Commit secrets, credentials, or .env files
- Create agent files over 200 lines — delegate depth to skills and knowledge fragments
- Chase config inheritance chains at runtime — use pre-resolved configs
- Load more than 40K tokens of framework content in a single activation
