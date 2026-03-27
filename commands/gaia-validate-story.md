---
name: 'validate-story'
description: 'Full story validation with factual verification. Use when "validate story".'
model: opus
---

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS:

<steps CRITICAL="TRUE">
1. PARSE arguments from $ARGUMENTS:
   - Extract story_key (optional): pattern like E1-S1, E2-S3, etc. (matching E\d+-S\d+)
   - Check for "yolo" keyword (case-insensitive): if present, set yolo_mode=true
2. LOAD the FULL {project-root}/_gaia/core/engine/workflow.xml
3. READ its entire contents — this is the CORE OS
4. Pass {project-root}/_gaia/lifecycle/workflows/4-implementation/validate-story/workflow.yaml as 'workflow-config'
5. If story_key was extracted: pass story_key={extracted_story_key} as a resolved variable
6. If yolo_mode=true: tell the engine "Run in YOLO mode — auto-proceed past all template-outputs."
7. Follow workflow.xml instructions EXACTLY
8. Save outputs after EACH section
</steps>

$ARGUMENTS
