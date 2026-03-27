#!/usr/bin/env node
/**
 * Kratos Framework — Statusline Generator
 * Displays real-time framework and sprint status in Claude Code's status bar.
 *
 * Usage: node statusline.cjs [--json] [--single-line]
 *
 * Default output: multi-line dashboard (shown by Claude Code in the status bar)
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { execSync } = require('child_process');

const CWD          = process.cwd();
const KRATOS_ROOT  = findKratosRoot();
const MEMORY_DIR   = KRATOS_ROOT ? path.join(KRATOS_ROOT, '_kratos', '_memory')  : null;
const CONFIG_DIR   = KRATOS_ROOT ? path.join(KRATOS_ROOT, '_kratos', '_config')  : null;
const DOCS_DIR     = KRATOS_ROOT ? path.join(KRATOS_ROOT, 'docs')                : null;

// ─── ANSI palette ────────────────────────────────────────────────────────────
const c = {
  reset:        '\x1b[0m',
  bold:         '\x1b[1m',
  dim:          '\x1b[2m',
  red:          '\x1b[0;31m',
  green:        '\x1b[0;32m',
  yellow:       '\x1b[0;33m',
  blue:         '\x1b[0;34m',
  purple:       '\x1b[0;35m',
  cyan:         '\x1b[0;36m',
  brightRed:    '\x1b[1;31m',
  brightGreen:  '\x1b[1;32m',
  brightYellow: '\x1b[1;33m',
  brightBlue:   '\x1b[1;34m',
  brightPurple: '\x1b[1;35m',
  brightCyan:   '\x1b[1;36m',
  brightWhite:  '\x1b[1;37m',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeExec(cmd, timeoutMs = 2000) {
  try {
    return execSync(cmd, {
      encoding: 'utf-8', timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch { return ''; }
}

function readJSON(filePath) {
  try {
    if (fs.existsSync(filePath))
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch { /* ignore */ }
  return null;
}

function readYAML(filePath) {
  // Minimal YAML reader — extracts top-level key: value pairs
  try {
    if (!fs.existsSync(filePath)) return null;
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    const obj = {};
    for (const line of lines) {
      const m = line.match(/^(\w[\w_-]*):\s*["']?(.+?)["']?\s*$/);
      if (m) obj[m[1]] = m[2];
    }
    return obj;
  } catch { return null; }
}

function findKratosRoot() {
  let dir = CWD;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '_kratos'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

// ─── Data collectors ─────────────────────────────────────────────────────────

function getGitInfo() {
  const result = { name: os.userInfo().username || 'dev', branch: '', staged: 0, modified: 0, untracked: 0, ahead: 0, behind: 0 };
  const script = [
    'git config user.name 2>/dev/null || echo user',
    'echo "---SEP---"',
    'git branch --show-current 2>/dev/null',
    'echo "---SEP---"',
    'git status --porcelain 2>/dev/null',
    'echo "---SEP---"',
    'git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null || echo "0 0"',
  ].join('; ');
  const raw = safeExec(`sh -c '${script}'`, 3000);
  if (!raw) return result;
  const parts = raw.split('---SEP---').map(s => s.trim());
  if (parts.length >= 4) {
    result.name   = parts[0] || result.name;
    result.branch = parts[1] || '';
    for (const line of (parts[2] || '').split('\n')) {
      if (!line || line.length < 2) continue;
      const x = line[0], y = line[1];
      if (x === '?' && y === '?') { result.untracked++; continue; }
      if (x !== ' ' && x !== '?') result.staged++;
      if (y !== ' ' && y !== '?') result.modified++;
    }
    const ab = (parts[3] || '0 0').split(/\s+/);
    result.ahead  = parseInt(ab[0]) || 0;
    result.behind = parseInt(ab[1]) || 0;
  }
  return result;
}

function getModelName() {
  try {
    const claudeConfig = readJSON(path.join(os.homedir(), '.claude.json'));
    if (claudeConfig?.projects) {
      for (const [pPath, pConfig] of Object.entries(claudeConfig.projects)) {
        if (CWD === pPath || CWD.startsWith(pPath + '/')) {
          const usage = pConfig.lastModelUsage;
          if (usage) {
            let modelId = '', latest = 0;
            for (const [id, data] of Object.entries(usage)) {
              const ts = data?.lastUsedAt ? new Date(data.lastUsedAt).getTime() : 0;
              if (ts > latest) { latest = ts; modelId = id; }
            }
            if (modelId) {
              if (modelId.includes('opus'))   return 'Opus 4.6';
              if (modelId.includes('sonnet')) return 'Sonnet 4.6';
              if (modelId.includes('haiku'))  return 'Haiku 4.5';
            }
          }
          break;
        }
      }
    }
  } catch { /* ignore */ }
  // Fallback: providers.yaml default_model
  if (CONFIG_DIR) {
    const prov = readYAML(path.join(CONFIG_DIR, 'providers.yaml'));
    if (prov?.default_model) {
      const m = prov.default_model;
      if (m.includes('opus'))   return 'Opus 4.6';
      if (m.includes('sonnet')) return 'Sonnet 4.6';
      if (m.includes('haiku'))  return 'Haiku 4.5';
    }
  }
  return 'Claude Code';
}

function getSprintStatus() {
  const result = { inProgress: 0, done: 0, blocked: 0, review: 0, ready: 0, backlog: 0, total: 0, sprint: '' };
  if (!DOCS_DIR) return result;

  // Try sprint-status.yaml
  const statusFile = path.join(DOCS_DIR, 'implementation-artifacts', 'sprint-status.yaml');
  if (fs.existsSync(statusFile)) {
    try {
      const content = fs.readFileSync(statusFile, 'utf-8');
      const sprintMatch = content.match(/sprint[_-]?name:\s*["']?([^\n"']+)/i);
      if (sprintMatch) result.sprint = sprintMatch[1].trim();
      result.inProgress = (content.match(/status:\s*["']?in[_-]progress/gi) || []).length;
      result.done       = (content.match(/status:\s*["']?done/gi) || []).length;
      result.blocked    = (content.match(/status:\s*["']?blocked/gi) || []).length;
      result.review     = (content.match(/status:\s*["']?review/gi) || []).length;
      result.ready      = (content.match(/status:\s*["']?ready[_-]for[_-]dev/gi) || []).length;
      result.backlog    = (content.match(/status:\s*["']?backlog/gi) || []).length;
      result.total      = result.inProgress + result.done + result.blocked + result.review + result.ready + result.backlog;
    } catch { /* ignore */ }
  }
  return result;
}

function getMemoryStats() {
  const result = { entries: 0, checkpoints: 0, dbSizeKB: 0 };
  if (!MEMORY_DIR) return result;
  // DB size
  try {
    const dbPath = path.join(MEMORY_DIR, 'memory.db');
    if (fs.existsSync(dbPath))
      result.dbSizeKB = Math.round(fs.statSync(dbPath).size / 1024);
  } catch { /* ignore */ }
  // Checkpoint count
  try {
    const cpDir = path.join(MEMORY_DIR, 'checkpoints');
    if (fs.existsSync(cpDir))
      result.checkpoints = fs.readdirSync(cpDir).filter(f => f.endsWith('.json') || f.endsWith('.yaml')).length;
  } catch { /* ignore */ }
  return result;
}

function getAgentCount() {
  if (!KRATOS_ROOT) return 0;
  try {
    const csvPath = path.join(KRATOS_ROOT, '_kratos', '_config', 'agent-manifest.csv');
    if (fs.existsSync(csvPath)) {
      const lines = fs.readFileSync(csvPath, 'utf-8').trim().split('\n');
      return Math.max(0, lines.length - 1); // subtract header
    }
  } catch { /* ignore */ }
  return 0;
}

function getProvidersStatus() {
  const result = { active: [], total: 0 };
  if (!CONFIG_DIR) return result;
  try {
    const content = fs.readFileSync(path.join(CONFIG_DIR, 'providers.yaml'), 'utf-8');
    const enabledMatches = content.match(/enabled:\s*true/gi) || [];
    result.total   = (content.match(/^  (anthropic|openai|google|ollama):/gm) || []).length;
    result.active  = enabledMatches.length;
  } catch { /* ignore */ }
  return result;
}

function getMCPStatus() {
  try {
    const settings = readJSON(path.join(CWD, '.claude', 'settings.json'));
    const mcpServers = settings?.mcpServers || {};
    const total = Object.keys(mcpServers).length;
    return { total };
  } catch { return { total: 0 }; }
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function progressBar(current, total, width = 5) {
  if (total === 0) return `[${'\u25CB'.repeat(width)}]`;
  const filled = Math.min(width, Math.round((current / total) * width));
  return '[' + '\u25CF'.repeat(filled) + '\u25CB'.repeat(width - filled) + ']';
}

function sep() {
  return `${c.dim}\u2502${c.reset}`;
}

function generateStatusline() {
  const git     = getGitInfo();
  const model   = getModelName();
  const sprint  = getSprintStatus();
  const memory  = getMemoryStats();
  const agents  = getAgentCount();
  const mcp     = getMCPStatus();

  const parts = [];

  // Branding
  parts.push(`${c.bold}${c.brightPurple}\u258A Kratos v2.2${c.reset}`);

  // User
  parts.push(`${c.brightCyan}\u25CF ${git.name}${c.reset}`);

  // Git branch
  if (git.branch) {
    let branch = `${c.brightBlue}\u23C7 ${git.branch}${c.reset}`;
    if (git.staged)   branch += ` ${c.brightGreen}+${git.staged}${c.reset}`;
    if (git.modified) branch += ` ${c.brightYellow}~${git.modified}${c.reset}`;
    if (git.untracked)branch += ` ${c.dim}?${git.untracked}${c.reset}`;
    if (git.ahead)    branch += ` ${c.brightGreen}\u2191${git.ahead}${c.reset}`;
    if (git.behind)   branch += ` ${c.brightRed}\u2193${git.behind}${c.reset}`;
    parts.push(branch);
  }

  // Model
  parts.push(`${c.purple}${model}${c.reset}`);

  // Sprint compact
  if (sprint.total > 0) {
    const bar = progressBar(sprint.done, sprint.total);
    parts.push(`${c.cyan}Sprint${c.reset} ${bar} ${c.brightGreen}${sprint.done}${c.reset}/${sprint.total}`);
  }

  // Memory
  if (memory.dbSizeKB > 0) {
    const sizeDisp = memory.dbSizeKB >= 1024
      ? `${(memory.dbSizeKB / 1024).toFixed(1)}MB`
      : `${memory.dbSizeKB}KB`;
    parts.push(`${c.brightCyan}\uD83D\uDDC4 ${sizeDisp}${c.reset}`);
  }

  // Agents + MCP
  if (agents > 0) parts.push(`${c.brightYellow}\uD83E\uDD16 ${agents}${c.reset}`);
  if (mcp.total > 0) parts.push(`${c.brightGreen}MCP \u25CF${mcp.total}${c.reset}`);

  return parts.join(`  ${sep()}  `);
}

function generateDashboard() {
  const git     = getGitInfo();
  const model   = getModelName();
  const sprint  = getSprintStatus();
  const memory  = getMemoryStats();
  const agents  = getAgentCount();
  const prov    = getProvidersStatus();
  const mcp     = getMCPStatus();
  const lines   = [];

  // ── Header ──
  let header = `${c.bold}${c.brightPurple}\u258A Kratos v2.2.0${c.reset}`;
  header += `  ${c.brightCyan}\u25CF ${git.name}${c.reset}`;
  if (git.branch) {
    header += `  ${sep()}  ${c.brightBlue}\u23C7 ${git.branch}${c.reset}`;
    if (git.staged)    header += ` ${c.brightGreen}+${git.staged}${c.reset}`;
    if (git.modified)  header += ` ${c.brightYellow}~${git.modified}${c.reset}`;
    if (git.untracked) header += ` ${c.dim}?${git.untracked}${c.reset}`;
    if (git.ahead)     header += ` ${c.brightGreen}\u2191${git.ahead}${c.reset}`;
    if (git.behind)    header += ` ${c.brightRed}\u2193${git.behind}${c.reset}`;
  }
  header += `  ${sep()}  ${c.purple}${model}${c.reset}`;
  lines.push(header);

  // ── Line 1: Sprint ──
  if (sprint.total > 0) {
    const doneColor     = sprint.done   === sprint.total ? c.brightGreen : c.yellow;
    const blockedColor  = sprint.blocked > 0 ? c.brightRed : c.dim;
    const reviewColor   = sprint.review > 0  ? c.brightYellow : c.dim;
    const activeColor   = sprint.inProgress > 0 ? c.brightCyan : c.dim;
    const sprintLabel   = sprint.sprint ? `${c.dim}[${sprint.sprint}]${c.reset}  ` : '';
    lines.push(
      `${c.brightBlue}\uD83D\uDCCB Sprint${c.reset}  ${sprintLabel}` +
      `${progressBar(sprint.done, sprint.total)}  ` +
      `${activeColor}\u25CF ${sprint.inProgress} active${c.reset}    ` +
      `${reviewColor}\u25CE ${sprint.review} review${c.reset}    ` +
      `${doneColor}\u2713 ${sprint.done}/${sprint.total} done${c.reset}    ` +
      (sprint.blocked > 0 ? `${blockedColor}\u26A0 ${sprint.blocked} blocked${c.reset}` : '')
    );
  } else {
    lines.push(`${c.brightBlue}\uD83D\uDCCB Sprint${c.reset}  ${c.dim}No sprint-status.yaml found${c.reset}`);
  }

  // ── Line 2: Agents + Memory ──
  const cpColor   = memory.checkpoints > 0 ? c.brightGreen : c.dim;
  const dbDisplay = memory.dbSizeKB >= 1024
    ? `${(memory.dbSizeKB / 1024).toFixed(1)}MB`
    : `${memory.dbSizeKB}KB`;
  const agentColor = agents > 0 ? c.brightYellow : c.dim;
  lines.push(
    `${c.brightYellow}\uD83E\uDD16 Agents${c.reset}  ${agentColor}\u25CF ${agents}${c.reset}  ${sep()}  ` +
    `${c.brightCyan}\uD83D\uDDC4 Memory${c.reset}  ${c.brightWhite}${dbDisplay}${c.reset}  ${sep()}  ` +
    `${cpColor}\uD83D\uDCCC ${memory.checkpoints} checkpoints${c.reset}`
  );

  // ── Line 3: Providers + MCP ──
  const provColor = prov.active > 0 ? c.brightGreen : c.brightYellow;
  const mcpColor  = mcp.total > 0   ? c.brightGreen : c.dim;
  const anthKey   = process.env.ANTHROPIC_API_KEY ? `${c.brightGreen}\u25CF API key set${c.reset}` : `${c.brightYellow}\u25CF subscription mode${c.reset}`;
  lines.push(
    `${c.brightPurple}\uD83D\uDD17 Providers${c.reset}  ${provColor}\u25CF ${prov.active}/${prov.total} enabled${c.reset}    ` +
    anthKey + `    ` +
    `${c.cyan}MCP${c.reset} ${mcpColor}\u25CF${mcp.total}${c.reset}`
  );

  return lines.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────
if (process.argv.includes('--json')) {
  const git = getGitInfo();
  console.log(JSON.stringify({
    git, model: getModelName(), sprint: getSprintStatus(),
    memory: getMemoryStats(), agents: getAgentCount(),
    providers: getProvidersStatus(), mcp: getMCPStatus(),
    kratosRoot: KRATOS_ROOT,
  }, null, 2));
} else if (process.argv.includes('--single-line')) {
  console.log(generateStatusline());
} else {
  console.log(generateDashboard());
}
