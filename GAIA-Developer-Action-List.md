# GAIA Framework — Developer Action List

**Date:** 2026-03-12
**Framework Version:** v1.27.4
**Sources:** Manual Testing Bug Report (107 bugs) + Artifact Wiring Gaps Issue Report (7 issues, 18 changes)
**Status:** ACTIVE

---

## How to Use This Document

1. Work through items **top to bottom** — groups are ordered by impact and dependency
2. Check the box `[x]` when an item is fixed and tested
3. After completing a group, run `/gaia-build-configs` to regenerate resolved configs
4. Run the relevant manual testing checklist part to verify the fix

---

## Progress Tracker

| Group | Items | Fixed | Remaining |
|-------|-------|-------|-----------|
| A. Systemic: Next-Step Suggestions | 14 | 14 | 0 |
| B. Systemic: Normal Mode Pause | 4 | 4 | 0 |
| C. Systemic: Unregistered Commands | 4 | 4 | 0 |
| D. Systemic: Wrong Output Directory | 6 | 0 | 6 |
| E. Systemic: Story Naming Convention | 3 | 3 | 0 |
| F. Dev-Story Cluster | 6 | 2 | 4 |
| G. Brownfield Cluster | 8 | 0 | 8 |
| H. Run-All-Reviews Cluster | 5 | 0 | 5 |
| I. Artifact Wiring Gaps (Issue Report) | 18 | 0 | 18 |
| J. Individual High-Severity Bugs | 8 | 0 | 8 |
| K. Individual Medium-Severity Bugs | 28 | 0 | 28 |
| L. Individual Low-Severity Bugs | 18 | 0 | 18 |
| **TOTAL** | **122** | **27** | **95** |

> BUG-073 is already closed — not counted above.

---

## GROUP A: Wrong Next-Step Suggestions (14 bugs)

**Root cause:** Workflows end with free-form "suggested next steps" that don't follow the lifecycle sequence. The framework has no lifecycle-sequence manifest that agents can reference.

**Recommended systemic fix:** Create a lifecycle-sequence manifest file (`_gaia/_config/lifecycle-sequence.yaml`) that maps each workflow to its mandatory next step(s). Then update the engine or instructions to reference this manifest when generating the "Suggested path" output.

**Review comment:** This is the #1 most frequent bug pattern. Fixing each instructions.xml individually works but is fragile — a manifest-based approach prevents future regressions. Priority: **fix the manifest first, then update each workflow.**

- [x] **BUG-001** (Medium) — `/gaia-brainstorm` suggests `/gaia-product-brief` instead of `/gaia-market-research`
  - File: `brainstorm-project/instructions.xml` Step 5
  - Fix: Primary suggestion should be `/gaia-market-research` (since `create-product-brief` declares `market-research.md` as FULL_LOAD input)

- [x] **BUG-003** (Medium) — `/gaia-market-research` suggests `/gaia-product-brief` instead of `/gaia-domain-research`
  - File: `market-research/instructions.xml` final step
  - Fix: Primary suggestion should be `/gaia-domain-research` or `/gaia-tech-research`

- [x] **BUG-005** (High) — `/gaia-domain-research` suggests `/gaia-product-brief` skipping tech-research
  - File: `domain-research/instructions.xml` final step
  - Fix: Primary suggestion should be `/gaia-tech-research`

- [x] **BUG-006** (Medium) — `/gaia-tech-research` primary suggestion skips `advanced-elicitation`
  - File: `tech-research/instructions.xml` final step
  - Fix: After Issue 1 is resolved (moving advanced-elicitation to Phase 1), primary should be `/gaia-advanced-elicitation` (optional) or `/gaia-product-brief`

- [x] **BUG-009** (Medium) — `/gaia-create-prd` primary suggestion skips `/gaia-validate-prd`
  - File: `create-prd/instructions.xml` final step
  - Fix: Primary suggestion MUST be `/gaia-validate-prd` — validation is mandatory before proceeding

- [x] **BUG-010** (Medium) — `/gaia-validate-prd` suggests `/gaia-create-ux` even when PRD has critical issues
  - File: `validate-prd/instructions.xml` final step
  - Fix: If validation fails, primary suggestion should be `/gaia-edit-prd`. Only suggest `/gaia-create-ux` on PASS.

- [x] **BUG-015** (High) — `/gaia-create-ux` suggests wrong next command (should be `/gaia-review-a11y`)
  - File: `create-ux/instructions.xml` final step
  - Fix: Primary should be `/gaia-review-a11y` (accessibility review is mandatory after UX design)

- [x] **BUG-017** (Medium) — `/gaia-review-a11y` next step table doesn't prioritize Phase 3 entry
  - File: `review-a11y/instructions.xml` final step
  - Fix: Primary should be `/gaia-create-arch` (Phase 3 starts with architecture)

- [x] **BUG-019** (Medium) — `/gaia-create-arch` primary suggestion misses `/gaia-test-design`
  - File: `create-architecture/instructions.xml` final step
  - Fix: Primary should be `/gaia-test-design` (test plan is needed before epics per quality gate)

- [x] **BUG-026** (Medium) — `/gaia-test-design` next step suggestion unclear
  - File: `test-design/instructions.xml` final step
  - Fix: Primary should be `/gaia-create-epics`

- [x] **BUG-039** (Medium) — `/gaia-create-epics` next step is ambiguous
  - File: `create-epics-stories/instructions.xml` final step
  - Fix: Primary should be `/gaia-atdd` (for high-risk stories) or `/gaia-threat-model`

- [x] **BUG-042** (Medium) — `/gaia-infra-design` next step is wrong
  - File: `infra-design/instructions.xml` final step
  - Fix: Primary should be `/gaia-trace`

- [x] **BUG-046** (Medium) — `/gaia-ci-setup` next step is wrong
  - File: `ci-setup/instructions.xml` final step
  - Fix: Primary should be `/gaia-readiness-check`

- [x] **BUG-107** (Medium) — `/gaia-threat-model` next step should be `/gaia-infra-design`
  - File: `threat-model/instructions.xml` final step
  - Fix: Primary should be `/gaia-infra-design`

---

## GROUP B: Normal Mode Doesn't Pause at Checkpoints (4 bugs)

**Root cause:** `<template-output>` checkpoints exist in instructions.xml but the engine doesn't enforce the pause in normal mode. Some workflows blow past the checkpoint without waiting for user confirmation.

**Recommended systemic fix:** Audit the engine (`_gaia/core/engine/workflow.xml`) — the pause logic for `<template-output>` tags may have a conditional that's too permissive. Ensure every `<template-output>` triggers a pause unless YOLO mode is active.

**Review comment:** This undermines the user's ability to review and course-correct. High priority for trust — users need to see and approve outputs before the workflow moves on.

- [x] **BUG-011** (Medium) — `/gaia-create-prd` skips pause at `<template-output>` in normal mode
  - File: Engine + `create-prd/instructions.xml`
  - Fix: Strengthened engine pause enforcement + added `<ask>` at create-architecture Step 3 for tech selection confirmation

- [x] **BUG-040** (Medium) — `/gaia-create-story` skips user interaction in normal mode
  - File: `create-story/instructions.xml`
  - Fix: Added 4 mandatory `<ask>` tags at Step 4 for elaboration questions

- [x] **BUG-051** (High) — `/gaia-dev-story` auto-proceeds past checkpoint in normal mode
  - File: Engine + `dev-story/instructions.xml`
  - Fix: Split TDD Step 6 into 3 steps (Red/Green/Refactor) each with `<template-output>`, added `<ask>` at Step 5

- [x] **BUG-066** (Medium) — `/gaia-brownfield` skips review at architecture output checkpoint
  - File: Engine + `brownfield/instructions.xml`
  - Fix: Added subagent isolation mandate + `<template-output>` at end of Step 2

---

## GROUP C: Unregistered Commands (4 bugs)

**Root cause:** Workflow directories exist under `_gaia/` but no corresponding `.claude/commands/*.md` file exists, so the slash command is not available.

**Recommended fix:** Create the missing command files. Each command file needs the standard format: description, workflow reference, and optional parameters.

**Review comment:** These are quick wins — just create the command files pointing to the existing workflow.yaml.

- [x] **BUG-095** (High) — `/gaia-tech-debt-review` command file missing
  - Fix: Created `.claude/commands/gaia-tech-debt-review.md` pointing to the tech-debt-review workflow

- [x] **BUG-100** (High) — `/gaia-add-stories` command file missing
  - Fix: Created `.claude/commands/gaia-add-stories.md` pointing to the add-stories workflow

- [x] **BUG-102** (High) — `/gaia-check-dod` command not registered — Definition of Done enforcement inaccessible
  - Fix: Created full check-dod workflow + `.claude/commands/gaia-check-dod.md` + lifecycle-sequence entry

- [x] **BUG-103** (High) — `/gaia-check-review-gate` command not registered — composite gate check inaccessible
  - Fix: Created full check-review-gate workflow + `.claude/commands/gaia-check-review-gate.md` + lifecycle-sequence entries

---

## GROUP D: Wrong Output Directory (6 bugs)

**Root cause:** Subagent handoff failures cause the orchestrator to write files to default directories instead of checking the workflow's declared output paths.

**Recommended systemic fix:** (1) Ensure orchestrator reads `output.primary` from `workflow.yaml` when writing on behalf of a failed subagent. (2) Add a post-step validation that checks file locations match declared output paths.

**Review comment:** Each file individually is easy to fix, but the underlying problem is that the orchestrator doesn't consult the workflow config when doing fallback writes. Fix the orchestrator logic and these all resolve.

- [ ] **BUG-063** (Low) — `/gaia-brownfield` dependency audit written to `planning-artifacts/` instead of `test-artifacts/`
  - Fix: Write `dependency-audit-{date}.md` to `docs/test-artifacts/`

- [ ] **BUG-065** (Low) — `/gaia-brownfield` NFR assessment written to `test-artifacts/` instead of `planning-artifacts/`
  - Fix: Write `nfr-assessment-{date}.md` to `docs/planning-artifacts/`
  - Note: BUG-063 and BUG-065 are swapped — the two files ended up in each other's correct location

- [ ] **BUG-074** (Medium) — `/gaia-brownfield` performance test plan written to wrong directory
  - Fix: Write `performance-test-plan-{date}.md` to `docs/test-artifacts/`

- [ ] **BUG-084** (Medium) — `/gaia-sprint-plan` writes sprint-status.yaml to wrong location
  - Fix: Ensure output goes to `docs/implementation-artifacts/sprint-status.yaml`

- [ ] **BUG-098** (Medium) — Review workflow output written to incorrect directory
  - Fix: Check `output.primary` in review workflow configs and ensure output files land in declared location

- [ ] **BUG-062** (Medium) — `/gaia-brownfield` subagent file write failures cause orchestrator fallback
  - Root cause: Subagents don't inherit file write permissions
  - Fix: (a) Ensure subagent permission inheritance, or (b) use structured handoff pattern where subagents return content and orchestrator writes

---

## GROUP E: Story File Naming Convention Conflict (3 bugs)

**Root cause:** Two conflicting naming conventions exist: `{story_key}-{story_title_slug}.md` (per workflow config) vs `story-{key}.md` (per CLAUDE.md and sprint planning). Must standardize on ONE.

**Recommended fix:** Standardize on `{story_key}-{story_title_slug}.md` (the workflow config convention) since that's what the actual file creation uses. Update all references.

**Review comment:** This is a cross-cutting consistency issue. Grep the entire `_gaia/` tree for both patterns and align everything.

- [x] **BUG-041** (High) — CLAUDE.md uses `story-{key}.md` convention — conflicts with `{key}-{title-slug}.md` from workflow
  - Fix: Documented `{story_key}-{story_title_slug}.md` as canonical convention in CLAUDE.md. Updated all 13 workflow files to use glob `{story_key}-*.md`.

- [x] **BUG-053** (Medium) — `/gaia-dev-story` story file references use inconsistent naming
  - Fix: Updated dev-story workflow.yaml and instructions.xml to use glob `{story_key}-*.md` + added file resolution action

- [x] **BUG-044** (Low, downgraded) — `/gaia-create-story` output filename convention ambiguity
  - Fix: Standardized on `{story_key}-{story_title_slug}.md` across all workflows. create-story already uses this correctly.

---

## GROUP F: Dev-Story Cluster (6 bugs)

**Root cause:** `/gaia-dev-story` has multiple interrelated issues around gates, TDD enforcement, checkpoints, and DoD.

**Recommended fix order:** Fix BUG-049 (gate) first since it blocks the rest, then BUG-050 (TDD), BUG-054 (DoD), BUG-051 (already in Group B), BUG-052 (checkpoints), BUG-053 (already in Group E).

**Review comment:** Dev-story is the most frequently used workflow in production. These bugs compound — a developer hits the gate issue, then the TDD issue, then the DoD issue all in one session. High priority cluster.

- [x] **BUG-049** (High) — `/gaia-dev-story` pre-start gate doesn't validate story file exists + ATDD glob mismatch
  - Fix: Added story file existence gate to workflow.yaml. Fixed ATDD gate to search both epic-level and story-level patterns. Fixed ATDD variable naming.

- [x] **BUG-050** (High) — `/gaia-dev-story` TDD enforcement is inconsistent
  - Fix: Added critical mandates, `<check>` gates between phases, `<ask>` prompts for user confirmation, vacuous test detection

- [ ] **BUG-051** (High) — Covered in Group B (normal mode pause)

- [ ] **BUG-052** (Medium) — `/gaia-dev-story` checkpoint saves don't include all required fields
  - File: `dev-story/instructions.xml` checkpoint steps
  - Fix: Include `files_touched` with sha256 checksums per CLAUDE.md checkpoint discipline

- [ ] **BUG-053** (Medium) — Covered in Group E (naming convention)

- [ ] **BUG-054** (High) — `/gaia-dev-story` Definition of Done checklist incomplete or not enforced
  - File: `dev-story/instructions.xml` final step
  - Fix: Add explicit DoD checklist: code compiles, tests pass, no linting errors, code review standards met, documentation updated

---

## GROUP G: Brownfield Cluster (8 bugs)

**Root cause:** `/gaia-brownfield` is a complex orchestrator workflow (10 steps, 6+ subagents) with multiple file output issues and subagent coordination failures.

**Review comment:** Brownfield is the most complex single workflow. Most issues stem from the subagent permission problem (BUG-062). Fix that first and re-test — several other bugs may resolve.

- [ ] **BUG-056** (Medium) — `/gaia-brownfield` Step 1 discovery doesn't detect all project types
  - Fix: Expand project detection patterns (monorepo, workspace, etc.)

- [ ] **BUG-057** (Medium) — `/gaia-brownfield` Step 2 legacy pattern analysis too shallow
  - Fix: Deepen analysis to include dependency version auditing, deprecated API usage

- [ ] **BUG-058** (Medium) — `/gaia-brownfield` Step 3 architecture mapping misses microservice boundaries
  - Fix: Add service boundary detection for multi-service projects

- [ ] **BUG-059** (Medium) — `/gaia-brownfield` Step 4 risk assessment doesn't quantify risks
  - Fix: Add risk scoring (likelihood × impact) to produce actionable priority list

- [ ] **BUG-060** (Medium) — `/gaia-brownfield` Step 5 migration strategy is generic
  - Fix: Tailor migration steps to the specific tech stack detected in Step 1

- [ ] **BUG-061** (Medium) — `/gaia-brownfield` Step 6 quality baseline doesn't run actual linters
  - Fix: If project has existing linter configs, reference them; otherwise propose configs

- [ ] **BUG-062** (Medium) — Covered in Group D (subagent file write failures)

- [ ] **BUG-064** (High) — `/gaia-brownfield` overall output missing summary with cross-references
  - Fix: Add a final consolidation step that produces a summary document linking all outputs

---

## GROUP H: Run-All-Reviews Cluster (5 bugs)

**Root cause:** `/gaia-run-all-reviews` orchestrator has issues with status transitions, execution order, and gate evaluation.

**Review comment:** The orchestrator itself works (POSITIVE-006 noted graceful recovery), but the coordination between 6 subagent reviews creates edge cases. Fix BUG-085 first (status transition) as it's the most impactful.

- [ ] **BUG-085** (Medium) — Run-all-reviews status transitions conflict when multiple reviews fail
  - File: `run-all-reviews` orchestrator logic
  - Fix: Add status lock — save original status before reviews, set final status after ALL reviews complete

- [ ] **BUG-086** (Low) — Execution order differs from documentation
  - Fix: Align config order with documented order, or update docs

- [ ] **BUG-087** (Low) — Individual review results not aggregated in a summary
  - Fix: After all 6 reviews, produce a composite Review Gate Summary table

- [ ] **BUG-088** (Low) — Review gate table in story file not updated atomically
  - Fix: Update all 6 review columns in one write after all reviews complete

- [ ] **BUG-089** (Low) — No timeout handling for individual review subagents
  - Fix: Add per-review timeout (configurable, default 5 min) with graceful fallback

---

## GROUP I: Artifact Wiring Gaps (from Issue Report — 18 changes)

**Source:** `GAIA-Issue-Report-Artifact-Wiring-Gaps.md`

**Review comment:** These are architectural improvements, not runtime bugs. They make the framework's data flow complete. Implement after Groups A-H since those are user-facing bugs. Within this group, Issues 1-4 are prerequisites for Issues 5-7.

### Issue 1: Move `/gaia-advanced-elicitation` from Phase 2 to Phase 1

- [ ] **1a** — Move directory `_gaia/core/workflows/advanced-elicitation/` → `_gaia/lifecycle/workflows/1-analysis/advanced-elicitation/`
- [ ] **1b** — Update `workflow.yaml`: change `module: core` → `module: lifecycle`, update `installed_path`
- [ ] **1c** — Update `instructions.xml` Step 1: load existing research artifacts if available
- [ ] **1d** — Update Activity Diagram HTML: move node from end of Phase 2 to end of Phase 1

### Issue 2: Wire orphaned research artifacts

- [ ] **2a** — `create-product-brief/workflow.yaml`: add `domain_research` and `technical_research` to `input_file_patterns`
- [ ] **2b** — `create-product-brief/instructions.xml`: add explicit load actions for domain + technical research

### Issue 3: Wire `ux-design.md` into implementation workflows

- [ ] **3a** — `create-epics-stories/workflow.yaml`: add `ux_design` to `input_file_patterns` (FULL_LOAD)
- [ ] **3b** — `dev-story/workflow.yaml`: add `architecture` and `ux_design` to `input_file_patterns` (INDEX_GUIDED)

### Issue 4: Fix missing discover-inputs protocol

- [ ] **4** — Create `_gaia/core/protocols/discover-inputs.xml` OR remove dead reference from `create-product-brief/instructions.xml`

### Issue 5: Formalize `/gaia-atdd` in Phase 3 flow

- [ ] **5a** — `atdd/workflow.yaml`: add `input_file_patterns` for epics + `pre_start` quality gate
- [ ] **5b** — `atdd/instructions.xml`: explicitly load epics, filter high-risk stories
- [ ] **5c** — Activity Diagram HTML: add `/gaia-atdd` node after `create-epics`
- [ ] **5d** — `traceability/instructions.xml`: flag missing ATDD files for high-risk stories as gaps

### Issue 6: Make adversarial review mandatory in readiness-check

- [ ] **6** — `implementation-readiness/instructions.xml`: make Step 11 mandatory (remove `<ask>`), add Step 12 for findings incorporation (see Issue Report for full XML)

### Issue 7: Redesign `/gaia-retro` as learning loop

- [ ] **7a** — `retrospective/workflow.yaml`: add `previous_retros`, `tech_debt` inputs; declare `sidecar_updates` and `skill_updates` outputs
- [ ] **7b** — `retrospective/instructions.xml`: add 3 new steps (Agent Memory Updates, Skill Improvement Proposals, Cross-Retro Pattern Detection)
- [ ] **7c** — `sprint-planning/workflow.yaml`: add `previous_retro` to `input_file_patterns`
- [ ] **7d** — `sprint-planning/instructions.xml`: load latest retro, carry forward action items
- [ ] **7e** — `correct-course/workflow.yaml`: add `retro` to `input_file_patterns`
- [ ] **7f** — `correct-course/instructions.xml`: check if current issue matches known retro pattern

---

## GROUP J: Individual High-Severity Bugs (8 remaining)

These are not part of a systemic cluster but are individually high-impact.

- [ ] **BUG-004** (High) — `/gaia-product-brief` doesn't load all Phase 1 research outputs
  - File: `create-product-brief/instructions.xml`
  - Fix: Load brainstorm + market-research + domain-research + tech-research (partially addressed by Issue 2)
  - **Comment:** Overlaps with Issue 2 in Group I. If you fix 2a/2b, verify this also resolves.

- [ ] **BUG-007** (High) — `/gaia-product-brief` missing quality gate for brainstorm existence
  - File: `create-product-brief/workflow.yaml`
  - Fix: Add `pre_start` gate: check `{planning_artifacts}/project-brainstorm.md` exists
  - **Comment:** Without this gate, the workflow silently proceeds without brainstorm context, producing a weaker brief.

- [ ] **BUG-014** (High) — `/gaia-validate-prd` validation too superficial — misses structural issues
  - File: `validate-prd/instructions.xml`
  - Fix: Add structural validation: check all FR/NFR are numbered, acceptance criteria exist for each, priority is assigned
  - **Comment:** The validator should catch what the adversarial review catches — it currently just checks for section existence, not content quality.

- [ ] **BUG-024** (High) — `/gaia-create-arch` architecture decisions not traceable to requirements
  - File: `create-architecture/instructions.xml`
  - Fix: Each architecture decision should reference the FR/NFR it addresses. Add a "Decision → Requirement Mapping" section to architecture.md output.

- [ ] **BUG-030** (High) — `/gaia-test-design` test plan doesn't cover NFRs
  - File: `test-design/instructions.xml`
  - Fix: Add explicit NFR test planning section (performance, security, accessibility, scalability targets from PRD NFRs)
  - **Comment:** Critical gap — NFRs are often the highest-risk requirements and they get zero test coverage in the current test plan.

- [ ] **BUG-033** (High) — `/gaia-trace` doesn't load `prd.md` — matrix built from stories instead of requirements
  - File: `traceability/workflow.yaml`
  - Fix: Add `prd` to `input_file_patterns` with FULL_LOAD. Matrix rows should be FR-001…FR-N and NFR-001…NFR-N, not story ACs.
  - **Comment:** This is the most impactful single bug in Phase 3. The traceability matrix is supposed to answer "is every requirement tested?" but it currently answers "is every story AC tested?" — different question.

- [ ] **BUG-041** (High) — Covered in Group E (naming convention)

- [ ] **BUG-064** (High) — Covered in Group G (brownfield)

---

## GROUP K: Individual Medium-Severity Bugs (28 remaining)

Bugs not already covered in systemic groups.

### Phase 1 — Analysis

- [ ] **BUG-002** (Medium) — `/gaia-brainstorm` doesn't save creative divergent ideas that were deprioritized
  - Fix: Add "Parking Lot" section to brainstorm output for ideas explored but not selected

- [ ] **BUG-008** (Medium) — `/gaia-product-brief` output structure inconsistent with downstream expectations
  - Fix: Align output template sections with what `create-prd` expects to load

### Phase 2 — Planning

- [ ] **BUG-012** (Medium) — `/gaia-create-prd` doesn't cross-reference product brief
  - Fix: Load `product-brief.md` and verify PRD scope aligns with brief scope

- [ ] **BUG-013** (Medium) — `/gaia-create-prd` NFR section generated without measurable targets
  - Fix: Each NFR must have a measurable target (e.g., "response time < 200ms" not "fast response")

- [ ] **BUG-016** (Medium) — `/gaia-create-ux` doesn't reference PRD requirements
  - Fix: Load `prd.md` and map UI flows to functional requirements

- [ ] **BUG-018** (Medium) — `/gaia-review-a11y` output format inconsistent
  - Fix: Standardize output to use WCAG 2.1 guideline references for each finding

### Phase 3 — Solutioning

- [ ] **BUG-020** (Medium) — `/gaia-create-arch` doesn't consider existing codebase (brownfield)
  - Fix: If brownfield artifacts exist, load them as context

- [ ] **BUG-021** (Medium) — `/gaia-create-arch` security section thin
  - Fix: Cross-reference with threat-model output if available; otherwise prompt for security requirements

- [ ] **BUG-022** (Medium) — `/gaia-create-arch` no ADR (Architecture Decision Record) format
  - Fix: Output architecture decisions as ADRs with Status, Context, Decision, Consequences

- [ ] **BUG-023** (Medium) — `/gaia-create-arch` missing scalability analysis
  - Fix: Add scalability section referencing NFR performance/scalability targets

- [ ] **BUG-025** (Medium) — `/gaia-create-arch` technology selection not justified
  - Fix: Each tech choice needs a "Why chosen" + "Alternatives considered" section

- [ ] **BUG-027** (Medium) — `/gaia-test-design` missing test environment requirements
  - Fix: Add section for test environment setup, test data strategy, and CI requirements

- [ ] **BUG-028** (Medium) — `/gaia-test-design` no risk-based test prioritization
  - Fix: Map tests to story risk levels (High/Medium/Low) and prioritize accordingly

- [ ] **BUG-029** (Medium) — `/gaia-test-design` acceptance criteria not extracted from stories
  - Fix: After Issue 5 is resolved (ATDD formalization), cross-reference with epics ACs

- [ ] **BUG-031** (Medium) — `/gaia-create-epics` story estimation inconsistent
  - Fix: Enforce consistent estimation scale (S/M/L/XL with point equivalents)

- [ ] **BUG-032** (Medium) — `/gaia-create-epics` missing dependency graph between stories
  - Fix: Add dependency field to each story and generate dependency visualization

- [ ] **BUG-034** (Medium) — `/gaia-threat-model` doesn't reference architecture decisions
  - Fix: Load `architecture.md` and map threats to architectural components

- [ ] **BUG-035** (Medium) — `/gaia-threat-model` risk scoring missing
  - Fix: Add DREAD or STRIDE scoring for each identified threat

- [ ] **BUG-036** (Medium) — `/gaia-infra-design` not loading architecture artifact
  - Fix: Add `architecture.md` to `input_file_patterns`

- [ ] **BUG-037** (Medium) — `/gaia-infra-design` missing cost estimation
  - Fix: Add infrastructure cost estimation section

- [ ] **BUG-038** (Medium) — `/gaia-trace` matrix format hard to parse
  - Fix: Use clean markdown table with FR/NFR rows × test type columns

- [ ] **BUG-043** (Medium) — `/gaia-ci-setup` output is generic, not tailored to detected stack
  - Fix: Load architecture to detect stack, generate stack-specific CI config

- [ ] **BUG-045** (Medium) — `/gaia-readiness-check` missing capacity assessment
  - Fix: Cross-reference story count/complexity with team capacity data

- [ ] **BUG-047** (Medium) — `/gaia-readiness-check` doesn't check for test coverage gaps
  - Fix: Load traceability matrix, flag any FR/NFR with no test coverage as a readiness risk

### Phase 4 — Implementation

- [ ] **BUG-048** (Medium) — `/gaia-sprint-plan` doesn't factor in velocity history
  - Fix: Load `sm-sidecar/velocity-data.md` if available (will be populated after Issue 7 retro fix)

- [ ] **BUG-055** (Medium) — `/gaia-create-story` story template missing non-functional requirements section
  - Fix: Add NFR section to story template linking back to relevant PRD NFRs

### Phase 5 — Review/Sprint Management

- [ ] **BUG-076** (Medium) — `/gaia-code-review` doesn't check for security anti-patterns
  - Fix: Add security checklist to code review (injection, auth bypass, hardcoded secrets, etc.)

- [ ] **BUG-078** (Medium) — `/gaia-qa-tests` test assertions too shallow
  - Fix: Generate assertions that check behavior, not just existence (assert value, not assert defined)

---

## GROUP L: Individual Low-Severity Bugs (18 remaining)

Documentation, cosmetic, and minor consistency issues.

- [ ] **BUG-067** (Low) — `/gaia-brownfield` timeline estimate unrealistic for large codebases
  - Fix: Scale timeline with codebase LOC/complexity metrics

- [ ] **BUG-068** (Low) — `/gaia-brownfield` missing rollback plan for migration steps
  - Fix: Add rollback procedure for each migration step

- [ ] **BUG-069** (Low) — `/gaia-brownfield` testing strategy doesn't mention existing test suite
  - Fix: Detect and reference existing test suites/frameworks

- [ ] **BUG-070** (Low) — `/gaia-brownfield` output files missing cross-reference links
  - Fix: Add inter-document links between all brownfield outputs

- [ ] **BUG-071** (Low) — `/gaia-brownfield` no mention of tech debt tracking
  - Fix: Add tech debt section linking to `tech-debt-dashboard.md`

- [ ] **BUG-072** (Low, downgraded from High) — Naming/formatting inconsistency in brownfield outputs
  - Fix: Standardize section headings and formatting across all brownfield output files

- [ ] **BUG-075** (Low) — `/gaia-brownfield` checklist completeness check missing
  - Fix: Add final checklist validation step

- [ ] **BUG-077** (Low) — `/gaia-code-review` output format varies between runs
  - Fix: Standardize review output template

- [ ] **BUG-079** (Low) — `/gaia-security-review` findings not linked to threat model
  - Fix: Cross-reference security findings with threat-model.md entries

- [ ] **BUG-080** (Low) — `/gaia-test-automate` generated tests don't follow project conventions
  - Fix: Detect project test conventions (naming, structure) and follow them

- [ ] **BUG-081** (Low) — `/gaia-test-review` coverage report incomplete
  - Fix: Include untested paths and edge cases in coverage analysis

- [ ] **BUG-082** (Low) — `/gaia-review-perf` missing baseline metrics
  - Fix: If no baseline exists, establish one; otherwise compare against existing baseline

- [ ] **BUG-083** (Low) — Sprint management commands have inconsistent status output format
  - Fix: Standardize status output format across all sprint commands

- [ ] **BUG-090** (Low) — `/gaia-sprint-status` reconciliation doesn't report what it changed
  - Fix: Output a diff/changelog of what was reconciled

- [ ] **BUG-091** (Low) — `/gaia-correct-course` action items have no follow-up tracking
  - Fix: Write action items to sprint-status.yaml for tracking

- [ ] **BUG-092** (Low) — `/gaia-standup` output not saved to file
  - Fix: Save standup summary to `docs/implementation-artifacts/standup-{date}.md`

- [ ] **BUG-093** (Low) — `/gaia-velocity` calculation doesn't account for story point inflation
  - Fix: Track points per story over time to detect inflation

- [ ] **BUG-094** (Low) — `/gaia-memory-hygiene` doesn't report orphaned entries
  - Fix: Detect and report sidecar entries that reference deleted/renamed artifacts

---

## Post-Fix Checklist

After completing all groups:

- [ ] Run `/gaia-build-configs` to regenerate all resolved configs
- [ ] Re-run Manual Testing Parts 1-5 and 7 to verify fixes
- [ ] Run Manual Testing Part 6 (Agent commands) if any agent files were modified
- [ ] Update `docs/phases/GAIA-Bug-Report.md` — mark each fixed bug as "Closed"
- [ ] Update framework version to v1.27.5 in `_gaia/_config/global.yaml`

---

## Recommended Fix Order

1. **Group C** (Unregistered Commands) — 4 items, quick wins, unblocks testing of those workflows
2. **Group A** (Next-Step Suggestions) — 14 items, create lifecycle manifest first, then update instructions
3. **Group B** (Normal Mode Pause) — 4 items, engine-level fix that resolves all 4 at once
4. **Group E** (Naming Convention) — 3 items, cross-cutting consistency fix
5. **Group F** (Dev-Story) — 4 remaining items, high-usage workflow
6. **Group D** (Output Directory) — 6 items, orchestrator logic fix
7. **Group J** (High Bugs) — 6 remaining items, individually important
8. **Group H** (Run-All-Reviews) — 5 items, orchestrator coordination
9. **Group G** (Brownfield) — 7 remaining items, complex but lower frequency
10. **Group I** (Artifact Wiring) — 18 items, architectural improvements
11. **Group K** (Medium Bugs) — 28 items, pick highest-value first
12. **Group L** (Low Bugs) — 18 items, handle as time permits

**Estimated effort:** Groups A-F are ~2-3 days. Groups G-I are ~3-4 days. Groups J-L are ~3-5 days. Total: ~8-12 days for one developer.
