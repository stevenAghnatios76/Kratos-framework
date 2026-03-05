---
title: 'Implementation Readiness Check'
validation-target: 'Readiness gate report'
---
## Artifacts
- [ ] PRD exists and is complete
- [ ] UX Design exists and is complete
- [ ] Architecture exists and is complete
- [ ] Epics/Stories exist and are complete
## Consistency
- [ ] Stories trace to PRD requirements
- [ ] Architecture covers all features
## TEA Readiness
- [ ] Acceptance criteria are testable
- [ ] NFR targets quantified
## Security
- [ ] Security requirements documented
- [ ] Auth strategy defined
## Brownfield Completeness (if brownfield-onboarding.md exists)
- [ ] dependency-map.md exists with Mermaid dependency graph
- [ ] nfr-assessment.md exists with real baseline values
- [ ] api-documentation.md exists with OpenAPI spec (if APIs detected)
- [ ] event-catalog.md exists with event tables (if events detected)
- [ ] ux-design.md exists with accessibility assessment (if frontend detected)
- [ ] architecture.md has as-is/target sections with Mermaid diagrams
- [ ] PRD NFR section references nfr-assessment.md baselines
- [ ] brownfield-onboarding.md links to all generated artifacts
## Report
- [ ] Machine-readable YAML frontmatter present
- [ ] PASS/FAIL status clear
- [ ] Blocking issues listed if FAIL
## Output Verification
- [ ] Output file exists at {planning_artifacts}/readiness-report.md
