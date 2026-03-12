#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# GAIA Framework Installer
# Installs, updates, validates, and reports on GAIA installations.
# ─────────────────────────────────────────────────────────────────────────────

readonly VERSION="1.27.10"
readonly GITHUB_REPO="https://github.com/jlouage/Gaia-framework.git"
readonly MANIFEST_REL="_gaia/_config/manifest.yaml"

# Temp dir tracking for cleanup
TEMP_CLONE_DIR=""

# ─── Colors & Formatting ────────────────────────────────────────────────────

if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'
  BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'
  RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; BOLD=''; DIM=''; RESET=''
fi

info()    { printf "${BLUE}ℹ${RESET}  %s\n" "$*"; }
success() { printf "${GREEN}✔${RESET}  %s\n" "$*"; }
warn()    { printf "${YELLOW}⚠${RESET}  %s\n" "$*"; }
error()   { printf "${RED}✖${RESET}  %s\n" "$*" >&2; }
step()    { printf "${CYAN}→${RESET}  %s\n" "$*"; }
detail()  { printf "${DIM}   %s${RESET}\n" "$*"; }

# ─── Globals (set by argument parsing) ──────────────────────────────────────

CMD=""
SOURCE_FLAG=""
TARGET=""
OPT_YES=false
OPT_DRY_RUN=false
OPT_VERBOSE=false

# ─── Utility Functions ──────────────────────────────────────────────────────

cleanup() {
  if [[ -n "$TEMP_CLONE_DIR" && -d "$TEMP_CLONE_DIR" ]]; then
    rm -rf "$TEMP_CLONE_DIR"
    [[ "$OPT_VERBOSE" == true ]] && detail "Cleaned up temp dir: $TEMP_CLONE_DIR" || true
  fi
}
trap cleanup EXIT

clone_from_github() {
  if ! command -v git &>/dev/null; then
    error "git is required to clone from GitHub but was not found."
    error "Install git or provide a local source with --source."
    exit 1
  fi
  TEMP_CLONE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/gaia-framework-XXXXXX")"
  info "Cloning GAIA from GitHub..." >&2
  if git clone --depth 1 "$GITHUB_REPO" "$TEMP_CLONE_DIR" 2>/dev/null; then
    success "Cloned to temporary directory" >&2
  else
    error "Failed to clone from $GITHUB_REPO"
    exit 1
  fi
  echo "$TEMP_CLONE_DIR"
}

resolve_source() {
  local resolved=""

  # 1. --source flag
  if [[ -n "$SOURCE_FLAG" ]]; then
    resolved="$SOURCE_FLAG"
    [[ "$OPT_VERBOSE" == true ]] && detail "Source from --source flag: $resolved" >&2
  # 2. $GAIA_SOURCE env var
  elif [[ -n "${GAIA_SOURCE:-}" ]]; then
    resolved="$GAIA_SOURCE"
    [[ "$OPT_VERBOSE" == true ]] && detail "Source from \$GAIA_SOURCE: $resolved" >&2
  # 3. Self-detect: script's own directory
  elif [[ -d "$(dirname "$(realpath "$0")")/_gaia" ]]; then
    resolved="$(dirname "$(realpath "$0")")"
    [[ "$OPT_VERBOSE" == true ]] && detail "Source from script location: $resolved" >&2
  # 4. GitHub clone
  else
    resolved="$(clone_from_github)"
  fi

  echo "$resolved"
}

validate_source() {
  local src="$1"
  if [[ ! -f "$src/$MANIFEST_REL" ]]; then
    error "Invalid GAIA source: $src"
    error "Expected $MANIFEST_REL but it was not found."
    exit 1
  fi
}

copy_if_missing() {
  local src="$1" dst="$2"
  if [[ -e "$dst" ]]; then
    [[ "$OPT_VERBOSE" == true ]] && detail "Skipped (exists): $dst"
    return 0
  fi
  if [[ "$OPT_DRY_RUN" == true ]]; then
    detail "[dry-run] Would copy: $dst"
    return 0
  fi
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  [[ "$OPT_VERBOSE" == true ]] && detail "Copied: $dst" || true
}

copy_with_backup() {
  local src="$1" dst="$2" backup_dir="$3"
  if [[ ! -e "$dst" ]]; then
    if [[ "$OPT_DRY_RUN" == true ]]; then
      detail "[dry-run] Would copy: $dst"
      return 0
    fi
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    [[ "$OPT_VERBOSE" == true ]] && detail "Copied (new): $dst" || true
    return 0
  fi
  # Compare files — skip if identical
  if cmp -s "$src" "$dst"; then
    [[ "$OPT_VERBOSE" == true ]] && detail "Unchanged: $dst" || true
    return 0
  fi
  if [[ "$OPT_DRY_RUN" == true ]]; then
    detail "[dry-run] Would update (with backup): $dst"
    return 0
  fi
  # Back up the existing file
  local rel_path="${dst#$TARGET/}"
  local backup_path="$backup_dir/$rel_path"
  mkdir -p "$(dirname "$backup_path")"
  cp "$dst" "$backup_path"
  cp "$src" "$dst"
  [[ "$OPT_VERBOSE" == true ]] && detail "Updated (backed up): $dst" || true
}

append_if_missing() {
  local file="$1" marker="$2" content="$3"
  if [[ -f "$file" ]] && grep -qF "$marker" "$file"; then
    [[ "$OPT_VERBOSE" == true ]] && detail "Already in $(basename "$file"): $marker"
    return 0
  fi
  if [[ "$OPT_DRY_RUN" == true ]]; then
    detail "[dry-run] Would append to $(basename "$file"): $marker"
    return 0
  fi
  # Add a newline before appending if file exists and doesn't end with newline
  if [[ -f "$file" ]] && [[ -s "$file" ]] && [[ "$(tail -c 1 "$file")" != "" ]]; then
    printf '\n' >> "$file"
  fi
  printf '%s\n' "$content" >> "$file"
}

prompt_value() {
  local prompt_text="$1" default="$2"
  if [[ "$OPT_YES" == true ]]; then
    echo "$default"
    return 0
  fi
  local value
  printf "${BOLD}%s${RESET} [%s]: " "$prompt_text" "$default" >&2
  read -r value
  echo "${value:-$default}"
}

extract_yaml_value() {
  local file="$1" key="$2"
  grep "^${key}:" "$file" 2>/dev/null | sed "s/^${key}:[[:space:]]*//" | sed 's/^"//;s/"$//' || echo ""
}

count_files() {
  local dir="$1" pattern="${2:-*}"
  find "$dir" -name "$pattern" -type f 2>/dev/null | wc -l | tr -d ' '
}

# ─── cmd_init ───────────────────────────────────────────────────────────────

cmd_init() {
  local source
  source="$(resolve_source)"
  validate_source "$source"

  local src_version
  src_version="$(extract_yaml_value "$source/_gaia/_config/global.yaml" "framework_version")"

  printf "\n${BOLD}GAIA Framework Installer v%s${RESET}\n" "$VERSION"
  printf "  Source:  %s\n" "$source"
  printf "  Target:  %s\n" "$TARGET"
  printf "  Version: %s\n\n" "${src_version:-unknown}"

  if [[ "$OPT_DRY_RUN" == true ]]; then
    warn "Dry-run mode — no files will be written"
    echo ""
  fi

  if [[ -d "$TARGET/_gaia" ]]; then
    warn "Target already contains _gaia/ — use 'update' to refresh framework files."
    if [[ "$OPT_YES" != true ]]; then
      printf "Continue with init anyway? [y/N]: "
      local confirm; read -r confirm
      [[ "$confirm" =~ ^[Yy] ]] || { info "Aborted."; exit 0; }
    fi
  fi

  # Step 1: Create target docs directories
  step "Creating documentation directories..."
  for dir in planning-artifacts implementation-artifacts test-artifacts creative-artifacts; do
    if [[ "$OPT_DRY_RUN" == true ]]; then
      detail "[dry-run] Would create: docs/$dir/"
    else
      mkdir -p "$TARGET/docs/$dir"
    fi
  done

  # Step 2: Copy _gaia/ recursively (excluding checkpoints and .resolved/*.yaml)
  step "Copying framework files..."
  if [[ "$OPT_DRY_RUN" == true ]]; then
    detail "[dry-run] Would copy _gaia/ (excluding checkpoints and .resolved/*.yaml)"
  else
    mkdir -p "$TARGET/_gaia"
    rsync -a \
      --exclude='_memory/checkpoints/*.yaml' \
      --exclude='_memory/checkpoints/completed/*.yaml' \
      --exclude='.resolved/*.yaml' \
      --exclude='_memory/*-sidecar/*.md' \
      --exclude='_memory/*-sidecar/*.yaml' \
      "$source/_gaia/" "$TARGET/_gaia/"
  fi

  # Step 3: Create memory sidecar directories with .gitkeep
  step "Creating memory sidecar directories..."
  local sidecar_dirs=(
    "checkpoints"
    "checkpoints/completed"
    "architect-sidecar"
    "devops-sidecar"
    "orchestrator-sidecar"
    "pm-sidecar"
    "security-sidecar"
    "sm-sidecar"
    "storyteller-sidecar"
    "tech-writer-sidecar"
    "test-architect-sidecar"
  )
  for dir in "${sidecar_dirs[@]}"; do
    if [[ "$OPT_DRY_RUN" == true ]]; then
      detail "[dry-run] Would create: _gaia/_memory/$dir/"
    else
      mkdir -p "$TARGET/_gaia/_memory/$dir"
      touch "$TARGET/_gaia/_memory/$dir/.gitkeep"
    fi
  done

  # Step 4: Create .resolved directories with .gitkeep
  step "Creating .resolved directories..."
  local resolved_dirs=("core" "lifecycle" "creative" "testing")
  for mod in "${resolved_dirs[@]}"; do
    if [[ "$OPT_DRY_RUN" == true ]]; then
      detail "[dry-run] Would create: _gaia/$mod/.resolved/"
    else
      mkdir -p "$TARGET/_gaia/$mod/.resolved"
      touch "$TARGET/_gaia/$mod/.resolved/.gitkeep"
    fi
  done

  # Step 5: Customize global.yaml
  step "Configuring global.yaml..."
  local project_name user_name
  local dir_name
  dir_name="$(basename "$TARGET")"
  project_name="$(prompt_value "Project name" "$dir_name")"
  user_name="$(prompt_value "User name" "$(whoami)")"

  if [[ "$OPT_DRY_RUN" == true ]]; then
    detail "[dry-run] Would set project_name=$project_name, user_name=$user_name"
  else
    local global_file="$TARGET/_gaia/_config/global.yaml"
    if [[ -f "$global_file" ]]; then
      # Use portable sed for both macOS and Linux
      if [[ "$(uname)" == "Darwin" ]]; then
        sed -i '' "s/^project_name:.*/project_name: \"$project_name\"/" "$global_file"
        sed -i '' "s/^user_name:.*/user_name: \"$user_name\"/" "$global_file"
      else
        sed -i "s/^project_name:.*/project_name: \"$project_name\"/" "$global_file"
        sed -i "s/^user_name:.*/user_name: \"$user_name\"/" "$global_file"
      fi
    fi
  fi

  # Step 6: Copy CLAUDE.md (skip if exists)
  step "Setting up CLAUDE.md..."
  if [[ -f "$source/CLAUDE.md" ]]; then
    copy_if_missing "$source/CLAUDE.md" "$TARGET/CLAUDE.md"
  fi

  # Step 7: Copy slash commands to .claude/commands/
  step "Installing slash commands..."
  if [[ -d "$source/.claude/commands" ]]; then
    if [[ "$OPT_DRY_RUN" == true ]]; then
      local cmd_count
      cmd_count="$(find "$source/.claude/commands" -name 'gaia*.md' -type f | wc -l | tr -d ' ')"
      detail "[dry-run] Would copy $cmd_count slash commands to .claude/commands/"
    else
      mkdir -p "$TARGET/.claude/commands"
      for cmd_file in "$source/.claude/commands"/gaia*.md; do
        [[ -f "$cmd_file" ]] || continue
        local basename_cmd
        basename_cmd="$(basename "$cmd_file")"
        copy_if_missing "$cmd_file" "$TARGET/.claude/commands/$basename_cmd"
      done
    fi
  fi

  # Step 8: Append GAIA entries to .gitignore
  step "Updating .gitignore..."
  local gitignore_block
  gitignore_block="$(cat <<'GITIGNORE'

# GAIA Framework — runtime artifacts
_gaia/_memory/checkpoints/*.yaml
_gaia/_memory/*-sidecar/*.md
_gaia/_memory/*-sidecar/*.yaml
_gaia/**/.resolved/*.yaml
!_gaia/**/.resolved/.gitkeep
GITIGNORE
)"
  append_if_missing "$TARGET/.gitignore" "# GAIA Framework — runtime artifacts" "$gitignore_block"

  # Summary
  echo ""
  success "GAIA Framework installed successfully!"
  echo ""
  printf "  ${BOLD}Project:${RESET}  %s\n" "$project_name"
  printf "  ${BOLD}User:${RESET}     %s\n" "$user_name"
  printf "  ${BOLD}Version:${RESET}  %s\n" "${src_version:-1.0.0}"
  printf "  ${BOLD}Target:${RESET}   %s\n" "$TARGET"
  echo ""
  info "Next steps:"
  detail "1. cd $TARGET"
  detail "2. Run /gaia-build-configs in the Claude Code terminal to generate resolved configs"
  detail "3. Run /gaia in the Claude Code terminal to start the orchestrator"
  echo ""
}

# ─── cmd_update ─────────────────────────────────────────────────────────────

cmd_update() {
  local source
  source="$(resolve_source)"
  validate_source "$source"

  if [[ ! -d "$TARGET/_gaia" ]]; then
    error "No GAIA installation found at $TARGET"
    error "Run 'init' first to install GAIA."
    exit 1
  fi

  local src_version
  src_version="$(extract_yaml_value "$source/_gaia/_config/global.yaml" "framework_version")"
  local cur_version
  cur_version="$(extract_yaml_value "$TARGET/_gaia/_config/global.yaml" "framework_version")"

  printf "\n${BOLD}GAIA Framework Updater v%s${RESET}\n" "$VERSION"
  printf "  Source:  %s (v%s)\n" "$source" "${src_version:-unknown}"
  printf "  Target:  %s (v%s)\n\n" "$TARGET" "${cur_version:-unknown}"

  if [[ "$OPT_DRY_RUN" == true ]]; then
    warn "Dry-run mode — no files will be written"
    echo ""
  fi

  if [[ "$OPT_YES" != true ]]; then
    printf "Proceed with update? [y/N]: "
    local confirm; read -r confirm
    [[ "$confirm" =~ ^[Yy] ]] || { info "Aborted."; exit 0; }
  fi

  local timestamp
  timestamp="$(date +%Y%m%d-%H%M%S)"
  local backup_dir="$TARGET/_gaia/_backups/$timestamp"

  # Update framework structure — these directories get fully refreshed
  # NEVER touch: global.yaml, _memory/, .resolved/, CLAUDE.md
  local update_targets=(
    "core/engine"
    "core/agents"
    "core/tasks"
    "core/workflows"
    "lifecycle/agents"
    "lifecycle/workflows"
    "lifecycle/templates"
    "lifecycle/checklists"
    "lifecycle/teams"
    "dev/agents"
    "dev/skills"
    "dev/knowledge"
    "creative/agents"
    "creative/workflows"
    "creative/teams"
    "creative/data"
    "testing/agents"
    "testing/workflows"
    "testing/knowledge"
    "_config/manifest.yaml"
  )

  step "Updating framework files..."
  local updated=0 skipped=0 changed=0

  for entry in "${update_targets[@]}"; do
    local src_path="$source/_gaia/$entry"
    local dst_path="$TARGET/_gaia/$entry"

    if [[ ! -e "$src_path" ]]; then
      [[ "$OPT_VERBOSE" == true ]] && detail "Source missing, skipped: $entry"
      continue
    fi

    # Show progress for each update target
    local entry_label="${entry}"
    [[ "$OPT_VERBOSE" != true ]] && detail "Processing: $entry_label"

    if [[ -f "$src_path" ]]; then
      # Single file
      copy_with_backup "$src_path" "$dst_path" "$backup_dir"
      updated=$((updated + 1))
    elif [[ -d "$src_path" ]]; then
      # Directory — update each file
      while IFS= read -r -d '' file; do
        local rel="${file#$src_path/}"
        copy_with_backup "$file" "$dst_path/$rel" "$backup_dir"
        updated=$((updated + 1))
      done < <(find "$src_path" -type f -print0) || true
    fi
  done

  detail "Processed $updated file(s) across ${#update_targets[@]} targets"

  # Update slash commands (add new ones, update existing with backup)
  step "Updating slash commands..."
  if [[ -d "$source/.claude/commands" ]]; then
    mkdir -p "$TARGET/.claude/commands"
    for cmd_file in "$source/.claude/commands"/gaia*.md; do
      [[ -f "$cmd_file" ]] || continue
      local basename_cmd
      basename_cmd="$(basename "$cmd_file")"
      copy_with_backup "$cmd_file" "$TARGET/.claude/commands/$basename_cmd" "$backup_dir"
    done
  fi

  # Update version in global.yaml and CLAUDE.md
  if [[ -n "$src_version" && "$src_version" != "$cur_version" ]]; then
    step "Updating framework version: $cur_version → $src_version"
    if [[ "$OPT_DRY_RUN" != true ]]; then
      local global_file="$TARGET/_gaia/_config/global.yaml"
      if [[ "$(uname)" == "Darwin" ]]; then
        sed -i '' "s/^framework_version:.*/framework_version: \"$src_version\"/" "$global_file"
      else
        sed -i "s/^framework_version:.*/framework_version: \"$src_version\"/" "$global_file"
      fi
      # Update version in CLAUDE.md heading
      local claude_file="$TARGET/CLAUDE.md"
      if [[ -f "$claude_file" ]]; then
        if [[ "$(uname)" == "Darwin" ]]; then
          sed -i '' "s/^# GAIA Framework v.*/# GAIA Framework v$src_version/" "$claude_file"
        else
          sed -i "s/^# GAIA Framework v.*/# GAIA Framework v$src_version/" "$claude_file"
        fi
        [[ "$OPT_VERBOSE" == true ]] && detail "Updated CLAUDE.md version heading" || true
      fi
    fi
  fi

  # Summary
  echo ""
  if [[ -d "$backup_dir" ]]; then
    local backup_count
    backup_count="$(find "$backup_dir" -type f | wc -l | tr -d ' ')"
    success "Update complete! $backup_count file(s) backed up to:"
    detail "$backup_dir"
  else
    success "Update complete! All files were already up to date."
  fi
  echo ""
  info "Run /gaia-build-configs in the Claude Code terminal to regenerate resolved configs."
  echo ""
}

# ─── cmd_validate ───────────────────────────────────────────────────────────

cmd_validate() {
  if [[ ! -d "$TARGET/_gaia" ]]; then
    error "No GAIA installation found at $TARGET"
    exit 1
  fi

  printf "\n${BOLD}GAIA Framework Validation${RESET}\n"
  printf "  Target: %s\n\n" "$TARGET"

  local pass=0 fail=0

  check() {
    local label="$1" condition="$2"
    if eval "$condition"; then
      printf "  ${GREEN}✔${RESET}  %s\n" "$label"
      pass=$((pass + 1))
    else
      printf "  ${RED}✖${RESET}  %s\n" "$label"
      fail=$((fail + 1))
    fi
  }

  # Manifest
  check "manifest.yaml exists" "[[ -f '$TARGET/$MANIFEST_REL' ]]"

  # Global config fields
  local global="$TARGET/_gaia/_config/global.yaml"
  check "global.yaml exists" "[[ -f '$global' ]]"
  if [[ -f "$global" ]]; then
    check "global.yaml has project_name" "grep -q '^project_name:' '$global'"
    check "global.yaml has user_name" "grep -q '^user_name:' '$global'"
    check "global.yaml has framework_version" "grep -q '^framework_version:' '$global'"
  fi

  # Module directories
  for mod in core lifecycle dev creative testing; do
    check "Module: $mod" "[[ -d '$TARGET/_gaia/$mod' ]]"
  done

  # .resolved directories
  for mod in core lifecycle creative testing; do
    check ".resolved: $mod" "[[ -d '$TARGET/_gaia/$mod/.resolved' ]]"
  done

  # Sidecar directories
  local sidecar_dirs=(
    "checkpoints" "checkpoints/completed"
    "architect-sidecar" "devops-sidecar" "orchestrator-sidecar"
    "pm-sidecar" "security-sidecar" "sm-sidecar"
    "storyteller-sidecar" "tech-writer-sidecar" "test-architect-sidecar"
  )
  for dir in "${sidecar_dirs[@]}"; do
    check "Sidecar: $dir" "[[ -d '$TARGET/_gaia/_memory/$dir' ]]"
  done

  # CLAUDE.md
  check "CLAUDE.md exists" "[[ -f '$TARGET/CLAUDE.md' ]]"

  # Slash commands
  check "Slash commands directory" "[[ -d '$TARGET/.claude/commands' ]]"
  if [[ -d "$TARGET/.claude/commands" ]]; then
    local cmd_count
    cmd_count="$(find "$TARGET/.claude/commands" -name 'gaia*.md' -type f 2>/dev/null | wc -l | tr -d ' ')"
    check "Slash commands present (found: $cmd_count)" "[[ $cmd_count -gt 0 ]]"
  fi

  # Docs directories
  for dir in planning-artifacts implementation-artifacts test-artifacts creative-artifacts; do
    check "Docs: $dir" "[[ -d '$TARGET/docs/$dir' ]]"
  done

  # Version
  local version
  version="$(extract_yaml_value "$TARGET/_gaia/_config/global.yaml" "framework_version")"

  echo ""
  if [[ $fail -eq 0 ]]; then
    success "All $pass checks passed (v${version:-unknown})"
    echo ""
    return 0
  else
    error "$fail of $((pass + fail)) checks failed"
    echo ""
    exit 1
  fi
}

# ─── cmd_status ─────────────────────────────────────────────────────────────

cmd_status() {
  if [[ ! -d "$TARGET/_gaia" ]]; then
    error "No GAIA installation found at $TARGET"
    exit 1
  fi

  local global="$TARGET/_gaia/_config/global.yaml"
  local version project_name user_name
  version="$(extract_yaml_value "$global" "framework_version")"
  project_name="$(extract_yaml_value "$global" "project_name")"
  user_name="$(extract_yaml_value "$global" "user_name")"

  printf "\n${BOLD}GAIA Framework Status${RESET}\n\n"
  printf "  ${BOLD}Version:${RESET}      %s\n" "${version:-unknown}"
  printf "  ${BOLD}Project:${RESET}      %s\n" "${project_name:-unknown}"
  printf "  ${BOLD}User:${RESET}         %s\n" "${user_name:-unknown}"

  # Modules
  local modules=()
  for mod in core lifecycle dev creative testing; do
    [[ -d "$TARGET/_gaia/$mod" ]] && modules+=("$mod")
  done
  printf "  ${BOLD}Modules:${RESET}      %s (%s)\n" "${#modules[@]}" "${modules[*]}"

  # Slash commands
  local cmd_count=0
  if [[ -d "$TARGET/.claude/commands" ]]; then
    cmd_count="$(find "$TARGET/.claude/commands" -name 'gaia*.md' -type f 2>/dev/null | wc -l | tr -d ' ')"
  fi
  printf "  ${BOLD}Commands:${RESET}     %s slash commands\n" "$cmd_count"

  # Sidecar status
  local sidecar_count=0
  local sidecar_populated=0
  for dir in "$TARGET/_gaia/_memory"/*-sidecar; do
    [[ -d "$dir" ]] || continue
    ((sidecar_count++))
    local file_count
    file_count="$(find "$dir" -type f ! -name '.gitkeep' 2>/dev/null | wc -l | tr -d ' ')"
    [[ $file_count -gt 0 ]] && ((sidecar_populated++))
  done
  printf "  ${BOLD}Sidecars:${RESET}     %s directories (%s with data)\n" "$sidecar_count" "$sidecar_populated"

  # .resolved population
  local resolved_count=0
  local resolved_populated=0
  for mod in core lifecycle creative testing; do
    local rdir="$TARGET/_gaia/$mod/.resolved"
    [[ -d "$rdir" ]] || continue
    ((resolved_count++))
    local yaml_count
    yaml_count="$(find "$rdir" -name '*.yaml' -type f 2>/dev/null | wc -l | tr -d ' ')"
    [[ $yaml_count -gt 0 ]] && ((resolved_populated++))
  done
  printf "  ${BOLD}.resolved:${RESET}    %s directories (%s populated)\n" "$resolved_count" "$resolved_populated"

  # Checkpoints
  local checkpoint_count=0
  if [[ -d "$TARGET/_gaia/_memory/checkpoints" ]]; then
    checkpoint_count="$(find "$TARGET/_gaia/_memory/checkpoints" -name '*.yaml' -type f 2>/dev/null | wc -l | tr -d ' ')"
  fi
  printf "  ${BOLD}Checkpoints:${RESET}  %s\n" "$checkpoint_count"

  echo ""
}

# ─── Usage & Argument Parsing ───────────────────────────────────────────────

usage() {
  cat <<EOF
${BOLD}GAIA Framework Installer v${VERSION}${RESET}

Usage: gaia-install.sh <command> [options] [target]

${BOLD}Commands:${RESET}
  init       Install GAIA into a project
  update     Update framework files (preserves config and memory)
  validate   Check installation integrity
  status     Show installation info

${BOLD}Options:${RESET}
  --source <path>   Local GAIA source (or clones from GitHub if omitted)
  --yes             Skip confirmation prompts
  --dry-run         Show what would be done without making changes
  --verbose         Show detailed progress
  --help            Show this help message

${BOLD}Examples:${RESET}
  gaia-install.sh init ~/my-new-project
  gaia-install.sh init --source ~/local-gaia ~/my-project
  gaia-install.sh update ~/my-existing-project
  gaia-install.sh validate .
  gaia-install.sh status .

${BOLD}Source resolution order:${RESET}
  1. --source flag
  2. \$GAIA_SOURCE environment variable
  3. Script's own directory (if it contains _gaia/)
  4. GitHub clone ($GITHUB_REPO)
EOF
}

parse_args() {
  if [[ $# -eq 0 ]]; then
    usage
    exit 0
  fi

  # First argument is the command
  case "$1" in
    init|update|validate|status)
      CMD="$1"
      shift
      ;;
    --help|-h|help)
      usage
      exit 0
      ;;
    --version|-v)
      echo "gaia-install.sh v${VERSION}"
      exit 0
      ;;
    *)
      error "Unknown command: $1"
      echo ""
      usage
      exit 1
      ;;
  esac

  # Parse remaining options
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --source)
        if [[ -z "${2:-}" ]]; then
          error "--source requires a path argument"
          exit 1
        fi
        SOURCE_FLAG="$2"
        shift 2
        ;;
      --yes|-y)
        OPT_YES=true
        shift
        ;;
      --dry-run)
        OPT_DRY_RUN=true
        shift
        ;;
      --verbose)
        OPT_VERBOSE=true
        shift
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      -*)
        error "Unknown option: $1"
        exit 1
        ;;
      *)
        if [[ -n "$TARGET" ]]; then
          error "Unexpected argument: $1"
          exit 1
        fi
        TARGET="$1"
        shift
        ;;
    esac
  done

  # Default target to current directory
  if [[ -z "$TARGET" ]]; then
    TARGET="."
  fi

  # Resolve target to absolute path
  if [[ "$TARGET" == "." ]]; then
    TARGET="$(pwd)"
  else
    # Create target dir for init if it doesn't exist
    if [[ "$CMD" == "init" && ! -d "$TARGET" ]]; then
      if [[ "$OPT_DRY_RUN" == true ]]; then
        detail "[dry-run] Would create target directory: $TARGET"
        # Resolve to absolute path without cd
        case "$TARGET" in
          /*) ;; # already absolute
          *)  TARGET="$(pwd)/$TARGET" ;;
        esac
      else
        mkdir -p "$TARGET"
        TARGET="$(cd "$TARGET" && pwd)"
      fi
    else
      TARGET="$(cd "$TARGET" 2>/dev/null && pwd || echo "$TARGET")"
    fi
  fi
}

# ─── Main ───────────────────────────────────────────────────────────────────

main() {
  parse_args "$@"

  case "$CMD" in
    init)     cmd_init     ;;
    update)   cmd_update   ;;
    validate) cmd_validate ;;
    status)   cmd_status   ;;
  esac
}

main "$@"
