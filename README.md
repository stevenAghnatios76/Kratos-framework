# GAIA — Generative Agile Intelligence Architecture

AI agent framework for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) that orchestrates software product development through 25 specialized agents, 56 workflows, and 8 shared skills — from initial research all the way to deployment.

GAIA gives you a team of AI agents with distinct personas, structured workflows that follow a proven product lifecycle, built-in quality gates, checkpoint/resume for long-running sessions, and persistent agent memory across conversations.

---

## Installation

### Using npx (recommended)

```bash
npx gaia-framework init .
```

This clones the latest GAIA release from GitHub and installs it into the current directory.

```bash
# Install into a new project
npx gaia-framework init ~/my-new-project

# Skip interactive prompts (uses defaults)
npx gaia-framework init --yes ~/my-project
```

**Requirements:** Node.js 18+ and git.

### Using the shell script directly

```bash
# Clone the repo
git clone https://github.com/J-louage/Gaia-framework.git

# Install into your project
bash Gaia-framework/gaia-install.sh init ~/my-project

# Or use a local copy as source
bash gaia-install.sh init --source ~/Gaia-framework ~/my-project
```

The script resolves sources in this order: `--source` flag, `$GAIA_SOURCE` env var, script's own directory, GitHub clone.

### What the installer does

1. Copies the `_gaia/` framework into your project
2. Creates `docs/` artifact directories (planning, implementation, test, creative)
3. Creates memory sidecar directories with `.gitkeep` files
4. Creates `.resolved/` directories for pre-built configs
5. Prompts for project name and user name, writes them to `global.yaml`
6. Copies `CLAUDE.md` to your project root (the framework instruction file)
7. Installs 99 slash commands to `.claude/commands/`
8. Appends GAIA entries to `.gitignore`

### Updating an existing installation

```bash
# Via npx
npx gaia-framework update .

# Via shell script
bash gaia-install.sh update ~/my-project
```

Update refreshes all framework files (engine, agents, workflows, skills, knowledge, commands) while preserving your `global.yaml` configuration, agent memory, resolved configs, and `CLAUDE.md`.

Changed files are backed up to `_gaia/_backups/{timestamp}/` before overwriting.

### Validating and checking status

```bash
# Check installation integrity (32 checks)
npx gaia-framework validate .

# Show version, module list, command count, sidecar status
npx gaia-framework status .
```

### Installer options

```
gaia-install.sh <command> [options] [target]

Commands:
  init       Install GAIA into a project
  update     Update framework files (preserves config and memory)
  validate   Check installation integrity
  status     Show installation info

Options:
  --source <path>   Local GAIA source directory
  --yes             Skip confirmation prompts
  --dry-run         Show what would be done without making changes
  --verbose         Show detailed progress
  --help            Show help
```

---

## Getting Started

After installation, open your project in Claude Code:

```bash
cd ~/my-project
claude
```

Then type `/gaia` to launch the orchestrator. Gaia presents a categorized menu and routes you to the right agent or workflow.

### 5 essential commands

| Command | What it does |
|---------|-------------|
| `/gaia` | Launch the orchestrator — shows categories and routes you |
| `/gaia-dev-story` | Implement a user story end-to-end |
| `/gaia-quick-spec` | Create a rapid tech spec for small changes |
| `/gaia-quick-dev` | Implement a quick spec |
| `/gaia-help` | Context-sensitive help for wherever you are |

### First-time setup

After installing GAIA into your project, run `/gaia-build-configs` to generate pre-resolved configuration files. This speeds up every future workflow activation by eliminating runtime config resolution.

---

## Architecture

```
_gaia/
├── _config/              # Global config, manifests, agent registry
│   ├── global.yaml       # Project settings — single source of truth
│   └── manifest.yaml     # Module registry
├── _memory/              # Persistent agent memory + checkpoints
│   ├── checkpoints/      # Workflow progress snapshots
│   └── *-sidecar/        # Per-agent persistent memory (9 sidecars)
├── core/                 # Execution engine, protocols, shared tasks
│   ├── engine/           # workflow.xml, task-runner.xml, error-recovery.xml
│   ├── tasks/            # 16 standalone review/utility tasks
│   └── workflows/        # Brainstorming, party mode, advanced elicitation
├── lifecycle/            # Product lifecycle (5 phases)
│   ├── agents/           # 11 lifecycle agents
│   ├── workflows/        # 34 workflows across 5 phases + anytime + quick-flow
│   ├── templates/        # 15 document templates (PRD, architecture, API docs, brownfield, etc.)
│   └── teams/            # Pre-built team compositions
├── dev/                  # Developer tooling
│   ├── agents/           # 6 stack-specific developers + base
│   ├── skills/           # 8 shared skills with sectioned loading
│   └── knowledge/        # Stack-specific patterns (Angular, React, Flutter, etc.)
├── creative/             # Creative intelligence
│   ├── agents/           # 6 creative agents
│   ├── workflows/        # 7 creative workflows
│   └── data/             # Methods, frameworks, story types
└── testing/              # Test architecture
    ├── agents/           # Test Architect (Sable)
    ├── workflows/        # 12 testing workflows
    └── knowledge/        # 20+ testing knowledge fragments
```

### At a glance

| Component | Count |
|-----------|-------|
| Modules | 5 (core, lifecycle, dev, creative, testing) |
| Agents | 25 with distinct personas |
| Workflows | 56 covering the full product lifecycle |
| Standalone tasks | 16 (reviews, audits, utilities) |
| Shared skills | 8 with 47 loadable sections |
| Slash commands | 99 |
| Knowledge fragments | 45 (testing, stack patterns) |
| Agent memory sidecars | 9 |
| Output artifact dirs | 4 |

---

## Agents

Every agent has a name, persona, and specialization. You can activate any agent directly with `/gaia-agent-{name}` or let the orchestrator route you.

### Orchestrator

| Agent | Name | Role |
|-------|------|------|
| Orchestrator | Gaia | Routes requests, manages resources, presents categorized menus |

### Lifecycle Agents

| Agent | Name | Specialization | Command |
|-------|------|---------------|---------|
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

| Command | Workflow | Agent | Output |
|---------|----------|-------|--------|
| `/gaia-brainstorm` | Brainstorm Project | Elena | `docs/planning-artifacts/` |
| `/gaia-market-research` | Market Research | Elena | `docs/planning-artifacts/` |
| `/gaia-domain-research` | Domain Research | Elena | `docs/planning-artifacts/` |
| `/gaia-tech-research` | Technical Research | Elena | `docs/planning-artifacts/` |
| `/gaia-product-brief` | Create Product Brief | Elena | `docs/planning-artifacts/` |

### Phase 2: Planning

| Command | Workflow | Agent | Output |
|---------|----------|-------|--------|
| `/gaia-create-prd` | Create PRD | Derek | `docs/planning-artifacts/` |
| `/gaia-validate-prd` | Validate PRD | Derek | `docs/planning-artifacts/` |
| `/gaia-edit-prd` | Edit PRD | Derek | `docs/planning-artifacts/` |
| `/gaia-create-ux` | Create UX Design | Christy | `docs/planning-artifacts/` |

### Phase 3: Solutioning

| Command | Workflow | Agent | Output |
|---------|----------|-------|--------|
| `/gaia-create-arch` | Create Architecture | Theo | `docs/planning-artifacts/` |
| `/gaia-create-epics` | Create Epics & Stories | Derek | `docs/planning-artifacts/` |
| `/gaia-readiness-check` | Implementation Readiness | Theo | `docs/planning-artifacts/` |
| `/gaia-threat-model` | Security Threat Model | Zara | `docs/planning-artifacts/` |
| `/gaia-infra-design` | Infrastructure Design | Soren | `docs/planning-artifacts/` |

### Phase 4: Implementation

| Command | Workflow | Agent | Output |
|---------|----------|-------|--------|
| `/gaia-sprint-plan` | Sprint Planning | Nate | `docs/implementation-artifacts/` |
| `/gaia-sprint-status` | Sprint Status | Nate | `docs/implementation-artifacts/` |
| `/gaia-create-story` | Create Story | Derek | `docs/implementation-artifacts/` |
| `/gaia-validate-story` | Validate Story | Derek | `docs/implementation-artifacts/` |
| `/gaia-dev-story` | Dev Story | Stack dev | `docs/implementation-artifacts/` |
| `/gaia-code-review` | Code Review | Stack dev | `docs/implementation-artifacts/` |
| `/gaia-qa-tests` | QA Generate Tests | Vera | `docs/implementation-artifacts/` |
| `/gaia-security-review` | Security Review | Zara | `docs/implementation-artifacts/` |
| `/gaia-correct-course` | Correct Course | Nate | `docs/implementation-artifacts/` |
| `/gaia-retro` | Retrospective | Nate | `docs/implementation-artifacts/` |

### Phase 5: Deployment

| Command | Workflow | Agent | Output |
|---------|----------|-------|--------|
| `/gaia-release-plan` | Release Plan | Soren | `docs/implementation-artifacts/` |
| `/gaia-deploy-checklist` | Deployment Checklist | Soren | `docs/implementation-artifacts/` |
| `/gaia-post-deploy` | Post-Deploy Verify | Soren | `docs/implementation-artifacts/` |
| `/gaia-rollback-plan` | Rollback Plan | Soren | `docs/implementation-artifacts/` |

### Quick Flow

Fast-track workflows for small changes that skip the full lifecycle ceremony.

| Command | Workflow | Description |
|---------|----------|-------------|
| `/gaia-quick-spec` | Quick Spec | Rapid tech spec — skip full PRD |
| `/gaia-quick-dev` | Quick Dev | Implement a quick spec immediately |

### Creative Workflows

| Command | Workflow | Agent | Output |
|---------|----------|-------|--------|
| `/gaia-creative-sprint` | Creative Sprint | Multi-agent | `docs/creative-artifacts/` |
| `/gaia-design-thinking` | Design Thinking | Lyra | `docs/creative-artifacts/` |
| `/gaia-innovation` | Innovation Strategy | Orion | `docs/creative-artifacts/` |
| `/gaia-problem-solving` | Problem Solving | Nova | `docs/creative-artifacts/` |
| `/gaia-storytelling` | Storytelling | Elara | `docs/creative-artifacts/` |
| `/gaia-slide-deck` | Slide Deck | Vermeer | `docs/creative-artifacts/` |
| `/gaia-pitch-deck` | Pitch Deck | Vermeer | `docs/creative-artifacts/` |

### Testing Workflows

| Command | Workflow | Agent | Output |
|---------|----------|-------|--------|
| `/gaia-test-design` | Test Design | Sable | `docs/test-artifacts/` |
| `/gaia-test-framework` | Test Framework | Sable | `docs/test-artifacts/` |
| `/gaia-atdd` | ATDD | Sable | `docs/test-artifacts/` |
| `/gaia-test-automate` | Test Automation | Sable | `docs/test-artifacts/` |
| `/gaia-test-review` | Test Review | Sable | `docs/test-artifacts/` |
| `/gaia-ci-setup` | CI Setup | Sable | `docs/test-artifacts/` |
| `/gaia-nfr` | NFR Assessment | Sable | `docs/test-artifacts/` |
| `/gaia-trace` | Traceability Matrix | Sable | `docs/test-artifacts/` |
| `/gaia-a11y-testing` | Accessibility Testing | Sable | `docs/test-artifacts/` |
| `/gaia-perf-testing` | Performance Testing | Sable | `docs/test-artifacts/` |
| `/gaia-mobile-testing` | Mobile Testing | Sable | `docs/test-artifacts/` |
| `/gaia-teach-testing` | Teach Me Testing | Sable | `docs/test-artifacts/` |

### Anytime Workflows

Available at any point in the lifecycle.

| Command | Workflow | Description |
|---------|----------|-------------|
| `/gaia-brownfield` | Brownfield Onboarding | 9-step knowledge base for existing projects — APIs, UX, events, dependencies, NFRs, architecture, stories |
| `/gaia-document-project` | Document Project | Document a project for AI context |
| `/gaia-project-context` | Generate Project Context | Generate context for AI consumption |
| `/gaia-performance-review` | Performance Review | Analyze performance bottlenecks |
| `/gaia-brainstorming` | Brainstorming | Facilitated brainstorming session |
| `/gaia-party` | Party Mode | Multi-agent group discussion |
| `/gaia-advanced-elicitation` | Advanced Elicitation | Deep requirements elicitation |

### Brownfield Onboarding (Deep Dive)

The brownfield onboarding workflow (`/gaia-brownfield`) is a comprehensive 9-step process that transforms an existing codebase into a fully documented developer knowledge base. It detects project capabilities during scanning and conditionally generates specialized documentation.

**Step 1 — Deep Project Discovery** scans the codebase and sets capability flags:

| Flag | Detection |
|------|-----------|
| `{has_apis}` | Route definitions, controllers, OpenAPI/Swagger specs |
| `{has_events}` | Kafka, RabbitMQ, SNS-SQS, Redis pub-sub, NATS patterns |
| `{has_external_deps}` | Outbound HTTP clients, SDKs, service URLs |
| `{has_frontend}` | React, Angular, Vue, Flutter, SwiftUI, CSS frameworks |

**Steps 2–4** are conditional — they only run when the corresponding capability is detected:

| Step | Condition | Output |
|------|-----------|--------|
| 2. API Documentation | `{has_apis}` | OpenAPI 3.x spec (discovered or generated), endpoint inventory, Mermaid flow diagram |
| 3. UX Design Assessment | `{has_frontend}` | UI patterns, Mermaid navigation sitemap, accessibility assessment, UX gaps |
| 4. Event & Messaging Catalog | `{has_events}` | Producer/consumer tables, delivery guarantees, Mermaid event flow diagrams |

**Steps 5–9** always run:

| Step | Output |
|------|--------|
| 5. Dependency Map | External services, infrastructure, library deps with CVE risk, Mermaid dependency graph |
| 6. NFR Assessment & Baselines | Code quality, security posture, performance, test coverage — all measured, not guessed |
| 7. Create PRD for Gaps | Gap-focused PRD with NFR baselines from step 6, references all upstream artifacts |
| 8. Map Architecture with Diagrams | C4 Mermaid diagrams (Level 1 + 2), 3–5 sequence diagrams, as-is/target delta |
| 9. Epics/Stories & Onboard Developer | Gap stories + developer knowledge base index linking all artifacts |

**Design rules:**
- All diagrams use **Mermaid syntax** — no ASCII art
- All API docs use **Swagger/OpenAPI format**
- Flow diagrams limited to **3–5 key flows** per document
- NFR baselines are **measured from the codebase**, not estimated

**Output artifacts** (up to 10, depending on detected capabilities):

| Artifact | Always | Conditional |
|----------|--------|-------------|
| `project-documentation.md` | Yes | — |
| `api-documentation.md` | — | `{has_apis}` |
| `ux-design.md` | — | `{has_frontend}` |
| `event-catalog.md` | — | `{has_events}` |
| `dependency-map.md` | Yes | — |
| `nfr-assessment.md` | Yes | — |
| `prd.md` | Yes | — |
| `architecture.md` | Yes | — |
| `epics-and-stories.md` | Yes | — |
| `brownfield-onboarding.md` | Yes | — |

---

## Review & Utility Tasks

Standalone tasks that can be run anytime without a full workflow. These are single-step operations for reviews, audits, and document utilities.

### Code & Security Reviews

| Command | Task | Description |
|---------|------|-------------|
| `/gaia-adversarial` | Adversarial Review | Cynical critical review — finds weaknesses |
| `/gaia-edge-cases` | Edge Case Hunter | Identify edge cases and boundary conditions |
| `/gaia-review-security` | Security Review | OWASP-focused security review |
| `/gaia-review-api` | API Design Review | Review REST API against standards |
| `/gaia-review-deps` | Dependency Audit | Scan dependencies for vulnerabilities |
| `/gaia-review-a11y` | Accessibility Review | WCAG 2.1 compliance review |
| `/gaia-review-perf` | Performance Review | Code-level performance review |

### Editorial & Documentation

| Command | Task | Description |
|---------|------|-------------|
| `/gaia-editorial-prose` | Editorial Prose | Clinical copy-editing review |
| `/gaia-editorial-structure` | Editorial Structure | Structural editing review |
| `/gaia-summarize` | Summarize Document | Generate executive summary |
| `/gaia-index-docs` | Index Docs | Generate document index for a folder |
| `/gaia-shard-doc` | Shard Document | Split large docs into sections |
| `/gaia-merge-docs` | Merge Documents | Merge multiple markdown files |
| `/gaia-changelog` | Generate Changelog | Changelog from git history |

### Framework

| Command | Task | Description |
|---------|------|-------------|
| `/gaia-build-configs` | Build Configs | Regenerate pre-resolved config files |
| `/gaia-validate-framework` | Validate Framework | Self-validation and consistency check |
| `/gaia-resume` | Resume | Resume from last checkpoint after context loss |

---

## Shared Skills

Skills are loaded just-in-time by developer agents. Each skill is divided into sections so only the relevant portion is loaded (keeping context usage low).

| Skill | Sections | Used by |
|-------|----------|---------|
| **Git Workflow** | branching, commits, pull-requests, conflict-resolution | All devs, Scrum Master, DevOps |
| **API Design** | rest-conventions, graphql, openapi, versioning, error-standards | All devs, Architect, Data Engineer |
| **Database Design** | schema-design, migrations, indexing, orm-patterns | Java, Python, Architect, Data Engineer |
| **Docker Workflow** | multi-stage-builds, compose, security-scanning | TS, Angular, Java, Python, Mobile, DevOps |
| **Testing Patterns** | tdd-cycle, unit-testing, integration-testing, test-doubles | All devs, QA, Test Architect |
| **Code Review Standards** | review-checklist, solid-principles, complexity-metrics | All devs |
| **Documentation Standards** | readme-template, adr-format, inline-comments, api-docs | All devs, Tech Writer, Analyst, PM |
| **Security Basics** | owasp-top-10, input-validation, secrets-management, cors-csrf | All devs, Architect, Security, DevOps |

---

## Knowledge Fragments

Stack-specific and domain-specific knowledge loaded on demand.

### Developer Knowledge (by stack)

| Stack | Fragments |
|-------|-----------|
| TypeScript | React patterns, Next.js patterns, Express patterns, TS conventions |
| Angular | Angular conventions, Angular patterns, NgRx state, RxJS patterns |
| Flutter | Dart conventions, Widget patterns, State management, Platform channels |
| Java | Spring Boot patterns, JPA patterns, Microservices, Maven/Gradle |
| Python | Python conventions, Django patterns, FastAPI patterns, Data pipelines |
| Mobile | React Native patterns, Swift patterns, Kotlin patterns, Mobile testing |

### Testing Knowledge (by tier)

| Tier | Fragments |
|------|-----------|
| **Core** | Test pyramid, Test isolation, Fixture architecture, Deterministic testing |
| **Extended** | API testing patterns, Data factories, Risk governance, Selector resilience |
| **Specialized** | Contract testing, Visual testing, Test healing |
| **Performance** | k6 patterns, Lighthouse CI |
| **Accessibility** | WCAG checks, Axe-core patterns |
| **Mobile** | Appium patterns, React Native testing, Responsive testing |
| **Unit Testing** | Jest/Vitest patterns, JUnit5 patterns, Pytest patterns |

---

## Output Artifacts

Every workflow writes its output to a specific artifact directory:

```
docs/
├── planning-artifacts/         # PRDs, research, architecture, epics
├── implementation-artifacts/   # Sprint plans, stories, reviews, changelogs
├── test-artifacts/             # Test plans, traceability, accessibility
└── creative-artifacts/         # Design thinking, innovation, pitch decks
```

---

## Templates

Document templates in `_gaia/lifecycle/templates/` provide standardized structures for workflow outputs. Each template has YAML frontmatter (`template`, `version`, `used_by`) and placeholder sections that agents fill during execution.

| Template | Used By | Description |
|----------|---------|-------------|
| `prd-template.md` | create-prd | Product requirements document |
| `architecture-template.md` | create-architecture | Greenfield architecture document |
| `brownfield-architecture-template.md` | brownfield-onboarding | As-is/target architecture with Mermaid C4 diagrams |
| `story-template.md` | create-epics-stories | User story with acceptance criteria |
| `sprint-plan-template.md` | sprint-planning | Sprint plan with capacity and goals |
| `product-brief-template.md` | create-product-brief | Product brief for stakeholder alignment |
| `review-template.md` | code-review | Code review report |
| `test-plan-template.md` | test-design | Test plan with strategy and coverage |
| `deployment-template.md` | release-plan | Deployment plan and checklist |
| `api-documentation-template.md` | brownfield-onboarding | OpenAPI/Swagger API documentation |
| `event-catalog-template.md` | brownfield-onboarding | Event producer/consumer catalog |
| `dependency-map-template.md` | brownfield-onboarding | Service, infrastructure, and library dependencies |
| `nfr-assessment-template.md` | brownfield-onboarding | Non-functional requirements baselines |
| `ux-design-assessment-template.md` | brownfield-onboarding | UI patterns and accessibility assessment |
| `brownfield-onboarding-template.md` | brownfield-onboarding | Developer knowledge base index |

---

## Checkpoint & Resume

Long-running workflows save checkpoints to `_gaia/_memory/checkpoints/`. If your session is interrupted or context is lost, run `/gaia-resume` to pick up from the last completed step.

Completed workflow checkpoints move to `_gaia/_memory/checkpoints/completed/`.

---

## Agent Memory

Each agent has a persistent memory sidecar that survives across sessions:

```
_gaia/_memory/
├── architect-sidecar/
├── devops-sidecar/
├── orchestrator-sidecar/
├── pm-sidecar/
├── security-sidecar/
├── sm-sidecar/
├── storyteller-sidecar/
├── tech-writer-sidecar/
└── test-architect-sidecar/
```

Agents store decisions, patterns, and context they learn about your project. This memory accumulates over time, making agents more effective the more you use them.

---

## Configuration

### global.yaml

The single source of truth for project settings at `_gaia/_config/global.yaml`:

```yaml
framework_name: "GAIA"
framework_version: "1.1.1"

user_name: "your-name"
project_name: "your-project"
project_root: "{project-root}"

output_folder: "{project-root}/docs"
planning_artifacts: "{project-root}/docs/planning-artifacts"
implementation_artifacts: "{project-root}/docs/implementation-artifacts"
test_artifacts: "{project-root}/docs/test-artifacts"
creative_artifacts: "{project-root}/docs/creative-artifacts"
```

The `{project-root}` placeholder is resolved at runtime. After changing `global.yaml`, run `/gaia-build-configs` to regenerate resolved configs.

### Pre-resolved configs

Each module (core, lifecycle, creative, testing) has a `.resolved/` directory for pre-built config files. These eliminate runtime config resolution overhead. Generate them with `/gaia-build-configs`.

---

## Teams

Pre-built team compositions for different project types:

| Team | Focus | Agents |
|------|-------|--------|
| Full | Complete coverage | All lifecycle + dev agents |
| Planning | Requirements & design | Analyst, PM, UX Designer, Architect |
| Implementation | Build & ship | SM, dev agents, QA, DevOps |
| Quick Ship | Minimal ceremony | PM, dev agent, QA |
| Enterprise | Governance-heavy | Full team + Security, Performance |
| Security-Focused | Security-first | Architect, Security, DevOps, QA |
| Data-Intensive | Data pipelines | Architect, Data Engineer, Python Dev |

---

## Typical Workflow

A full product lifecycle from idea to deployment:

```
/gaia-brainstorm           → brainstorm the idea
/gaia-product-brief        → create a product brief
/gaia-market-research      → validate market fit
/gaia-create-prd           → write the PRD
/gaia-create-ux            → design the UX
/gaia-create-arch          → design the architecture
/gaia-create-epics         → break into epics and stories
/gaia-readiness-check      → verify everything is ready
/gaia-sprint-plan          → plan the first sprint
/gaia-dev-story            → implement stories
/gaia-code-review          → review the code
/gaia-qa-tests             → generate tests
/gaia-security-review      → security audit
/gaia-release-plan         → plan the release
/gaia-deploy-checklist     → pre-deploy verification
/gaia-post-deploy          → post-deploy health check
/gaia-retro                → sprint retrospective
```

For small changes, skip the ceremony:

```
/gaia-quick-spec           → rapid tech spec
/gaia-quick-dev            → implement it
```

---

## License

MIT
