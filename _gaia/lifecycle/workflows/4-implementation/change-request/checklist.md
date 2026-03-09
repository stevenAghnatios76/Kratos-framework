---
title: 'Change Request Validation'
validation-target: 'Change request with impact analysis'
---
## Capture
- [ ] Change description documented
- [ ] Source/driver identified
- [ ] Urgency classified (critical/high/normal)
- [ ] CR ID assigned (CR-{date}-{seq})
## Impact Analysis
- [ ] Requirements impact assessed (NONE/MINOR/SIGNIFICANT/BREAKING)
- [ ] Technical impact assessed (NONE/MINOR/SIGNIFICANT/BREAKING)
- [ ] Sprint/effort impact assessed (ABSORBABLE/NEXT_SPRINT/MULTI_SPRINT)
- [ ] Affected artifacts identified
- [ ] Effort estimated (story points)
## Approval
- [ ] Impact analysis presented to user
- [ ] User APPROVED or REJECTED the change
## Cascade Updates (if approved)
- [ ] PRD updated (or skipped — requirements_impact = NONE)
- [ ] Architecture updated (or skipped — technical_impact = NONE)
- [ ] Stories created/modified (or skipped — no story changes needed)
## Output
- [ ] Change request record generated at {planning_artifacts}/change-request-{cr_id}.md
- [ ] Downstream next steps communicated
