---
title: 'Brownfield Onboarding Validation'
validation-target: 'Brownfield onboarding output'
---
## Discovery
- [ ] Existing project documented
- [ ] Tech stack identified
- [ ] Current architecture mapped
- [ ] Capability flags detected (has_apis, has_events, has_external_deps, has_frontend)
- [ ] Testing infrastructure assessed
- [ ] CI/CD pipeline documented
## API Documentation (if has_apis)
- [ ] OpenAPI/Swagger spec status checked (existing spec found or generated)
- [ ] Endpoint inventory table complete
- [ ] Authentication and authorization documented
- [ ] Error response format documented
- [ ] Mermaid API flow diagram included
- [ ] Undocumented endpoints listed as gaps
## UX Design Assessment (if has_frontend)
- [ ] Existing UI patterns documented (component library, design system, styling)
- [ ] Navigation structure documented with Mermaid sitemap
- [ ] Interaction patterns assessed (forms, modals, notifications)
- [ ] Accessibility assessment completed (WCAG level, gaps)
- [ ] UX gap analysis identifies only gap-focused improvements
## Event & Messaging Catalog (if has_events)
- [ ] Messaging infrastructure documented
- [ ] Produced events cataloged with schemas
- [ ] Consumed events cataloged with handlers
- [ ] Delivery guarantees and DLQ configuration documented
- [ ] Mermaid event flow diagrams included
## Dependency Map
- [ ] External service dependencies documented
- [ ] Infrastructure dependencies documented
- [ ] Key library dependencies documented with CVE risk
- [ ] Mermaid dependency graph included
- [ ] Risks and recommendations identified
## NFR Assessment
- [ ] Code quality baselines measured
- [ ] Security posture assessed
- [ ] Performance baselines documented
- [ ] Test coverage baselines measured
- [ ] CI/CD assessment completed
- [ ] NFR baseline summary table has real values (not placeholders)
## Gap Analysis
- [ ] PRD created with gap-focused content only
- [ ] NFR section includes current baseline and target from nfr-assessment.md
- [ ] Upstream artifacts referenced (api-docs, event-catalog, dependency-map, ux-design)
- [ ] Priority matrix maps each gap to priority/effort/impact
## Architecture
- [ ] As-is architecture documented with Mermaid C4 diagrams (Level 1 and Level 2)
- [ ] 3-5 key flow sequence diagrams in Mermaid syntax
- [ ] Data flow diagram in Mermaid syntax
- [ ] Target architecture for gaps documented
- [ ] As-is vs target delta table included
- [ ] Cross-references to api-documentation.md, event-catalog.md, dependency-map.md
## Epics/Stories & Onboarding
- [ ] Stories created only for gaps
- [ ] Stories trace to PRD requirement IDs
- [ ] All stories have acceptance criteria
- [ ] Developer knowledge base generated as index linking all artifacts
- [ ] Quick-start guide included
- [ ] Reading order for new developers included
## Output Verification
- [ ] Project documentation exists at {planning_artifacts}/project-documentation.md
- [ ] API documentation exists at {planning_artifacts}/api-documentation.md (if has_apis)
- [ ] UX design exists at {planning_artifacts}/ux-design.md (if has_frontend)
- [ ] Event catalog exists at {planning_artifacts}/event-catalog.md (if has_events)
- [ ] Dependency map exists at {planning_artifacts}/dependency-map.md
- [ ] NFR assessment exists at {planning_artifacts}/nfr-assessment.md
- [ ] PRD exists at {planning_artifacts}/prd.md
- [ ] Architecture exists at {planning_artifacts}/architecture.md
- [ ] Epics and stories exist at {planning_artifacts}/epics-and-stories.md
- [ ] Onboarding document exists at {planning_artifacts}/brownfield-onboarding.md
