---
name: 'triage-findings'
description: 'Triage development findings into backlog stories. Use when "triage findings".'
model: sonnet
---

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS:

<steps CRITICAL="TRUE">
1. PARSE arguments from $ARGUMENTS:
   - Check for "yolo" keyword (case-insensitive): if present, set yolo_mode=true
2. LOAD the FULL {project-root}/_gaia/core/engine/workflow.xml
3. READ its entire contents — this is the CORE OS
4. Pass {project-root}/_gaia/lifecycle/workflows/4-implementation/triage-findings/workflow.yaml as 'workflow-config'
5. If yolo_mode=true: tell the engine "Run in YOLO mode — auto-proceed past all template-outputs."
6. Follow workflow.xml instructions EXACTLY
7. Save outputs after EACH section
</steps>

$ARGUMENTS
