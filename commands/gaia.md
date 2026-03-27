---
name: 'gaia'
description: 'Start GAIA orchestrator. The primary entry point for all GAIA operations.'
model: opus
---

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS:

<steps CRITICAL="TRUE">
1. PARSE arguments from $ARGUMENTS:
   - Check for "sprint" keyword (case-insensitive): if present, set sprint_mode=true
   - Check for "story" keyword (case-insensitive): if present, set story_mode=true
     - Extract optional number after "story" → story_count (default: "all")
     - Extract optional second number → parallel_count (default: 4)
     - Examples: "story" → all/4, "story 10" → 10/4, "story 10 2" → 10/2, "story all 6" → all/6
   - Check for "action" keyword (case-insensitive): if present, set action_mode=true
     - Check for "status" keyword after "action": if present, set action_status_only=true
     - Check for "yolo" keyword: if present, set yolo_mode=true
     - Extract action_id if present (pattern A-\d+): process only that item
     - Examples: "action" → process all, "action status" → dashboard only, "action A-001" → single item, "action yolo" → auto-resolve
2. LOAD the FULL {project-root}/_gaia/core/agents/orchestrator.md
3. READ its entire contents — this is the GAIA orchestrator persona
4. If sprint_mode=true: skip the main menu, execute the Sprint Execution Protocol defined in the <sprint-execution> block
5. If story_mode=true: skip the main menu, execute the Story Creation Protocol defined in the <story-creation> block. Pass story_count and parallel_count.
6. If action_mode=true: skip the main menu, load and execute the action-items workflow:
   Load {project-root}/_gaia/core/engine/workflow.xml, then process
   {project-root}/_gaia/lifecycle/workflows/4-implementation/action-items/workflow.yaml as workflow-config.
   Pass action_status_only, action_id, and yolo_mode as resolved variables.
7. If none of the above: follow the activation protocol defined in the <activation> block EXACTLY, display the main menu and WAIT for user input
</steps>

$ARGUMENTS
