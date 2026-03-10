# GAIA — Generative Agile Intelligence Architecture

[![Framework](https://img.shields.io/badge/framework-v1.27.1-blue)]()
[![License](https://img.shields.io/badge/license-AGPL--3.0-green)]()
[![Agents](https://img.shields.io/badge/agents-25-purple)]()
[![Workflows](https://img.shields.io/badge/workflows-64-orange)]()

AI agent framework for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) that orchestrates software product development through **25 specialized agents**, **64 workflows**, and **8 shared skills** — from initial research all the way to deployment.

![GAIA Lifecycle Activity Diagram](GAIA_v1.27.0_Lifecycle_Activity_Diagram.png)

### Why GAIA?

Using Claude Code alone, you prompt an AI assistant. With GAIA, you manage a **team of AI specialists** that follow a proven product lifecycle:

- **Structured lifecycle** — 5 phases from analysis to deployment, with quality gates that enforce standards at every transition
- **25 specialized agents** — each with a persona, domain expertise, and persistent memory that improves over time
- **Built-in quality gates** — 17 enforced gates that HALT workflows when standards aren't met (not advisory — hard stops)
- **6-gate review process** — every story passes code review, QA, security, test automation, test review, and performance review before completion
- **Checkpoint/resume** — long-running workflows survive context loss with sha256-verified checkpoints
- **Brownfield support** — onboard existing codebases with automated discovery, documentation generation, and gap analysis

---

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (requires Anthropic account)
- Node.js 18+
- Git

---

## Quick Start

```bash
# Install GAIA into your project
npx gaia-framework init ~/my-project

# Open in Claude Code
cd ~/my-project && claude

# Generate pre-resolved configs (one-time setup)
/gaia-build-configs
```

Then try your first workflow:

```bash
# Describe a small feature and get a tech spec in 30 seconds
/gaia-quick-spec

# Implement it immediately
/gaia-quick-dev
```

Or launch the orchestrator to explore all capabilities:

```bash
/gaia
```

### 5 essential commands

| Command | What it does |
|---------|-------------|
| `/gaia` | Launch the orchestrator — shows categories and routes you |
| `/gaia-dev-story` | Implement a user story end-to-end |
| `/gaia-quick-spec` | Create a rapid tech spec for small changes |
| `/gaia-quick-dev` | Implement a quick spec |
| `/gaia-help` | Context-sensitive help for wherever you are |

---

## Installation

### Using npx (recommended)

```bash
npx gaia-framework init .
```

```bash
# Install into a specific directory
npx gaia-framework init ~/my-new-project

# Skip interactive prompts
npx gaia-framework init --yes ~/my-project
```

### Using the shell script

```bash
git clone https://github.com/J-louage/Gaia-framework.git
bash Gaia-framework/gaia-install.sh init ~/my-project
```

### What the installer does

1. Copies the `_gaia/` framework into your project
2. Creates `docs/` artifact directories (planning, implementation, test, creative)
3. Creates memory sidecar directories
4. Prompts for project name and user name → writes to `global.yaml`
5. Copies `CLAUDE.md` to your project root
6. Installs 104 slash commands to `.claude/commands/`
7. Appends GAIA entries to `.gitignore`

### Updating

```bash
npx gaia-framework update .
```

Update refreshes all framework files while preserving your configuration, agent memory, and `CLAUDE.md`. Changed files are backed up to `_gaia/_backups/{timestamp}/`.

### Validating

```bash
npx gaia-framework validate .   # 32 integrity checks
npx gaia-framework status .     # version, module list, command count
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
| Existing project | `/gaia-brownfield` | Brownfield — onboarding existing codebase |
| Small change | `/gaia-quick-spec` | Under 5 files, under 1 day |
| Resume | `/gaia-resume` | Continue after context loss |

### Model assignment

Each command declares which Claude model to use. **Opus** handles deep reasoning, architectural decisions, and complex analysis (27 commands). **Sonnet** handles structured generation, template-following, and status reporting (77 commands). Claude Code auto-selects the model per workflow.

### Execution modes

Workflows support three modes: **normal** (pauses for confirmation at each checkpoint), **YOLO** (auto-proceeds without pausing), and **planning** (presents a structured execution plan for approval before any steps run). You can switch between normal and YOLO mid-workflow.

---

## Agents

Every agent has a name, persona, and specialization. Activate any agent directly with `/gaia-agent-{name}` or let the orchestrator route you.

### Lifecycle Agents

| Agent | Name | Specialization | Command |
|-------|------|---------------|---------|
| Orchestrator | Gaia | Routes requests, manages resources | `/gaia` |
| Business Analyst | Elena | Market research, domain analysis, product briefs | `/gaia-agent-analyst` |
| Product Manager | Derek | PRDs, requirements, stakeholder alignment | `/gaia-agent-pm` |
| UX Designer | Christy | User research, interaction design, UI patterns | `/gaia-agent-ux-designer` |
| System Architect | Theo | Architecture design, technical decisions, readiness | `/gaia-agent-architect` |
| Scrum Master | Nate | Sprint planning, story prep, agile ceremonies | `/gaia-agent-sm` |
| QA Engineer | Vera | Test automation, API testing, E2E testing | `/gaia-agent-qa` |
| Technical Writer | Iris | Documentation, diagrams, editorial reviews | `/gaia-agent-tech-writer` |
| Security Expert | Zara | Threat modeling, OWASP reviews, compliance | `/gaia-agent-security` |
| DevOps Engineer | Soren | Infrastructure, deployment, rollback planning | `/gaia-agent-devops` |
| Data Engineer | Milo | Schema design, ETL guidance, data quality | `/gaia-agent-data-engineer` |
| Performance Specialist | Juno | Load testing, profiling, Core Web Vitals | `/gaia-agent-performance` |

### Developer Agents

All developer agents extend a shared base with common dev patterns. Each adds stack-specific knowledge.

| Agent | Name | Stack | Command |
|-------|------|-------|---------|
| TypeScript Dev | Cleo | React, Next.js, Express | `/gaia-agent-dev-typescript` |
| Angular Dev | Lena | Angular, RxJS, NgRx | `/gaia-agent-dev-angular` |
| Flutter Dev | Freya | Flutter, Dart, cross-platform | `/gaia-agent-dev-flutter` |
| Java Dev | Hugo | Spring Boot, JPA, microservices | `/gaia-agent-dev-java` |
| Python Dev | Ravi | Django, FastAPI, data pipelines | `/gaia-agent-dev-python` |
| Mobile Dev | Talia | React Native, Swift, Kotlin | `/gaia-agent-dev-mobile` |

### Creative Agents

| Agent | Name | Specialization | Command |
|-------|------|---------------|---------|
| Brainstorming Coach | Rex | Facilitated ideation, creative techniques | `/gaia-agent-brainstorming` |
| Problem Solver | Nova | Systematic problem-solving, root cause analysis | `/gaia-agent-problem-solver` |
| Design Thinking Coach | Lyra | Human-centered design, empathy mapping | `/gaia-agent-design-thinking` |
| Innovation Strategist | Orion | Business model innovation, disruption strategy | `/gaia-agent-innovation` |
| Storyteller | Elara | Narrative crafting, story frameworks | `/gaia-agent-storyteller` |
| Presentation Designer | Vermeer | Slide decks, visual communication | `/gaia-agent-presentation` |

### Testing Agent

| Agent | Name | Specialization | Command |
|-------|------|---------------|---------|
| Test Architect | Sable | Test architecture, risk-based testing, quality gates | `/gaia-agent-test-architect` |

---

## Workflows

Workflows are structured multi-step processes. Each has a `workflow.yaml` config, `instructions.xml` with step-by-step guidance, and a `checklist.md` for quality gates.

### Phase 1: Analysis

| Command | Workflow | Agent | Model | Output |
|---------|----------|-------|-------|--------|
| `/gaia-brainstorm` | Brainstorm Project | Elena | Sonnet | `docs/planning-artifacts/` |
| `/gaia-market-research` | Market Research | Elena | Sonnet | `docs/planning-artifacts/` |
| `/gaia-domain-research` | Domain Research | Elena | Sonnet | `docs/planning-artifacts/` |
| `/gaia-tech-research` | Technical Research | Elena | Sonnet | `docs/planning-artifacts/` |
| `/gaia-product-brief` | Create Product Brief | Elena | Sonnet | `docs/planning-artifacts/` |

### Phase 2: Planning

| Command | Workflow | Agent | Model | Output |
|---------|----------|-------|-------|--------|
| `/gaia-create-prd` | Create PRD | Derek | Opus | `docs/planning-artifacts/` |
| `/gaia-validate-prd` | Validate PRD | Derek | Sonnet | `docs/planning-artifacts/` |
| `/gaia-edit-prd` | Edit PRD | Derek | Opus | `docs/planning-artifacts/` |
| `/gaia-create-ux` | Create UX Design | Christy | Opus | `docs/planning-artifacts/` |

### Phase 3: Solutioning

| Command | Workflow | Agent | Model | Output |
|---------|----------|-------|-------|--------|
| `/gaia-create-arch` | Create Architecture | Theo | Opus | `docs/planning-artifacts/` |
| `/gaia-create-epics` | Create Epics & Stories | Derek | Opus | `docs/planning-artifacts/` |
| `/gaia-readiness-check` | Implementation Readiness | Theo | Opus | `docs/planning-artifacts/` |
| `/gaia-threat-model` | Security Threat Model | Zara | Opus | `docs/planning-artifacts/` |
| `/gaia-infra-design` | Infrastructure Design | Soren | Opus | `docs/planning-artifacts/` |

### Phase 4: Implementation

| Command | Workflow | Agent | Model | Output |
|---------|----------|-------|-------|--------|
| `/gaia-sprint-plan` | Sprint Planning | Nate | Sonnet | `docs/implementation-artifacts/` |
| `/gaia-sprint-status` | Sprint Status | Nate | Sonnet | `docs/implementation-artifacts/` |
| `/gaia-epic-status` | Epic Status | Nate | Sonnet | `docs/implementation-artifacts/` |
| `/gaia-create-story` | Create Story | Derek | Sonnet | `docs/implementation-artifacts/` |
| `/gaia-validate-story` | Validate Story | Derek | Sonnet | `docs/implementation-artifacts/` |
| `/gaia-fix-story` | Fix Story | Nate | Sonnet | `docs/implementation-artifacts/` |
| `/gaia-dev-story` | Dev Story | Stack dev | Opus | `docs/implementation-artifacts/` |
| `/gaia-code-review` | Code Review | Stack dev | Opus | `docs/implementation-artifacts/` |
| `/gaia-qa-tests` | QA Generate Tests | Vera | Opus | `docs/implementation-artifacts/` |
| `/gaia-security-review` | Security Review | Zara | Opus | `docs/implementation-artifacts/` |
| `/gaia-triage-findings` | Triage Findings | Nate | Sonnet | `docs/implementation-artifacts/` |
| `/gaia-tech-debt-review` | Tech Debt Review | Nate | Sonnet | `docs/implementation-artifacts/` |
| `/gaia-change-request` | Change Request | Derek | Opus | `docs/planning-artifacts/` |
| `/gaia-add-stories` | Add Stories | Derek | Sonnet | `docs/planning-artifacts/` |
| `/gaia-correct-course` | Correct Course | Nate | Sonnet | `docs/implementation-artifacts/` |
| `/gaia-retro` | Retrospective | Nate | Sonnet | `docs/implementation-artifacts/` |

### Phase 5: Deployment

| Command | Workflow | Agent | Model | Output |
|---------|----------|-------|-------|--------|
| `/gaia-release-plan` | Release Plan | Soren | Sonnet | `docs/implementation-artifacts/` |
| `/gaia-deploy-checklist` | Deployment Checklist | Soren | Sonnet | `docs/implementation-artifacts/` |
| `/gaia-post-deploy` | Post-Deploy Verify | Soren | Sonnet | `docs/implementation-artifacts/` |
| `/gaia-rollback-plan` | Rollback Plan | Soren | Sonnet | `docs/implementation-artifacts/` |

### Quick Flow

| Command | Workflow | Model | Description |
|---------|----------|-------|-------------|
| `/gaia-quick-spec` | Quick Spec | Sonnet | Rapid tech spec — skip full PRD |
| `/gaia-quick-dev` | Quick Dev | Sonnet | Implement a quick spec immediately |

### Creative Workflows

| Command | Workflow | Agent | Model | Output |
|---------|----------|-------|-------|--------|
| `/gaia-creative-sprint` | Creative Sprint | Multi-agent | Opus | `docs/creative-artifacts/` |
| `/gaia-design-thinking` | Design Thinking | Lyra | Opus | `docs/creative-artifacts/` |
| `/gaia-innovation` | Innovation Strategy | Orion | Opus | `docs/creative-artifacts/` |
| `/gaia-problem-solving` | Problem Solving | Nova | Opus | `docs/creative-artifacts/` |
| `/gaia-storytelling` | Storytelling | Elara | Sonnet | `docs/creative-artifacts/` |
| `/gaia-slide-deck` | Slide Deck | Vermeer | Sonnet | `docs/creative-artifacts/` |
| `/gaia-pitch-deck` | Pitch Deck | Vermeer | Sonnet | `docs/creative-artifacts/` |

### Testing Workflows

Testing workflows are **integrated into the main lifecycle** — they are not optional standalone tools.

| Command | Workflow | Agent | Model | Output |
|---------|----------|-------|-------|--------|
| `/gaia-test-design` | Test Design | Sable | Opus | `docs/test-artifacts/` |
| `/gaia-test-framework` | Test Framework | Sable | Sonnet | `docs/test-artifacts/` |
| `/gaia-atdd` | ATDD | Sable | Sonnet | `docs/test-artifacts/` |
| `/gaia-test-automate` | Test Automation | Sable | Sonnet | `docs/test-artifacts/` |
| `/gaia-test-review` | Test Review | Sable | Sonnet | `docs/test-artifacts/` |
| `/gaia-ci-setup` | CI Setup | Sable | Sonnet | `docs/test-artifacts/` |
| `/gaia-nfr` | NFR Assessment | Sable | Opus | `docs/test-artifacts/` |
| `/gaia-trace` | Traceability Matrix | Sable | Sonnet | `docs/test-artifacts/` |
| `/gaia-a11y-testing` | Accessibility Testing | Sable | Sonnet | `docs/test-artifacts/` |
| `/gaia-perf-testing` | Performance Testing | Sable | Sonnet | `docs/test-artifacts/` |
| `/gaia-mobile-testing` | Mobile Testing | Sable | Sonnet | `docs/test-artifacts/` |
| `/gaia-teach-testing` | Teach Me Testing | Sable | Sonnet | `docs/test-artifacts/` |

### Anytime Workflows

| Command | Workflow | Model | Description |
|---------|----------|-------|-------------|
| `/gaia-brownfield` | Brownfield Onboarding | Opus | 6-step orchestration with subagents for existing projects |
| `/gaia-document-project` | Document Project | Sonnet | Document a project for AI context |
| `/gaia-project-context` | Generate Project Context | Sonnet | Generate context for AI consumption |
| `/gaia-performance-review` | Performance Review | Opus | Analyze performance bottlenecks |
| `/gaia-brainstorming` | Brainstorming | Sonnet | Facilitated brainstorming session |
| `/gaia-party` | Party Mode | Sonnet | Multi-agent group discussion |
| `/gaia-advanced-elicitation` | Advanced Elicitation | Opus | Deep requirements elicitation |
| `/gaia-memory-hygiene` | Memory Hygiene | Sonnet | Detect stale decisions in agent memory |

### Review & Utility Tasks

| Command | Task | Model | Description |
|---------|------|-------|-------------|
| `/gaia-adversarial` | Adversarial Review | Opus | Cynical critical review from 10 perspectives — finds weaknesses |
| `/gaia-edge-cases` | Edge Case Hunter | Opus | Identify edge cases and boundary conditions |
| `/gaia-review-security` | Security Review | Opus | OWASP-focused security review |
| `/gaia-review-api` | API Design Review | Opus | Review REST API against standards |
| `/gaia-review-deps` | Dependency Audit | Sonnet | Scan dependencies for vulnerabilities |
| `/gaia-review-a11y` | Accessibility Review | Sonnet | WCAG 2.1 compliance review |
| `/gaia-review-perf` | Performance Review | Opus | Code-level performance review |
| `/gaia-editorial-prose` | Editorial Prose | Sonnet | Clinical copy-editing review |
| `/gaia-editorial-structure` | Editorial Structure | Sonnet | Structural editing review |
| `/gaia-summarize` | Summarize Document | Sonnet | Generate executive summary |
| `/gaia-index-docs` | Index Docs | Sonnet | Generate document index for a folder |
| `/gaia-shard-doc` | Shard Document | Sonnet | Split large docs into sections |
| `/gaia-merge-docs` | Merge Documents | Sonnet | Merge multiple markdown files |
| `/gaia-changelog` | Generate Changelog | Sonnet | Changelog from git history |

### Framework Utilities

| Command | Task | Model | Description |
|---------|------|-------|-------------|
| `/gaia-build-configs` | Build Configs | Sonnet | Regenerate pre-resolved config files |
| `/gaia-validate-framework` | Validate Framework | Sonnet | Self-validation and consistency check |
| `/gaia-resume` | Resume | Sonnet | Resume from last checkpoint after context loss |
| `/gaia-run-all-reviews` | Run All Reviews | Sonnet | Execute all 6 review gate checks sequentially |

---

## Typical Workflow

### Greenfield — new project from idea to deployment

```
# Phase 1: Analysis
/gaia-brainstorm             → brainstorm the idea
/gaia-product-brief          → create a product brief

# Phase 2: Planning
/gaia-create-prd             → write the PRD
/gaia-create-ux              → design the UX

# Phase 3: Solutioning
/gaia-create-arch            → design the architecture
/gaia-test-design            → create test plan
/gaia-create-epics           → break into epics and stories
/gaia-trace                  → generate traceability matrix
/gaia-ci-setup               → scaffold CI pipeline
/gaia-readiness-check        → verify everything is ready

# Phase 4: Implementation (repeat per sprint)
/gaia-sprint-plan            → plan the sprint
/gaia-dev-story              → implement stories
/gaia-run-all-reviews        → run all 6 review gates
/gaia-retro                  → sprint retrospective

# Phase 5: Deployment
/gaia-deploy-checklist       → pre-deploy verification
/gaia-post-deploy            → post-deploy health check
```

For **brownfield projects** (existing codebases), start with `/gaia-brownfield` — a 6-step orchestration that scans your codebase, generates documentation (APIs, UX, events, dependencies, NFR baselines), creates a gap-focused PRD, and maps the architecture. Then continue from Phase 3 above.

---

## Architecture

```
_gaia/
├── _config/              # Global config, manifests
│   ├── global.yaml       # Project settings — single source of truth
│   └── manifest.yaml     # Module versions
├── _memory/              # Persistent agent memory + checkpoints
│   ├── checkpoints/      # Workflow progress snapshots (sha256-verified)
│   └── *-sidecar/        # Per-agent persistent memory (9 sidecars)
├── core/                 # Execution engine, protocols, shared tasks
│   └── engine/           # workflow.xml (7-step flow), task-runner.xml
├── lifecycle/            # 5 phases: analysis → deployment
│   ├── agents/           # 11 lifecycle agents
│   ├── workflows/        # 36 workflows across 5 phases
│   └── templates/        # 18 document templates
├── dev/                  # Developer tooling
│   ├── agents/           # 6 stack-specific developers
│   ├── skills/           # 8 shared skills (sectioned loading)
│   └── knowledge/        # Stack-specific patterns
├── creative/             # 6 creative agents + 7 workflows
└── testing/              # Test Architect + 12 testing workflows
```

### At a glance

| Component | Count |
|-----------|-------|
| Agents | 25 with distinct personas |
| Workflows | 64 across 5 lifecycle phases |
| Standalone tasks | 15 (reviews, audits, utilities) |
| Slash commands | 104 |
| Shared skills | 8 with 47 loadable sections |
| Knowledge fragments | 45 |
| Document templates | 18 |
| Quality gates | 17 (enforced, not advisory) |

---

## Configuration

The single source of truth is `_gaia/_config/global.yaml`:

```yaml
framework_name: "GAIA"
framework_version: "1.27.1"
user_name: "your-name"
project_name: "your-project"
```

After changing `global.yaml`, run `/gaia-build-configs` to regenerate pre-resolved configs. Each module has a `.resolved/` directory that eliminates runtime config resolution overhead.

---

## Checkpoint & Resume

Long-running workflows save checkpoints to `_gaia/_memory/checkpoints/` with sha256 checksums of all files touched. If your session is interrupted, run `/gaia-resume` — it validates file integrity before resuming from the last completed step.

---

## Agent Memory

Each agent has a persistent memory sidecar (`_gaia/_memory/*-sidecar/`) that stores decisions, patterns, and context across sessions. Agents become more effective the more you use them. Run `/gaia-memory-hygiene` periodically to detect stale or contradicted decisions.

---

## Limitations

- **Single-user only** — GAIA uses markdown files for state management (stories, sprint status, architecture docs). Multiple team members editing the same project will run into file conflicts.
- **Claude Code required** — GAIA is built specifically for Claude Code and cannot run on other AI coding assistants.
- **Context budget** — Complex workflows can consume significant context. The framework enforces a 40K token budget per activation with just-in-time loading to manage this, but very large projects may hit limits.

---

## Contributing

Contributions are welcome. Please open an issue to discuss your idea before submitting a PR.

By contributing, you agree that your contributions will be licensed under the same AGPL-3.0 license and that you grant the project maintainers the right to relicense your contributions under a commercial license (CLA).

---

## License

[AGPL-3.0](LICENSE)

The open-source framework is licensed under the GNU Affero General Public License v3.0. A commercial license is available for teams and enterprises that want to use GAIA without AGPL obligations or connect to the GAIA SaaS platform.
