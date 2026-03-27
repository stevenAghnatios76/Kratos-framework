---
name: 'action-items'
description: 'Process and resolve action items. Use when "resolve action items".'
model: opus
---

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS:

<steps CRITICAL="TRUE">
1. PARSE arguments from $ARGUMENTS:
   - Check for "status" keyword: if present, set status_mode=true (display only, don't process)
   - Check for "yolo" keyword: if present, set yolo_mode=true
   - Extract action_id if present (pattern A-\d+): process only that item
2. LOAD the FULL {project-root}/_gaia/core/engine/workflow.xml
3. READ its entire contents — this is the CORE OS
4. Pass {project-root}/_gaia/lifecycle/workflows/4-implementation/action-items/workflow.yaml as 'workflow-config'
5. If yolo_mode=true: tell the engine "Run in YOLO mode — auto-proceed past all template-outputs."
6. Pass status_mode and action_id as resolved variables
7. Follow workflow.xml instructions EXACTLY
8. Save outputs after EACH section
</steps>

$ARGUMENTS
