# Epic Status Dashboard

> Generated: {date} | Sprint coverage: all sprints

---

## Summary

| # | Epic | Stories | Done | In Progress | Remaining | Completion |
|---|------|---------|------|-------------|-----------|------------|
{epic_summary_rows}

**Overall: {total_done}/{total_stories} stories done ({overall_percent}%)**

---

## Epic Details

{per_epic_details}

### Epic {epic_number}: {epic_title}

**Goal:** {epic_goal}

**Progress:** `[{progress_bar}]` {done_count}/{story_count} ({percent}%) {complete_tag}

| Story | Title | Status | Sprint |
|-------|-------|--------|--------|
{story_rows}

**Done criteria:** {done_criteria}

---

## Untracked Stories

Stories listed in epics-and-stories.md with no `.md` file found (assumed `backlog`):

| Story | Epic | Assumed Status |
|-------|------|----------------|
{untracked_rows}

---

## Legend

| Status | Description |
|--------|-------------|
| `backlog` | Not yet started, no story file or story file with backlog status |
| `ready-for-dev` | Story refined and ready for development |
| `in-progress` | Currently being worked on |
| `blocked` | Work stopped due to dependency or issue |
| `review` | Implementation complete, awaiting review |
| `done` | Accepted and complete |
| `[COMPLETE]` | All stories in the epic are done |
