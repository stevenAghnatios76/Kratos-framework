# KRATOS — Generative Agile Intelligence Architecture

[![Framework](https://img.shields.io/badge/framework-v1.27.4-blue)]()
[![License](https://img.shields.io/badge/license-AGPL--3.0-green)]()
[![Agents](https://img.shields.io/badge/agents-15-purple)]()
[![Workflows](https://img.shields.io/badge/workflows-64-orange)]()

AI agent framework for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and [GitHub Copilot](https://github.com/features/copilot) that orchestrates software product development through **15 specialized agents**, **64 workflows**, and **8 shared skills** — from initial research all the way to deployment.

KRATOS is a fork of the original GAIA framework. Upstream attribution: https://github.com/jlouage/Gaia-framework

> **KRATOS is the lightweight edition of GAIA.** It ships with 15 agents optimized for fast, low-token-cost development workflows. If you need the full 25-agent experience — including a dedicated Technical Writer (Iris), Data Engineer (Milo), Performance Specialist (Juno), and 6 individual Creative agents — use the [GAIA framework](https://github.com/jlouage/Gaia-framework), the parent project this was forked from.

### Why KRATOS?

Using Claude Code or GitHub Copilot alone, you prompt an AI assistant. With KRATOS, you manage a **team of AI specialists** that follow a proven product lifecycle:

- **Structured lifecycle** — 5 phases from analysis to deployment, with quality gates that enforce standards at every transition
- **15 specialized agents** — each with a persona, domain expertise, and persistent memory that improves over time
- **Built-in quality gates** — 17 enforced gates that HALT workflows when standards aren't met (not advisory — hard stops)
- **6-gate review process** — every story passes code review, QA, security, test automation, test review, and performance review before completion
- **Checkpoint/resume** — long-running workflows survive context loss with sha256-verified checkpoints
- **Brownfield support** — onboard existing codebases with automated discovery, documentation generation, and gap analysis

---

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (requires Anthropic account)
- Node.js 18+
- Git

## Editor Support

- Claude Code: full support, including `/kratos-*` slash commands and model-specific routing.
- GitHub Copilot: supported through repository instructions in `.github/copilot-instructions.md`. Copilot does not use Claude slash-command frontmatter, so use the documented KRATOS workflows and file conventions rather than expecting slash-command model routing.

---

## Quick Start

```bash
# Install KRATOS into your project
npx kratos-framework init ~/my-project

# Open in Claude Code
cd ~/my-project && claude

# Generate pre-resolved configs (one-time setup)
/kratos-build-configs
```

Then try your first workflow:

```bash
# Describe a small feature and get a tech spec in 30 seconds
/kratos-quick-spec

# Implement it immediately
/kratos-quick-dev
```

Or launch the orchestrator to explore all capabilities:

```bash
/kratos
```

### 5 essential commands

| Command | What it does |
|---------|-------------|
| `/kratos` | Launch the orchestrator — shows categories and routes you |
| `/kratos-dev-story` | Implement a user story end-to-end |
| `/kratos-quick-spec` | Create a rapid tech spec for small changes |
| `/kratos-quick-dev` | Implement a quick spec |
| `/kratos-help` | Context-sensitive help for wherever you are |

---

## Installation

### Using npx (recommended)

```bash
npx kratos-framework init .
```

```bash
# Install into a specific directory
npx kratos-framework init ~/my-new-project

# Skip interactive prompts
npx kratos-framework init --yes ~/my-project
```

### Using the shell script

```bash
git clone https://github.com/your-account/Kratos-framework.git
bash Kratos-framework/kratos-install.sh init ~/my-project
```

Replace `your-account` with your fork owner, or use `KRATOS_REPO_URL` with the published package.

### Installing from your fork or private mirror

```bash
KRATOS_REPO_URL=https://github.com/your-account/Kratos-framework.git npx kratos-framework init .
```

```bash
bash kratos-install.sh init --minimal .
```

### What the installer does

1. Copies the `_kratos/` framework into your project
2. Creates `docs/` artifact directories (planning, implementation, test, creative)
3. Creates memory sidecar directories
4. Prompts for project name and user name → writes to `global.yaml`
5. Copies `CLAUDE.md` to your project root
6. Installs 104 slash commands to `.claude/commands/`
7. Appends KRATOS entries to `.gitignore`
8. Supports a `--minimal` profile that installs only the core engine, quick-flow workflows, and senior developer entrypoints

### Updating

```bash
npx kratos-framework update .
```

Update refreshes all framework files while preserving your configuration, agent memory, and `CLAUDE.md`. Changed files are backed up to `_kratos/_backups/{timestamp}/`.

### Validating

```bash
npx kratos-framework validate .   # 32 integrity checks
npx kratos-framework status .     # version, module list, command count
```

---

## How It Works

### 5-phase product lifecycle

```
Phase 1: Analysis → Phase 2: Planning → Phase 3: Solutioning → Phase 4: Implementation → Phase 5: Deployment
   (Elena)           (Derek/Christy)      (Theo/Zara/Soren)      (Nate/Dev Agents)        (Soren)
```

Every phase has **quality gates** — enforced checks that halt the workflow if prerequisites aren't met. You can't create an architecture without a reviewed PRD. You can't start a sprint without a readiness check. You can't deploy without passing all reviews.

### Entry points

| Path | Command | When to use |
|------|---------|-------------|
| New project | Start at Phase 1 | Greenfield — building from scratch |
| Existing project | `/kratos-brownfield` | Brownfield — onboarding existing codebase |
| Small change | `/kratos-quick-spec` | Under 5 files, under 1 day |
| Resume | `/kratos-resume` | Continue after context loss |

### Model assignment

Each command declares which Claude model to use. **Opus** handles deep reasoning, architectural decisions, and complex analysis (27 commands). **Sonnet** handles structured generation, template-following, and status reporting (77 commands). Claude Code applies the model at slash-command invocation time, so `/kratos` and the agent menus hand you the exact slash command to run for the selected workflow.

### Execution modes

Workflows support three modes: **normal** (pauses for confirmation at each checkpoint), **YOLO** (auto-proceeds without pausing), and **planning** (presents a structured execution plan for approval before any steps run). You can switch between normal and YOLO mid-workflow.

---

## Agents

Every agent has a name, persona, and specialization. Activate any agent directly with `/kratos-agent-{name}` or let the orchestrator route you.

### Lifecycle Agents

| Agent | Name | Specialization | Command |
|-------|------|---------------|---------|
| Orchestrator | Kratos | Routes requests, manages resources | `/kratos` |
| Business Analyst | Elena | Market research, domain analysis, product briefs | `/kratos-agent-analyst` |
| Product Manager | Derek | PRDs, requirements, stakeholder alignment | `/kratos-agent-pm` |
| UX Designer | Christy | User research, interaction design, UI patterns | `/kratos-agent-ux-designer` |
| System Architect | Theo | Architecture design, technical decisions, readiness | `/kratos-agent-architect` |
| Scrum Master | Nate | Sprint planning, story prep, agile ceremonies | `/kratos-agent-sm` |
| QA Engineer | Vera | Test automation, API testing, E2E testing, performance review | `/kratos-agent-qa` |
| Security Expert | Zara | Threat modeling, OWASP reviews, compliance | `/kratos-agent-security` |
| DevOps Engineer | Soren | Infrastructure, deployment, rollback planning | `/kratos-agent-devops` |

### Developer Agents

All developer agents extend a shared base with common delivery rules. KRATOS now uses role-based senior developers instead of language-specific personas.

| Agent | Name | Focus | Command |
|-------|------|-------|---------|
| Senior Frontend Developer | Avery | UI architecture, accessibility, client-side performance | `/kratos-agent-senior-frontend` |
| Senior Backend Developer | Rowan | APIs, services, persistence, reliability | `/kratos-agent-senior-backend` |
| Senior Fullstack Developer | Jordan | Cross-cutting implementation and end-to-end delivery | `/kratos-agent-senior-fullstack` |

### Creative Agents

Six creative specializations are consolidated into two context-efficient composite agents. Each agent uses sectioned loading — only the relevant section is loaded per workflow invocation.

| Agent | Names | Specialization | Command |
|-------|-------|---------------|---------|
| Creative Ideation | Rex / Nova / Lyra | Brainstorming, problem-solving, design thinking | `/kratos-agent-brainstorming`, `/kratos-problem-solving`, `/kratos-design-thinking` |
| Creative Communications | Orion / Elara / Vermeer | Innovation strategy, storytelling, presentations | `/kratos-agent-innovation`, `/kratos-storytelling`, `/kratos-slide-deck` |

> For dedicated single-persona creative agents (Rex, Nova, Lyra, Orion, Elara, Vermeer as separate files), see [GAIA](https://github.com/jlouage/Gaia-framework).

### Testing Agent

| Agent | Name | Specialization | Command |
|-------|------|---------------|---------|
| Test Architect | Sable | Test architecture, risk-based testing, quality gates | `/kratos-agent-test-architect` |

---

## Workflows

Workflows are structured multi-step processes. Each has a `workflow.yaml` config, `instructions.xml` with step-by-step guidance, and a `checklist.md` for quality gates.

### Phase 1: Analysis

| Command | Workflow | Agent | Model | Output |
|---------|----------|-------|-------|--------|
| `/kratos-brainstorm` | Brainstorm Project | Elena | Sonnet | `docs/planning-artifacts/` |
| `/kratos-market-research` | Market Research | Elena | Sonnet | `docs/planning-artifacts/` |
| `/kratos-domain-research` | Domain Research | Elena | Sonnet | `docs/planning-artifacts/` |
| `/kratos-tech-research` | Technical Research | Elena | Sonnet | `docs/planning-artifacts/` |
| `/kratos-product-brief` | Create Product Brief | Elena | Sonnet | `docs/planning-artifacts/` |

### Phase 2: Planning

| Command | Workflow | Agent | Model | Output |
|---------|----------|-------|-------|--------|
| `/kratos-create-prd` | Create PRD | Derek | Opus | `docs/planning-artifacts/` |
| `/kratos-validate-prd` | Validate PRD | Derek | Sonnet | `docs/planning-artifacts/` |
| `/kratos-edit-prd` | Edit PRD | Derek | Opus | `docs/planning-artifacts/` |
| `/kratos-create-ux` | Create UX Design | Christy | Opus | `docs/planning-artifacts/` |

### Phase 3: Solutioning

| Command | Workflow | Agent | Model | Output |
|---------|----------|-------|-------|--------|
| `/kratos-create-arch` | Create Architecture | Theo | Opus | `docs/planning-artifacts/` |
| `/kratos-create-epics` | Create Epics & Stories | Derek | Opus | `docs/planning-artifacts/` |
| `/kratos-readiness-check` | Implementation Readiness | Theo | Opus | `docs/planning-artifacts/` |
| `/kratos-threat-model` | Security Threat Model | Zara | Opus | `docs/planning-artifacts/` |
| `/kratos-infra-design` | Infrastructure Design | Soren | Opus | `docs/planning-artifacts/` |

### Phase 4: Implementation

| Command | Workflow | Agent | Model | Output |
|---------|----------|-------|-------|--------|
| `/kratos-sprint-plan` | Sprint Planning | Nate | Sonnet | `docs/implementation-artifacts/` |
| `/kratos-sprint-status` | Sprint Status | Nate | Sonnet | `docs/implementation-artifacts/` |
| `/kratos-epic-status` | Epic Status | Nate | Sonnet | `docs/implementation-artifacts/` |
| `/kratos-create-story` | Create Story | Derek | Sonnet | `docs/implementation-artifacts/` |
| `/kratos-validate-story` | Validate Story | Derek | Sonnet | `docs/implementation-artifacts/` |
| `/kratos-fix-story` | Fix Story | Nate | Sonnet | `docs/implementation-artifacts/` |
| `/kratos-dev-story` | Dev Story | Stack dev | Opus | `docs/implementation-artifacts/` |
| `/kratos-code-review` | Code Review | Stack dev | Opus | `docs/implementation-artifacts/` |
| `/kratos-qa-tests` | QA Generate Tests | Vera | Opus | `docs/implementation-artifacts/` |
| `/kratos-security-review` | Security Review | Zara | Opus | `docs/implementation-artifacts/` |
| `/kratos-triage-findings` | Triage Findings | Nate | Sonnet | `docs/implementation-artifacts/` |
| `/kratos-tech-debt-review` | Tech Debt Review | Nate | Sonnet | `docs/implementation-artifacts/` |
| `/kratos-change-request` | Change Request | Derek | Opus | `docs/planning-artifacts/` |
| `/kratos-add-stories` | Add Stories | Derek | Sonnet | `docs/planning-artifacts/` |
| `/kratos-correct-course` | Correct Course | Nate | Sonnet | `docs/implementation-artifacts/` |
| `/kratos-retro` | Retrospective | Nate | Sonnet | `docs/implementation-artifacts/` |

### Phase 5: Deployment

| Command | Workflow | Agent | Model | Output |
|---------|----------|-------|-------|--------|
| `/kratos-release-plan` | Release Plan | Soren | Sonnet | `docs/implementation-artifacts/` |
| `/kratos-deploy-checklist` | Deployment Checklist | Soren | Sonnet | `docs/implementation-artifacts/` |
| `/kratos-post-deploy` | Post-Deploy Verify | Soren | Sonnet | `docs/implementation-artifacts/` |
| `/kratos-rollback-plan` | Rollback Plan | Soren | Sonnet | `docs/implementation-artifacts/` |

### Quick Flow

| Command | Workflow | Model | Description |
|---------|----------|-------|-------------|
| `/kratos-quick-spec` | Quick Spec | Sonnet | Rapid tech spec — skip full PRD |
| `/kratos-quick-dev` | Quick Dev | Sonnet | Implement a quick spec immediately |

### Creative Workflows

| Command | Workflow | Agent | Model | Output |
|---------|----------|-------|-------|--------|
| `/kratos-creative-sprint` | Creative Sprint | Multi-agent | Opus | `docs/creative-artifacts/` |
| `/kratos-design-thinking` | Design Thinking | Lyra | Opus | `docs/creative-artifacts/` |
| `/kratos-innovation` | Innovation Strategy | Orion | Opus | `docs/creative-artifacts/` |
| `/kratos-problem-solving` | Problem Solving | Nova | Opus | `docs/creative-artifacts/` |
| `/kratos-storytelling` | Storytelling | Elara | Sonnet | `docs/creative-artifacts/` |
| `/kratos-slide-deck` | Slide Deck | Vermeer | Sonnet | `docs/creative-artifacts/` |
| `/kratos-pitch-deck` | Pitch Deck | Vermeer | Sonnet | `docs/creative-artifacts/` |

### Testing Workflows

Testing workflows are **integrated into the main lifecycle** — they are not optional standalone tools.

| Command | Workflow | Agent | Model | Output |
|---------|----------|-------|-------|--------|
| `/kratos-test-design` | Test Design | Sable | Opus | `docs/test-artifacts/` |
| `/kratos-test-framework` | Test Framework | Sable | Sonnet | `docs/test-artifacts/` |
| `/kratos-atdd` | ATDD | Sable | Sonnet | `docs/test-artifacts/` |
| `/kratos-test-automate` | Test Automation | Sable | Sonnet | `docs/test-artifacts/` |
| `/kratos-test-review` | Test Review | Sable | Sonnet | `docs/test-artifacts/` |
| `/kratos-ci-setup` | CI Setup | Sable | Sonnet | `docs/test-artifacts/` |
| `/kratos-nfr` | NFR Assessment | Sable | Opus | `docs/test-artifacts/` |
| `/kratos-trace` | Traceability Matrix | Sable | Sonnet | `docs/test-artifacts/` |
| `/kratos-a11y-testing` | Accessibility Testing | Sable | Sonnet | `docs/test-artifacts/` |
| `/kratos-perf-testing` | Performance Testing | Sable | Sonnet | `docs/test-artifacts/` |
| `/kratos-mobile-testing` | Mobile Testing | Sable | Sonnet | `docs/test-artifacts/` |
| `/kratos-teach-testing` | Teach Me Testing | Sable | Sonnet | `docs/test-artifacts/` |

### Anytime Workflows

| Command | Workflow | Model | Description |
|---------|----------|-------|-------------|
| `/kratos-brownfield` | Brownfield Onboarding | Opus | 6-step orchestration with subagents for existing projects |
| `/kratos-document-project` | Document Project | Sonnet | Document a project for AI context |
| `/kratos-project-context` | Generate Project Context | Sonnet | Generate context for AI consumption |
| `/kratos-performance-review` | Performance Review | Opus | Analyze performance bottlenecks |
| `/kratos-brainstorming` | Brainstorming | Sonnet | Facilitated brainstorming session |
| `/kratos-party` | Party Mode | Sonnet | Multi-agent group discussion |
| `/kratos-advanced-elicitation` | Advanced Elicitation | Opus | Deep requirements elicitation |
| `/kratos-memory-hygiene` | Memory Hygiene | Sonnet | Detect stale decisions in agent memory |

### Review & Utility Tasks

| Command | Task | Model | Description |
|---------|------|-------|-------------|
| `/kratos-adversarial` | Adversarial Review | Opus | Cynical critical review from 10 perspectives — finds weaknesses |
| `/kratos-edge-cases` | Edge Case Hunter | Opus | Identify edge cases and boundary conditions |
| `/kratos-review-security` | Security Review | Opus | OWASP-focused security review |
| `/kratos-review-api` | API Design Review | Opus | Review REST API against standards |
| `/kratos-review-deps` | Dependency Audit | Sonnet | Scan dependencies for vulnerabilities |
| `/kratos-review-a11y` | Accessibility Review | Sonnet | WCAG 2.1 compliance review |
| `/kratos-review-perf` | Performance Review | Opus | Code-level performance review |
| `/kratos-editorial-prose` | Editorial Prose | Sonnet | Clinical copy-editing review |
| `/kratos-editorial-structure` | Editorial Structure | Sonnet | Structural editing review |
| `/kratos-summarize` | Summarize Document | Sonnet | Generate executive summary |
| `/kratos-index-docs` | Index Docs | Sonnet | Generate document index for a folder |
| `/kratos-shard-doc` | Shard Document | Sonnet | Split large docs into sections |
| `/kratos-merge-docs` | Merge Documents | Sonnet | Merge multiple markdown files |
| `/kratos-changelog` | Generate Changelog | Sonnet | Changelog from git history |

### Framework Utilities

| Command | Task | Model | Description |
|---------|------|-------|-------------|
| `/kratos-build-configs` | Build Configs | Sonnet | Regenerate pre-resolved config files |
| `/kratos-validate-framework` | Validate Framework | Sonnet | Self-validation and consistency check |
| `/kratos-resume` | Resume | Sonnet | Resume from last checkpoint after context loss |
| `/kratos-run-all-reviews` | Run All Reviews | Sonnet | Execute all 6 review gate checks sequentially |

---

## Typical Workflow

### Greenfield — new project from idea to deployment

```
# Phase 1: Analysis
/kratos-brainstorm             → brainstorm the idea
/kratos-product-brief          → create a product brief

# Phase 2: Planning
/kratos-create-prd             → write the PRD
/kratos-create-ux              → design the UX

# Phase 3: Solutioning
/kratos-create-arch            → design the architecture
/kratos-test-design            → create test plan
/kratos-create-epics           → break into epics and stories
/kratos-trace                  → generate traceability matrix
/kratos-ci-setup               → scaffold CI pipeline
/kratos-readiness-check        → verify everything is ready

# Phase 4: Implementation (repeat per sprint)
/kratos-sprint-plan            → plan the sprint
/kratos-dev-story              → implement stories
/kratos-run-all-reviews        → run all 6 review gates
/kratos-retro                  → sprint retrospective

# Phase 5: Deployment
/kratos-deploy-checklist       → pre-deploy verification
/kratos-post-deploy            → post-deploy health check
```

For **brownfield projects** (existing codebases), start with `/kratos-brownfield` — a 6-step orchestration that scans your codebase, generates documentation (APIs, UX, events, dependencies, NFR baselines), creates a gap-focused PRD, and maps the architecture. Then continue from Phase 3 above.

---

## Architecture

```
_kratos/
├── _config/              # Global config, manifests
│   ├── global.yaml       # Project settings — single source of truth
│   └── manifest.yaml     # Module versions
├── _memory/              # Persistent agent memory + checkpoints
│   ├── checkpoints/      # Workflow progress snapshots (sha256-verified)
│   └── *-sidecar/        # Per-agent persistent memory (9 sidecars)
├── core/                 # Execution engine, protocols, shared tasks
│   └── engine/           # workflow.xml (7-step flow), task-runner.xml
├── lifecycle/            # 5 phases: analysis → deployment
│   ├── agents/           # 9 lifecycle agents
│   ├── workflows/        # 36 workflows across 5 phases
│   └── templates/        # 18 document templates
├── dev/                  # Developer tooling
│   ├── agents/           # 3 senior developers + base
│   ├── skills/           # 8 shared skills (sectioned loading)
│   └── knowledge/        # Stack-specific patterns
├── creative/             # 2 composite creative agents + 7 workflows
└── testing/              # Test Architect + 12 testing workflows
```

### At a glance

| Component | Count |
|-----------|-------|
| Agents | 15 with distinct personas (25 in [GAIA](https://github.com/jlouage/Gaia-framework)) |
| Workflows | 64 across 5 lifecycle phases |
| Standalone tasks | 15 (reviews, audits, utilities) |
| Slash commands | 104 |
| Shared skills | 8 with 47 loadable sections |
| Knowledge fragments | 45 |
| Document templates | 18 |
| Quality gates | 17 (enforced, not advisory) |

---

## Configuration

The single source of truth is `_kratos/_config/global.yaml`:

```yaml
framework_name: "KRATOS"
framework_version: "1.27.4"
user_name: "your-name"
project_name: "your-project"
```

After changing `global.yaml`, run `/kratos-build-configs` to regenerate pre-resolved configs. Each module has a `.resolved/` directory that eliminates runtime config resolution overhead.

---

## Checkpoint & Resume

Long-running workflows save checkpoints to `_kratos/_memory/checkpoints/` with sha256 checksums of all files touched. If your session is interrupted, run `/kratos-resume` — it validates file integrity before resuming from the last completed step.

---

## Agent Memory

Each agent has a persistent memory sidecar (`_kratos/_memory/*-sidecar/`) that stores decisions, patterns, and context across sessions. Agents become more effective the more you use them. Run `/kratos-memory-hygiene` periodically to detect stale or contradicted decisions.

---

## Limitations

- **Single-user only** — KRATOS uses markdown files for state management (stories, sprint status, architecture docs). Multiple team members editing the same project will run into file conflicts.
- **Claude Code required** — KRATOS is built specifically for Claude Code and cannot run on other AI coding assistants.
- **Context budget** — Complex workflows can consume significant context. The framework enforces a 40K token budget per activation with just-in-time loading to manage this, but very large projects may hit limits.

---

## Contributing

Contributions are welcome. Please open an issue to discuss your idea before submitting a PR.

By contributing, you agree that your contributions will be licensed under the same AGPL-3.0 license and that you grant the project maintainers the right to relicense your contributions under a commercial license (CLA).

---

## License

[AGPL-3.0](LICENSE)

The open-source framework is licensed under the GNU Affero General Public License v3.0. 
