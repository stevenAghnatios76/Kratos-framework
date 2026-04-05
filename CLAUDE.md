# Kratos Framework v1.27.57

This project uses the **KRATOS** (Generative Agile Intelligence Architecture) framework — an AI agent framework for Claude Code that orchestrates software product development through 15 operational agents, 71 workflows, and 8 shared skills — optimized for fast, low-token-cost workflows. GitHub Copilot support is provided separately through `.github/copilot-instructions.md` because Copilot does not consume Claude slash-command frontmatter.

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
3. If a workflow: prefer the pre-resolved config from `_kratos/{module}/.resolved/` when present; otherwise fall back to runtime resolution
4. Follow the engine instructions EXACTLY — the engine is the source of truth for step order, checkpoints, execution modes, and gates
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
3. Resolve `{project-root}`, `{project-path}`, `{memory_path}`, `{checkpoint_path}`, `{installed_path}`, system-generated values
4. After any config change, run `/kratos-build-configs` to regenerate resolved configs
5. Do not assume `.resolved/` exists in every checkout — fallback resolution must remain valid

### Context Budget
- **40K token max** for framework content per activation
- Never pre-load skills or knowledge fragments — load JIT when a step references them
- Use sectioned skill loading when only a subset of a skill is needed
- Release prior step content before loading the next step
- Agent persona files: max 200 lines
- Instruction step files: max 150 lines each
- Skill files: max 300 lines (or load individual sections at ~50 lines each)

### Markdown Size Limit
- Any `.md` file must stay at or under **1000 lines**
- If a markdown file would exceed 1000 lines, split it into multiple files before finalizing it
- Once the limit is crossed, create at least 2 markdown files and keep every resulting markdown file at or under 1000 lines
- Prefer structured sharding with an `index.md` and section-based files via `/kratos-shard-doc`

### Step Execution
- Keep this file brief and defer detailed execution behavior to `_kratos/core/engine/workflow.xml`
- Core invariants remain: execute steps in order, read full instruction files, save template outputs, and respect normal/YOLO/planning modes

### Checkpoint Discipline
- Write a checkpoint to `_kratos/_memory/checkpoints/` after each step completes
- Include workflow name, step number, key variables, output file path, and `files_touched` checksums
- On resume, validate checksums before continuing
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
- **All status transitions** MUST use the `status-sync` protocol (`_kratos/core/protocols/status-sync.xml`) — this updates the story file, sprint-status.yaml, and story-index.yaml atomically
- **Review workflows (6)** update only the Review Gate table — the `review-gate-check` protocol handles the `review → done` transition via status-sync
- Running `/kratos-sprint-status` reconciles sprint-status.yaml with story files (catches any remaining drift)

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
- `/kratos-performance-review` — PASSED or FAILED

Run `/kratos-run-all-reviews` to execute all six reviews sequentially via subagents — one command instead of six.

If any review fails, the story remains in `review` until the failed reviews are fixed and re-run. The Review Gate table in the story file tracks progress.

Use `/kratos-check-review-gate` to inspect gate status without re-running reviews. Use `/kratos-check-dod` to validate Definition of Done before submitting for review. Use `/kratos-action-items` to process and resolve action items from retros, triage, and tech-debt reviews.

### Additional Workflows

- `/kratos-edit-architecture` — Edit an existing architecture document (phase 3, solutioning)
- `/kratos-edit-ux-design` — Edit an existing UX design document (phase 2, planning)
- `/kratos-validate-prd` — Validate a PRD against standards (phase 2, planning)
- `/kratos-advanced-elicitation` — Deep requirements elicitation using structured questioning techniques (phase 1, analysis)

### Infra Review Gate Substitutions

For infrastructure stories (those whose `traces_to` field contains `IR-###`, `OR-###`, or `SR-###` requirement IDs), 4 of the 6 review gates use adapted criteria. Code Review and Security Review remain unchanged for all story types.

| Standard Gate | Infra Equivalent | Change |
|---|---|---|
| Code Review | IaC Code Review | Unchanged — same workflow, IaC expertise expected |
| QA Tests | Policy-as-Code Validation | Checkov/tfsec/OPA pass replaces unit/integration test pass |
| Security Review | Security Review | Unchanged — critical for infrastructure |
| Test Automation | Plan Validation + Drift Checks | terraform plan assertions replace automated test coverage |
| Test Review | Policy Review | OPA/Rego coverage replaces test quality review |
| Performance Review | Cost Review + Scaling Validation | Cost analysis and autoscaling validation replace load testing |

**Detection mechanism:** The `review-gate-check` protocol reads the story's `traces_to` field and checks the requirement ID prefix. Each story is evaluated independently — platform projects with mixed stories get per-story gate selection based on their own requirement prefix.

## Project Path

KRATOS supports separating the framework from the application source code. The `project_path` setting in `global.yaml` controls where application code lives:

- `project_path: "."` (default) — project code lives at the root alongside `_kratos/`. This is backward compatible.
- `project_path: "my-app"` — project code lives in a subdirectory. KRATOS framework stays at root, code goes in `my-app/`.

**Resolved variables:**
- `{project-root}` — always the root directory where `_kratos/` lives. Used for framework paths, docs, and artifacts.
- `{project-path}` — where application source code lives. Equals `{project-root}` if project_path is `"."`, otherwise `{project-root}/{project_path}`.

**Rules:**
- Dev agents MUST write application code to `{project-path}`, not `{project-root}`
- Brownfield onboarding scans `{project-path}` for codebase discovery
- Framework artifacts (docs/, _kratos/) always stay at `{project-root}`
- Commands like `npm install`, `git`, test runners use `{project-path}` as working directory

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
