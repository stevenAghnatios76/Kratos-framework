---
name: 'resume'
description: 'Resume from last checkpoint after context loss or session break.'
model: sonnet
---

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS:

<steps CRITICAL="TRUE">
1. SCAN {project-root}/_memory/checkpoints/ for .yaml files (exclude completed/)
2. If no checkpoints found: report "No active workflows to resume" and suggest /gaia
3. If one checkpoint: display its summary and offer Resume / Restart / Discard
4. If multiple checkpoints: list all with timestamps, ask user which to resume
5. INTEGRITY CHECK: If selected checkpoint has `files_touched` entries:
   - For each entry: run `shasum -a 256 {path}`, compare against stored checksum
   - If file deleted since checkpoint: flag as "DELETED since checkpoint"
   - If checksum differs: flag as "MODIFIED since checkpoint"
   - If all match: report "All files unchanged since checkpoint" and proceed to step 6
   - If mismatches found: display list of changed files, offer **Proceed** (resume anyway) / **Start fresh** (discard checkpoint) / **Review** (show `git diff` for each changed file, then ask again)
   - If checkpoint has no `files_touched`: skip validation, proceed to step 6
6. On resume: load the workflow.yaml from checkpoint, skip to the recorded step number
7. Continue execution from that step
</steps>

$ARGUMENTS
