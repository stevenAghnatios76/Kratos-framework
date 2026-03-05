---
template: 'story'
version: 1.1.0
used_by: ['create-story']
---

# Story: {story_title}

> **Epic:** {epic_name}
> **Sprint:** {sprint_number}
> **Date:** {date}
> **Author:** {agent_name}
> **Status:** backlog | ready-for-dev | in-progress | review | done
> **Traces to:** {requirement_id}

## User Story

As a {role}, I want to {action}, so that {benefit}.

## Acceptance Criteria

- [ ] Given {context}, when {action}, then {expected result}
- [ ] Given {context}, when {action}, then {expected result}

## Tasks / Subtasks

- [ ] Task 1 (AC: #)
  - [ ] Subtask 1.1
- [ ] Task 2 (AC: #)
  - [ ] Subtask 2.1

## Dev Notes

- Relevant architecture patterns and constraints
- Source tree components to touch
- Testing standards summary

## Technical Notes

{Implementation guidance, architecture constraints, relevant patterns.}

## Dependencies

- {Dependency on other story or system}

## Test Scenarios

| # | Scenario | Input | Expected |
|---|----------|-------|----------|
| 1 | {happy path} | {input} | {output} |
| 2 | {edge case} | {input} | {output} |

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming)
- Detected conflicts or variances (with rationale)

### References

- Cite all technical details with source paths and sections, e.g. [Source: docs/<file>.md#Section]

## Dev Agent Record

### Agent Model Used

{agent_model_name_version}

### Debug Log References

### Completion Notes List

### File List

## Estimate

- **Points:** {story points}
- **Developer:** {assigned agent}

## Definition of Done

- [ ] Define all the Definition of Done
