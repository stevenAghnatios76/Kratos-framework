---
template: 'brownfield-onboarding'
version: 1.0.0
used_by: ['brownfield-onboarding']
---

# Developer Knowledge Base: {product_name}

> **Project:** {project_name}
> **Date:** {date}
> **Author:** {agent_name}
> **Mode:** Brownfield onboarding — complete developer reference

## 1. Quick Start

{Get the project running in 5 minutes.}

### Prerequisites

- {runtime and version}
- {package manager}
- {required services: database, cache, etc.}

### Setup

```bash
# Clone and install
{clone_command}
{install_command}

# Configure environment
{env_setup_steps}

# Start development
{start_command}
```

### Verify

```bash
# Run tests to confirm setup
{test_command}
```

## 2. Project Overview

{2-3 paragraph summary of what this project does, who uses it, and its current state.}

**Full documentation:** [Project Documentation](project-documentation.md)

## 3. Architecture Overview

{Summary of the system architecture: components, how they connect, key design decisions.}

**Key architectural patterns:** {list the main patterns: MVC, microservices, event-driven, etc.}

**Full documentation:** [Architecture Document](architecture.md)

## 4. API Reference

{Summary of the API layer: number of endpoints, main resource groups, auth approach.}

| Resource Group | Endpoints | Auth Required |
|---------------|-----------|---------------|
| {group} | {count} | {yes/no} |

**Full documentation:** [API Documentation](api-documentation.md)

## 5. UX & Frontend Patterns

{Summary of UI framework, component library, key patterns. Skip this section if no frontend.}

**Full documentation:** [UX Design Assessment](ux-design.md)

## 6. Event Architecture

{Summary of messaging infrastructure: system used, key events, producers/consumers. Skip if no events.}

**Full documentation:** [Event Catalog](event-catalog.md)

## 7. External Dependencies

{Summary of what external services and infrastructure the project depends on.}

**Full documentation:** [Dependency Map](dependency-map.md)

## 8. Code Quality & NFR Baselines

{Summary of current quality state: test coverage, linting, security, performance.}

| Category | Current State | Target |
|----------|--------------|--------|
| {category} | {state} | {target} |

**Full documentation:** [NFR Assessment](nfr-assessment.md)

## 9. Gap Analysis & Roadmap

{Summary of identified gaps between current state and desired state. Key priorities.}

**Full documentation:** [Product Requirements (Gaps)](prd.md)

## 10. Stories for Development

{Summary of epics and story count. Current sprint focus.}

| Epic | Stories | Priority |
|------|---------|----------|
| {epic_name} | {count} | {P0-P3} |

**Full documentation:** [Epics and Stories](epics-and-stories.md)

## 11. Conventions & Patterns

### Code Conventions

- **Naming:** {conventions for files, functions, variables, components}
- **File structure:** {how code is organized: by feature, by layer, etc.}
- **Import order:** {convention if any}
- **Error handling:** {pattern used}

### Git Conventions

- **Branch naming:** {pattern}
- **Commit messages:** {format}
- **PR process:** {description}

### Testing Conventions

- **Test location:** {co-located / separate test dir}
- **Naming pattern:** {*.test.ts / *.spec.ts / etc.}
- **Required coverage:** {threshold if configured}
- **Test types used:** {unit / integration / e2e}

## 12. Key Files & Entry Points

| File | Purpose |
|------|---------|
| {main entry point} | {Application bootstrap} |
| {config file} | {Primary configuration} |
| {route definitions} | {API/page routing} |
| {database config} | {Database connection and migrations} |
| {test config} | {Test framework configuration} |
| {CI config} | {Build and deploy pipeline} |

## Reading Order for New Developers

1. **Start here** — Read this onboarding document
2. **Understand the system** — Read [Architecture](architecture.md) for the big picture
3. **Know the APIs** — Read [API Documentation](api-documentation.md) if working on backend
4. **Know the UI** — Read [UX Design](ux-design.md) if working on frontend
5. **Understand quality bar** — Read [NFR Assessment](nfr-assessment.md) for coding standards
6. **See what's planned** — Read [PRD](prd.md) and [Stories](epics-and-stories.md)
7. **Pick a story** — Start with a small gap story to learn the codebase
