#!/usr/bin/env node

// ─────────────────────────────────────────────────────────────────────────────
// Kratos Framework — npm CLI wrapper
// Clones the KRATOS repo, delegates to kratos-install.sh, and cleans up.
// ─────────────────────────────────────────────────────────────────────────────

const { execSync, execFileSync } = require("child_process");
const { mkdtempSync, rmSync, existsSync } = require("fs");
const { join } = require("path");
const { tmpdir } = require("os");

const pkg = require("../package.json");

const DEFAULT_REPO_URL = pkg.repository?.url || "https://github.com/stevenAghnatios76/Kratos-framework.git";
const SCRIPT_NAME = "kratos-install.sh";
const IS_WINDOWS = process.platform === "win32";

let tempDir = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

function findBash() {
  if (!IS_WINDOWS) return "bash";

  // Try bash in PATH first (WSL, Git Bash in PATH, etc.)
  try {
    execSync("bash --version", { stdio: "ignore" });
    return "bash";
  } catch {}

  // Try Git for Windows default locations
  const gitBashPaths = [
    join(process.env.ProgramFiles || "C:\\Program Files", "Git", "bin", "bash.exe"),
    join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Git", "bin", "bash.exe"),
    join(process.env.LOCALAPPDATA || "", "Programs", "Git", "bin", "bash.exe"),
  ];

  for (const p of gitBashPaths) {
    if (existsSync(p)) return p;
  }

  return null;
}

function fail(message) {
  console.error(`\x1b[31m✖\x1b[0m  ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`\x1b[34mℹ\x1b[0m  ${message}`);
}

function normalizeRepoUrl(repoUrl) {
  if (!repoUrl) return repoUrl;

  if (repoUrl.startsWith("git+")) {
    return repoUrl.slice(4);
  }

  return repoUrl;
}

function cleanup() {
  if (tempDir && existsSync(tempDir)) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}

function ensureGit() {
  try {
    execSync("git --version", { stdio: "ignore" });
  } catch {
    fail(
      "git is required but was not found.\n" +
        "   Install git: https://git-scm.com/downloads"
    );
  }
}

function showUsage() {
  console.log(`
\x1b[1mKratos Framework — npm installer\x1b[0m

Usage: npx kratos-framework <command> [options] [target]

Commands:
  init       Install KRATOS into a project
  update     Update framework files (preserves config and memory)
  validate   Check installation integrity
  status     Show installation info

Options:
  --yes             Skip confirmation prompts
  --minimal         Install the lightweight profile (core, quick flow, senior dev agents)
  --dry-run         Show what would be done without making changes
  --verbose         Show detailed progress
  --help            Show this help message

Environment:
  KRATOS_REPO_URL   Override the Git clone source for your fork or private mirror

Examples:
  npx kratos-framework init .
  npx kratos-framework init ~/my-new-project
  npx kratos-framework update .
  npx kratos-framework validate .
  npx kratos-framework status .
  npx kratos-framework init --yes ~/my-project
`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  // Handle help / no args
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showUsage();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(`kratos-framework v${pkg.version}`);
    process.exit(0);
  }

  // Validate command
  const command = args[0];
  const validCommands = ["init", "update", "validate", "status"];
  if (!validCommands.includes(command)) {
    fail(`Unknown command: ${command}\n   Run 'npx kratos-framework --help' for usage.`);
  }

  // Ensure git is available
  ensureGit();

  const repoUrl = normalizeRepoUrl(process.env.KRATOS_REPO_URL || DEFAULT_REPO_URL);

  // Clone the repo to a temp directory
  tempDir = mkdtempSync(join(tmpdir(), "kratos-framework-"));

  // Register cleanup for all exit scenarios
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(130); });
  process.on("SIGTERM", () => { cleanup(); process.exit(143); });

  info("Cloning KRATOS framework from GitHub...");

  try {
    execFileSync("git", ["clone", "--depth", "1", repoUrl, tempDir], {
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (err) {
    fail(
      `Failed to clone from ${repoUrl}\n` +
        `   ${err.stderr ? err.stderr.toString().trim() : "Check your network connection."}`
    );
  }

  // Locate the installer script
  const scriptPath = join(tempDir, SCRIPT_NAME);
  if (!existsSync(scriptPath)) {
    fail(`Installer script not found in cloned repo: ${SCRIPT_NAME}`);
  }

  // Build the shell command: inject --source pointing to the temp clone
  // so the shell script doesn't need to clone again
  const passthrough = args.slice(0);
  // Insert --source right after the command
  passthrough.splice(1, 0, "--source", tempDir);

  // Locate bash (critical for Windows support)
  const bashPath = findBash();
  if (!bashPath) {
    fail(
      "bash is required but was not found.\n" +
        "   On Windows, install Git for Windows (https://git-scm.com/downloads/win)\n" +
        "   which includes bash. Then re-run this command."
    );
  }

  info("Running installer...\n");

  try {
    execFileSync(bashPath, [scriptPath, ...passthrough], {
      stdio: "inherit",
      env: { ...process.env, KRATOS_SOURCE: tempDir },
    });
  } catch (err) {
    process.exit(err.status || 1);
  }
}

main();
