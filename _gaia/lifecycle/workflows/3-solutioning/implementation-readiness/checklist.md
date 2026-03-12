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
- [ ] prd.md contains "Review Findings Incorporated" section
- [ ] architecture.md contains "Review Findings Incorporated" section
## Cross-Artifact Contradictions
- [ ] Architecture decisions checked against threat model security requirements (if threat-model.md exists)
- [ ] Architecture topology checked against infrastructure deployment topology (if infrastructure-design.md exists)
- [ ] Story component references verified against architecture component inventory
- [ ] PRD NFR targets verified against architecture design decisions
- [ ] Critical/high security requirements verified against story acceptance criteria (if threat-model.md exists)
- [ ] Auth strategy alignment verified across PRD, architecture, and threat model
- [ ] contradiction_check field present in gate report YAML frontmatter
- [ ] All BLOCKING contradictions listed in blocking_issues
- [ ] Contradictions table included in report body
## TEA Readiness
- [ ] Technical: team expertise evaluated against chosen stack, learning curve assessed
- [ ] Estimation: stories use numeric points (not just T-shirt sizes), no oversized stories (>13 pts)
- [ ] Architecture: all ADRs resolved (none Proposed), adversarial findings incorporated, threat model reviewed
- [ ] Testing: acceptance criteria testable, NFR targets quantified
## Test Infrastructure
- [ ] test-plan.md exists at {test_artifacts}/test-plan.md
- [ ] traceability-matrix.md covers all PRD requirements
- [ ] ci-setup.md has enforced quality gates (not advisory-only)
- [ ] Gate report includes test_plan_exists, traceability_complete, ci_gates_enforced
## Security
- [ ] Security requirements documented
- [ ] Auth strategy defined
- [ ] Compliance timeline estimated (GDPR, PCI-DSS if applicable)
- [ ] No P0 compliance stories in Post-MVP epics (or flagged as WARNING)
## Operational Readiness
- [ ] Rollback procedure documented and feasible
- [ ] Observability stack defined (logging, metrics, alerting)
- [ ] Release strategy defined and infrastructure supports it
- [ ] Gate report includes rollback_feasible, observability_ready, release_strategy_defined
## Brownfield Completeness (if brownfield-onboarding.md exists)
- [ ] dependency-map.md exists with Mermaid dependency graph
- [ ] nfr-assessment.md exists at {test_artifacts}/nfr-assessment.md with real baseline values
- [ ] api-documentation.md exists with OpenAPI spec (if APIs detected)
- [ ] event-catalog.md exists with event tables (if events detected)
- [ ] ux-design.md exists with accessibility assessment (if frontend detected)
- [ ] architecture.md has as-is/target sections with Mermaid diagrams
- [ ] PRD NFR section references nfr-assessment.md baselines
- [ ] brownfield-onboarding.md links to all generated artifacts
- [ ] dependency-audit-{date}.md exists in planning-artifacts
## Report
- [ ] Machine-readable YAML frontmatter present
- [ ] date field present in YAML
- [ ] checks_passed aggregate (e.g., "7/8") in YAML
- [ ] critical_blockers count in YAML
- [ ] PASS/FAIL status clear
- [ ] Section names use standard schema (completeness, consistency, contradictions, tea_readiness, test_infrastructure, security_readiness, operational_readiness, brownfield_completeness)
- [ ] Values use PASS/FAIL (not boolean true/false), brownfield uses N/A when skipped
- [ ] contradictions_found and contradictions_blocking counts in frontmatter
- [ ] Blocking issues listed if FAIL
## Output Verification
- [ ] Output file exists at {planning_artifacts}/readiness-report.md
