---
title: 'Epic Status Dashboard Validation'
validation-target: 'Epic status dashboard output'
---
## Completeness
- [ ] All epics from epics-and-stories.md are represented
- [ ] All stories per epic are accounted for
- [ ] Stories with no file are listed as backlog

## Accuracy
- [ ] Story counts per epic are correct
- [ ] Done counts match stories with status: done
- [ ] Completion percentages are mathematically correct (done/total * 100)

## Display
- [ ] Summary table shows all epics with counts and percentages
- [ ] Per-epic detail sections include ASCII progress bars
- [ ] Per-epic story tables show key, title, status, sprint
- [ ] Completed epics are marked with [COMPLETE]
- [ ] Untracked stories section is present (even if empty)
- [ ] Legend section is present

## Output
- [ ] File written to {implementation_artifacts}/epic-status.md
- [ ] File uses the epic-status-template.md structure
