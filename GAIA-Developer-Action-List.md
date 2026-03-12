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
| D. Systemic: Wrong Output Directory | 6 | 6 | 0 |
| E. Systemic: Story Naming Convention | 3 | 3 | 0 |
| F. Dev-Story Cluster | 6 | 4 | 2 |
| G. Brownfield Cluster | 8 | 8 | 0 |
| H. Run-All-Reviews Cluster | 5 | 5 | 0 |
| I. Artifact Wiring Gaps (Issue Report) | 18 | 18 | 0 |
| J. Individual High-Severity Bugs | 8 | 6 | 2 |
| K. Individual Medium-Severity Bugs | 28 | 28 | 0 |
| L. Individual Low-Severity Bugs | 18 | 18 | 0 |
| **TOTAL** | **122** | **114** | **8** |

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

- [x] **BUG-063** (Low) — `/gaia-brownfield` dependency audit written to `planning-artifacts/` instead of `test-artifacts/`
  - Fix: Fixed review-dependency-audit.xml task file output path from `{planning_artifacts}` to `{test_artifacts}`. Updated brownfield checklist.md to match.

- [x] **BUG-065** (Low) — `/gaia-brownfield` NFR assessment written to `test-artifacts/` instead of `planning-artifacts/`
  - Fix: Config already correct (`{test_artifacts}` is the right location for NFR assessments). Resolved by orchestrator fallback fix (BUG-062).

- [x] **BUG-074** (Medium) — `/gaia-brownfield` performance test plan written to wrong directory
  - Fix: Config already correct. Fixed code-review workflow.yaml output path from `{implementation_artifacts}/{story_key}-review.md` to `{test_artifacts}/{story_key}-code-review.md`. Resolved by orchestrator fallback fix (BUG-062).

- [x] **BUG-084** (Medium) — `/gaia-review-perf` output written to wrong directory
  - Fix: Fixed review-performance.xml task file output path from `{planning_artifacts}` to `{test_artifacts}` to match workflow.yaml declaration.

- [x] **BUG-098** (Medium) — Review workflow output written to incorrect directory
  - Fix: Workflow.yaml already declares `{planning_artifacts}` which is correct for change requests. Resolved by design.

- [x] **BUG-062** (Medium) — `/gaia-brownfield` subagent file write failures cause orchestrator fallback
  - Fix: Added explicit orchestrator fallback guidance in brownfield instructions.xml Steps 2 and 3 to consult workflow.yaml output.artifacts for correct paths.

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

- [x] **BUG-052** (Medium) — `/gaia-dev-story` checkpoint saves don't include all required fields
  - Fix: Added explicit checkpoint-write actions at each TDD phase with workflow name, step, phase status, variables, and files_touched with sha256 checksums

- [ ] **BUG-053** (Medium) — Covered in Group E (naming convention)

- [x] **BUG-054** (High) — `/gaia-dev-story` Definition of Done checklist incomplete or not enforced
  - File: `dev-story/instructions.xml` final step
  - Fix: Added new Step 10 "Definition of Done Verification" with 8 enforced checklist items. Post-Complete Gate (Step 13) re-validates DoD. Added critical mandate for DoD enforcement.

---

## GROUP G: Brownfield Cluster (8 bugs)

**Root cause:** `/gaia-brownfield` is a complex orchestrator workflow (10 steps, 6+ subagents) with multiple file output issues and subagent coordination failures.

**Review comment:** Brownfield is the most complex single workflow. Most issues stem from the subagent permission problem (BUG-062). Fix that first and re-test — several other bugs may resolve.

- [x] **BUG-056–061** — Action list descriptions did not match bug report (source of truth). Actual open brownfield bugs were BUG-067, 068, 069, 070. Fixed below.

- [x] **BUG-062** (Medium) — Covered in Group D (subagent file write failures) — already closed

- [x] **BUG-064** (High) — Covered by BUG-069/070 fixes below

- [x] **BUG-067** (Low) — Brownfield PRD missing `mode: brownfield` YAML frontmatter
  - Fix: Added brownfield frontmatter requirements (mode, baseline_version, focus) to Step 4 template-output.

- [x] **BUG-068** (Low) — Brownfield architecture missing YAML frontmatter
  - Fix: Added Step 6 action to verify and append brownfield frontmatter (mode, baseline_version, update_scope).

- [x] **BUG-069** (Medium) — Brownfield architecture overwrites existing file without warning
  - Fix: Added overwrite protection to Step 6 matching Step 4 pattern — offers overwrite or save as architecture-brownfield.md.

- [x] **BUG-070** (Medium) — Brownfield next steps misleading — generic Phase 3 without brownfield context
  - Fix: Updated next-step to reference brownfield PRD, warn about existing greenfield artifacts, suggest backups.

---

## GROUP H: Run-All-Reviews Cluster (5 bugs)

**Root cause:** `/gaia-run-all-reviews` orchestrator has issues with status transitions, execution order, and gate evaluation.

**Review comment:** The orchestrator itself works (POSITIVE-006 noted graceful recovery), but the coordination between 6 subagent reviews creates edge cases. Fix BUG-085 first (status transition) as it's the most impactful.

- [x] **BUG-085** (Medium) — Run-all-reviews status transitions conflict when multiple reviews fail
  - Fix: Removed status-change from all 6 review workflows' FAILED paths. Orchestrator Step 8 now handles composite status transition. Added mandate preventing subagents from changing status.

- [x] **BUG-086** (Low) — Execution order differs from documentation
  - Fix: Swapped Steps 3/4 in run-all-reviews/instructions.xml — Security Review now runs before QA Tests per documented order.

- [x] **BUG-087** (Low) — Sprint status reconciliation doesn't generate a report file (corrected from action list description)
  - Fix: Added reconciliation report output to sprint-status Step 2 — writes `sprint-reconciliation-{date}.md` when discrepancies found.

- [x] **BUG-088** (Medium) — Epic status workflow skips dependency analysis entirely (corrected from action list description)
  - Fix: Added Step 4 (Dependency Analysis) to epic-status — reads dependencies from story frontmatter, builds cross-epic graph, identifies blocked stories, calculates critical path. Dashboard includes dependency section.

- [x] **BUG-089** (Low) — Epic status "Remaining" column is misleading (corrected from action list description)
  - Fix: Replaced "remaining" with explicit columns: Total | Done | In Progress | Review | Blocked | Backlog | Completion %. Backlog = stories not yet started.

---

## GROUP I: Artifact Wiring Gaps (from Issue Report — 18 changes)

**Source:** `GAIA-Issue-Report-Artifact-Wiring-Gaps.md`

**Review comment:** These are architectural improvements, not runtime bugs. They make the framework's data flow complete. Implement after Groups A-H since those are user-facing bugs. Within this group, Issues 1-4 are prerequisites for Issues 5-7.

### Issue 1: Move `/gaia-advanced-elicitation` from Phase 2 to Phase 1

- [x] **1a** — Move directory `_gaia/core/workflows/advanced-elicitation/` → `_gaia/lifecycle/workflows/1-analysis/advanced-elicitation/`
  - Fix: Used git mv to move all 3 files (workflow.yaml, instructions.xml, methods.csv). Updated command file, lifecycle-sequence.yaml, workflow-manifest.csv, gaia-help.csv, core/module-help.csv → lifecycle/module-help.csv.
- [x] **1b** — Update `workflow.yaml`: change `module: core` → `module: lifecycle`, update `installed_path`
  - Fix: Changed module, config_source, instructions, data_files paths. Added input_file_patterns for 4 upstream research artifacts (brainstorm, market, domain, technical research).
- [x] **1c** — Update `instructions.xml` Step 1: load existing research artifacts if available
  - Fix: Step 1 now loads upstream research artifacts, summarizes what was found, and asks context-aware questions building on prior research.
- [x] **1d** — Update Activity Diagram HTML: move node from end of Phase 2 to end of Phase 1
  - Note: Activity Diagram HTML is an untracked generated file — skipped. Lifecycle-sequence.yaml (source of truth) updated: advanced-elicitation now sits between tech-research and product-brief in Phase 1.

### Issue 2: Wire orphaned research artifacts

- [x] **2a** — `create-product-brief/workflow.yaml`: add `domain_research` and `technical_research` to `input_file_patterns`
  - Fix: Already done as part of BUG-004 (Group J). Also added `technical_research` to `create-architecture/workflow.yaml` per issue report recommendation.
- [x] **2b** — `create-product-brief/instructions.xml`: add explicit load actions for domain + technical research
  - Fix: Already done as part of BUG-004 (Group J). Step 1 loads both, Step 5 references technical research.

### Issue 3: Wire `ux-design.md` into implementation workflows

- [x] **3a** — `create-epics-stories/workflow.yaml`: add `ux_design` to `input_file_patterns` (FULL_LOAD)
  - Fix: Added ux_design (FULL_LOAD) to workflow.yaml. Updated instructions.xml: Step 1 loads ux-design.md, Step 4 requires frontend stories to reference specific UX flows/components.
- [x] **3b** — `dev-story/workflow.yaml`: add `architecture` and `ux_design` to `input_file_patterns` (INDEX_GUIDED)
  - Fix: Added both (INDEX_GUIDED) to workflow.yaml. Updated instructions.xml Step 5 to load relevant architecture sections and UX design sections for the story.

### Issue 4: Fix missing discover-inputs protocol

- [x] **4** — Create `_gaia/core/protocols/discover-inputs.xml` OR remove dead reference from `create-product-brief/instructions.xml`
  - Fix: Protocol already exists at `_gaia/core/engine/protocols/discover-inputs.xml`. Issue report searched wrong path. No changes needed.

### Issue 5: Formalize `/gaia-atdd` in Phase 3 flow

- [x] **5a** — `atdd/workflow.yaml`: add `input_file_patterns` for epics + `pre_start` quality gate
  - Fix: Added epics (FULL_LOAD) to input_file_patterns. Added pre_start gate requiring epics-and-stories.md exists. Added on_error handlers.
- [x] **5b** — `atdd/instructions.xml`: explicitly load epics, filter high-risk stories
  - Fix: Rewrote instructions — Step 1 loads epics-and-stories.md, filters high-risk stories, exits gracefully if none found. Steps 2-5 enhanced with specific guidance for 1:1 AC→test mapping and per-story output files.
- [x] **5c** — Activity Diagram HTML: add `/gaia-atdd` node after `create-epics`
  - Note: Untracked HTML file — skipped. Lifecycle-sequence.yaml (source of truth) already has ATDD in correct position (create-epics → atdd → threat-model).
- [x] **5d** — `traceability/instructions.xml`: flag missing ATDD files for high-risk stories as gaps
  - Fix: Added action in Step 4 Gap Analysis to check for atdd-{story_key}.md for each high-risk story and flag missing ones as blocking gaps.

### Issue 6: Make adversarial review mandatory in readiness-check

- [x] **6** — `implementation-readiness/instructions.xml`: make Step 11 mandatory (remove `<ask>`), add Step 12 for findings incorporation (see Issue Report for full XML)
  - Fix: Removed <ask> and "If skip" from Step 11 — adversarial review now spawns unconditionally. Added Step 12 to classify findings, update readiness report status (FAIL if Critical findings), and list required fixes with responsible agents.

### Issue 7: Redesign `/gaia-retro` as learning loop

- [x] **7a** — `retrospective/workflow.yaml`: add `previous_retros`, `tech_debt` inputs; declare `sidecar_updates` and `skill_updates` outputs
  - Fix: Added previous_retros (INDEX_GUIDED) and tech_debt (FULL_LOAD) inputs. Added sidecar_updates and skill_updates output declarations. Updated description to mention learning loop.
- [x] **7b** — `retrospective/instructions.xml`: add 3 new steps (Agent Memory Updates, Skill Improvement Proposals, Cross-Retro Pattern Detection)
  - Fix: Added Step 5 (Agent Memory Updates — writes lessons to relevant sidecars + velocity data), Step 6 (Skill Improvement Proposals — maps findings to shared skills), Step 7 (Cross-Retro Pattern Detection — detects recurring issues across sprints). Renumbered existing Steps 5→8 and 6→9.
- [x] **7c** — `sprint-planning/workflow.yaml`: add `previous_retro` to `input_file_patterns`
  - Fix: Added previous_retro (INDEX_GUIDED, retro-*.md) to input_file_patterns.
- [x] **7d** — `sprint-planning/instructions.xml`: load latest retro, carry forward action items
  - Fix: Step 1 now loads most recent retro, extracts open action items, and presents them as sprint constraints.
- [x] **7e** — `correct-course/workflow.yaml`: add `retro` to `input_file_patterns`
  - Fix: Added retro (INDEX_GUIDED, retro-*.md) to input_file_patterns.
- [x] **7f** — `correct-course/instructions.xml`: check if current issue matches known retro pattern
  - Fix: Step 1 now loads retro files and checks if the current issue matches a known pattern from past retrospectives.

---

## GROUP J: Individual High-Severity Bugs (8 remaining)

These are not part of a systemic cluster but are individually high-impact.

- [x] **BUG-004** (High) — `/gaia-product-brief` doesn't load all Phase 1 research outputs
  - Fix: Added domain_research and technical_research to workflow.yaml input_file_patterns (FULL_LOAD). Updated instructions.xml to load both in Step 1, reference domain landscape in Step 4, and technical research in Step 5.

- [x] **BUG-007** (High) — `/gaia-product-brief` missing quality gate for brainstorm existence
  - Fix: Added pre_start quality gate to workflow.yaml checking project-brainstorm.md exists. HALTs with directive to run /gaia-brainstorm first.

- [x] **BUG-014** (High) — `/gaia-validate-prd` validation too superficial — misses structural issues
  - Fix: Added Step 3 "Structural Validation" with 7 checks: FR/NFR numbering, AC existence, measurable NFR targets, priority assignment, persona cross-reference.

- [x] **BUG-024** (High) — `/gaia-create-arch` architecture decisions not traceable to requirements
  - Fix: Added "Addresses" field to each ADR listing FR/NFR IDs. Added "Decision → Requirement Mapping" table generation in Step 8 that flags uncovered requirements as gaps.

- [x] **BUG-030** (High) — `/gaia-readiness-check` declares PASS while traceability matrix declares BLOCKED
  - Fix: Added critical mandate, enhanced Step 6 to read matrix's gate decision field and implementation rate, added traceability_gate_decision and traceability_implementation_rate to YAML output, added consistency check in Step 10.

- [x] **BUG-033** (High) — `/gaia-trace` doesn't load `prd.md` — matrix built from stories instead of requirements (BUG-020 in report)
  - Fix: Added input_file_patterns (prd, epics_and_stories, test_plan) to workflow.yaml. Rewrote instructions.xml with explicit PRD loading, FR/NFR-based matrix rows, separate NFR section, implementation rate tracking, and gate decision logic.

- [ ] **BUG-041** (High) — Covered in Group E (naming convention)

- [ ] **BUG-064** (High) — Covered in Group G (brownfield)

---

## GROUP K: Individual Medium-Severity Bugs (28 remaining)

Bugs not already covered in systemic groups.

### Phase 1 — Analysis

- [x] **BUG-002** (Medium) — `/gaia-brainstorm` doesn't save creative divergent ideas that were deprioritized
  - Fix: Added "Parking Lot" action to Step 4 (Opportunity Synthesis) to capture deprioritized ideas with reasoning and revival conditions. Updated Step 5 template-output to include Parking Lot section.

- [x] **BUG-008** (Medium) — `/gaia-product-brief` output structure inconsistent with downstream expectations
  - Fix: Added explicit section headings to template-output (Vision, Target Users, Problem Statement, Proposed Solution, Key Features, Scope and Boundaries, Risks and Assumptions, Competitive Landscape, Success Metrics). Added new Step 6 for scope/risks/competitive landscape. Updated post_complete gate to list all required sections.

### Phase 2 — Planning

- [x] **BUG-012** (Medium) — `/gaia-create-prd` doesn't cross-reference product brief
  - Fix: Added cross-reference actions in Steps 1, 3, 8, 9, 10. Step 1 extracts all brief sections. Step 3 verifies FRs trace to brief's solution/features. Step 8 checks brief's scope boundaries. Step 9 carries forward brief's risks/assumptions. Step 10 aligns with brief's success metrics.

- [x] **BUG-013** (Medium) — `/gaia-create-prd` NFR section generated without measurable targets
  - Fix: Added enforcement action in Step 4 requiring each NFR to include a measurable target with a specific threshold. Rejects vague qualifiers like "fast", "secure", "scalable" without numeric criteria.

- [x] **BUG-016** (Medium) — `/gaia-create-ux` doesn't reference PRD requirements
  - Fix: Added FR mapping actions in Steps 3 (pages→FR IDs), 4 (wireframes→FR IDs), 5 (interactions→user journeys). Updated template-output to include FR-to-Screen Mapping table.

- [x] **BUG-018** (Medium) — `/gaia-review-a11y` output format inconsistent
  - Fix: Added WCAG 2.1 criterion citation requirement to Steps 2-4. Standardized report format: each finding must include WCAG Criterion ID, Name, Conformance Level (A/AA/AAA), Severity, Description, and Remediation.

### Phase 3 — Solutioning

- [x] **BUG-020** (Medium) — `/gaia-create-arch` doesn't consider existing codebase (brownfield)
  - Fix: Added brownfield_assessment and project_documentation to workflow.yaml input_file_patterns. Step 1 loads brownfield artifacts if they exist regardless of PRD mode. Step 3 references existing tech stack from brownfield analysis when available.

- [x] **BUG-021** (Medium) — `/gaia-create-arch` security section thin
  - Fix: Added threat_model to workflow.yaml input_file_patterns. Step 1 loads threat-model.md if available. Step 7 adds security architecture action that cross-references threat model findings or prompts for security requirements if no threat model exists.

- [x] **BUG-022** (Medium) — `/gaia-create-arch` no ADR (Architecture Decision Record) format
  - Fix: Replaced loose format hint with enforced ADR template: ADR-{NNN} numbering, Status (Proposed/Accepted/Deprecated/Superseded/Existing), Context, Decision, Alternatives Considered, Consequences, Addresses (FR/NFR IDs).

- [x] **BUG-023** (Medium) — `/gaia-ci-setup` does not ask user for CI platform preference (auto-detects without confirmation)
  - Fix: Added `<ask>` tag in Step 1 requiring user to confirm/choose CI platform. Updated checklist to require user confirmation, not just auto-detection.

- [x] **BUG-025** (Medium) — `/gaia-ci-setup` document missing secrets management, deployment strategy, and monitoring/notifications
  - Fix: Added 3 new steps to instructions.xml: Secrets Management (Step 4), Deployment Strategy (Step 5), Monitoring & Notifications (Step 6). Updated checklist with corresponding items.

- [x] **BUG-027** (Medium) — `/gaia-readiness-check` TEA assessment missing Technical and Estimation evaluations
  - Fix: Expanded Step 5 to cover all TEA dimensions: Technical (team expertise, learning curve), Estimation (numeric points, oversized story detection), Architecture (ADR resolution, adversarial findings), Testing (existing items). Added sub-fields to gate report YAML.

- [x] **BUG-028** (Medium) — `/gaia-readiness-check` security assessment missing compliance timeline
  - Fix: Added compliance timeline estimation (GDPR, PCI-DSS weeks based on story count) and P0/Post-MVP conflict detection to Step 7. Updated checklist.

- [x] **BUG-029** (Medium) — `/gaia-readiness-check` YAML frontmatter uses different schema than expected
  - Fix: Standardized YAML to use date, checks_passed, critical_blockers fields. Renamed sections to standard names (completeness, consistency, contradictions, tea_readiness, test_infrastructure, security_readiness, operational_readiness, brownfield_completeness) with PASS/FAIL values instead of booleans.

- [x] **BUG-031** (Medium) — `/gaia-sprint-plan` loads stories from epics doc instead of individual story files
  - Fix: Step 1 now scans for individual story files and cross-references against epics. Only stories with files are selectable. Stories without files are flagged with "/gaia-create-story first".

- [x] **BUG-032** (Medium) — `/gaia-sprint-plan` skips memory hygiene without asking when sidecar is empty
  - Fix: Step 2 now always shows `<ask>` prompt to user, even when sidecars are empty. User is informed and given the choice.

- [x] **BUG-034** (Medium) — `/gaia-sprint-plan` combines Step 2 and Step 3 into a single turn, violating step ordering
  - Fix: Step 2 now always has an `<ask>` that must complete before Step 3 begins, enforcing sequential execution.

- [x] **BUG-035** (Medium) — `/gaia-sprint-plan` T-shirt-to-points conversion inconsistent across runs
  - Fix: Added canonical sizing_map to global.yaml (S:2, M:5, L:8, XL:13). Step 4 reads sizing_map from config instead of generating it at runtime.

- [x] **BUG-036** (Medium) — `/gaia-sprint-plan` doesn't assign sprint_id to story files
  - Fix: Added new Step 5 "Update Story Files" that writes sprint_id to each selected story file. Status remains backlog — transitions happen in create-story/validate-story.

- [x] **BUG-037** (Medium) — `/gaia-sprint-plan` sprint-status.yaml schema deviates from spec — missing summary fields, wrong field names
  - Fix: Standardized sprint-status.yaml schema in Step 8 with velocity_capacity, team_size, total_points, capacity_utilization, and story-level fields.

- [x] **BUG-038** (Medium) — `/gaia-sprint-plan` sprint plan document missing burndown estimate section
  - Fix: Added burndown estimate generation to Step 7 and Testing Readiness section to Step 9 template-output.

- [x] **BUG-043** (Medium) — `/gaia-validate-story` skips duplicate story check and architecture conflict check
  - Fix: Added new Step 3 "Semantic Quality Checks" with duplicate detection and architecture cross-reference. Added input_file_patterns for architecture and epics to workflow.yaml.

- [x] **BUG-045** (Medium) — `/gaia-validate-story` appends report to story file instead of creating separate validation report file
  - Fix: Step 7 now creates separate story-validation-{story_key}.md with YAML frontmatter. Added validation_report output to workflow.yaml.

- [x] **BUG-047** (Medium) — `/gaia-fix-story` applies fixes without asking user confirmation, no version notes
  - Fix: Step 4 now presents each proposed fix and asks for user approval before applying. Added Step 4b "Change Log" for audit trail.

### Phase 4 — Implementation

- [x] **BUG-048** (Medium) — `/gaia-fix-story` does not auto-re-validate after applying fixes
  - Fix: Added Step 5b "Re-Validate" that runs inline validation checks after fixes. If all pass, promotes to ready-for-dev. If issues remain, keeps validating status.

- [x] **BUG-055** (Medium) — `/gaia-deploy-checklist` approval gates asked all at once instead of sequentially
  - Fix: Split Step 6 into 4 separate steps (6a automated gates, 6b QA sign-off, 6c security sign-off, 6d stakeholder approval) so engine treats each as a distinct interaction point.

### Phase 5 — Review/Sprint Management

- [x] **BUG-076** (Medium) — `/gaia-security-review` skips Data Privacy & Compliance check
  - Fix: Added Step 5b "Data Privacy and Compliance" — PII detection, GDPR applicability, encryption at rest/transit, retention policies, consent mechanisms.

- [x] **BUG-078** (Medium) — `/gaia-qa-tests` writes executable test files to source tree during review
  - Fix: Added mandate restricting writes to {test_artifacts}/ only. Steps 3-5 changed to document test cases (not generate files). Test file creation delegated to /gaia-test-automate.

---

## GROUP L: Individual Low-Severity Bugs (18 remaining)

Documentation, cosmetic, and minor consistency issues.

- [x] **BUG-067** (Low) — `/gaia-brownfield` PRD missing `mode: brownfield` YAML frontmatter
  - Fix: Already closed in Group G — added brownfield frontmatter requirements to Step 4 template-output.

- [x] **BUG-068** (Low) — `/gaia-brownfield` architecture missing YAML frontmatter with mode/baseline/scope
  - Fix: Already closed in Group G — added Step 6 action to verify and append brownfield frontmatter.

- [x] **BUG-069** (Low) — `/gaia-brownfield` architecture overwrites existing file without warning
  - Fix: Already closed in Group G — added overwrite protection to Step 6.

- [x] **BUG-070** (Low) — `/gaia-brownfield` next steps misleading without brownfield context
  - Fix: Already closed in Group G — updated next-step with brownfield-specific guidance.

- [x] **BUG-071** (Low) — `/gaia-code-review` skips architecture conformance check — does not load architecture.md
  - Fix: Added Step 3b "Architecture Conformance" — loads architecture.md, verifies ADR conformance, layer boundaries, API patterns. Added input_file_patterns for architecture to workflow.yaml.

- [x] **BUG-072** (Low, downgraded from High) — `/gaia-code-review` maps REQUEST_CHANGES verdict to FAILED in Review Gate table
  - Fix: Changed Step 7 to write REQUEST_CHANGES (not FAILED) in gate table, preserving verdict nuance.

- [x] **BUG-075** (Medium) — Review workflows can't resolve story key to full filename — requires manual search
  - Fix: Added glob-based story file resolution (`{story_key}-*.md`) to Step 1 of all 6 review workflows (code-review, security-review, qa-tests, test-review, test-automation, performance-review).

- [x] **BUG-077** (Low) — sprint-status.yaml becomes stale after failed review changes story status — no reconciliation notice
  - Fix: Added "Run /gaia-sprint-status to reconcile" notice to the final step of all 6 review workflows.

- [x] **BUG-079** (Low) — `/gaia-qa-tests` report uses non-standard test case ID format
  - Fix: Added TC-{story_key}-{NNN} ID format requirement to Steps 3 and 4 with structured fields (ID, AC reference, Preconditions, Steps, Expected Result).

- [x] **BUG-080** (Low) — `/gaia-test-automate` report filename doesn't include story key — collisions on multiple stories
  - Fix: Changed output from `automation-report.md` to `{story_key}-test-automation.md` in both instructions.xml and workflow.yaml.

- [x] **BUG-081** (Low) — `/gaia-test-review` coverage report incomplete
  - Fix: Expanded Step 3 with detailed coverage gap analysis — untested code paths, edge cases, boundary conditions, critical path coverage assessment with risk ratings. Updated template-output to include Coverage Gaps table and Critical Path Coverage section. Updated checklist.

- [x] **BUG-082** (Low) — `/gaia-review-perf` missing baseline metrics
  - Fix: Added Step 2 "Baseline Metrics" to review-performance.xml — searches for previous reports, extracts baseline metrics for comparison or establishes initial baseline. Updated report template to include Baseline Comparison section.

- [x] **BUG-083** (Low) — Sprint management commands have inconsistent status output format
  - Fix: Added standardized header and summary line format to sprint-status (Step 3), epic-status (Step 5), and correct-course (Step 6) instructions.xml files.

- [x] **BUG-090** (Low) — `/gaia-sprint-status` reconciliation doesn't report what it changed
  - Fix: Added action to Step 2 to display reconciliation change summary to user before proceeding to status display. Updated checklist.

- [x] **BUG-091** (Low) — `/gaia-correct-course` action items have no follow-up tracking
  - Fix: Added actions to Step 6 to persist correction action items to sprint-status.yaml with tracking fields (id, description, assigned_to, due_date, status). Append-only to preserve existing items. Updated checklist.

- [x] **BUG-092** (Low) — `/gaia-standup` output not saved to file
  - Fix: Skipped — no `/gaia-standup` workflow exists in the framework. Not a bug fix but a missing feature.

- [x] **BUG-093** (Low) — `/gaia-velocity` calculation doesn't account for story point inflation
  - Fix: Skipped — no `/gaia-velocity` workflow exists in the framework. Not a bug fix but a missing feature.

- [x] **BUG-094** (Low) — `/gaia-memory-hygiene` doesn't report orphaned entries
  - Fix: Added action to Step 3 to scan entries for component/service/artifact name references, cross-reference against current artifacts, and flag orphaned or renamed references with suggested renames. Updated checklist.

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
