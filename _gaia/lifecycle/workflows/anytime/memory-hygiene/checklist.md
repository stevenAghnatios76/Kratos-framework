---
title: 'Memory Hygiene Validation'
validation-target: 'Memory hygiene report'
---

## Scan
- [ ] All 9 sidecar directories enumerated
- [ ] Empty sidecars identified and skipped
- [ ] Session/creative logs (orchestrator, storyteller) skipped

## Cross-Reference
- [ ] Available reference artifacts loaded (architecture.md, prd.md, test-plan.md, etc.)
- [ ] Each sidecar entry compared against its reference artifact
- [ ] Each entry classified as ACTIVE, STALE, CONTRADICTED, or ORPHANED
- [ ] Orphaned and renamed artifact references detected and reported

## User Actions
- [ ] All flagged entries presented to user with evidence
- [ ] User confirmed action (Keep/Archive/Delete) for each flagged entry
- [ ] Sidecar files updated per user choices
- [ ] Sidecar headers and marker comments preserved after edits

## Output
- [ ] Report saved to {implementation_artifacts}/memory-hygiene-report-{date}.md
