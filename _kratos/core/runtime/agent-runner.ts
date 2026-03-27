// agent-runner.ts — Interactive Claude session runner for Kratos agents
// Parses agent .md files, builds system prompts, and runs a streaming REPL.
// Supports two modes:
//   api       — ANTHROPIC_API_KEY present → @anthropic-ai/sdk (direct API)
//   claude-cli — no key but `claude` CLI available → subscription / Claude Code

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import * as crypto from 'crypto';
import { spawn, execSync } from 'child_process';
import * as ui from './ui.js';

// ─── Session context (git, memory, sprint) ───────────────────────────────────

function safeExecStr(cmd: string): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout: 2000, stdio: ['pipe','pipe','pipe'] }).trim(); }
  catch { return ''; }
}

interface SessionContext {
  gitUser: string;
  gitBranch: string;
  gitChanges: string;
  memoryKB: number;
  checkpoints: number;
  sprintDone: number;
  sprintTotal: number;
}

function gatherSessionContext(projectRoot: string): SessionContext {
  const ctx: SessionContext = { gitUser: '', gitBranch: '', gitChanges: '', memoryKB: 0, checkpoints: 0, sprintDone: 0, sprintTotal: 0 };

  // Git — single shell call
  const raw = safeExecStr(`sh -c 'git config user.name 2>/dev/null; echo ---SEP---; git branch --show-current 2>/dev/null; echo ---SEP---; git status --porcelain 2>/dev/null' `);
  if (raw) {
    const parts = raw.split('---SEP---').map(s => s.trim());
    ctx.gitUser   = parts[0] || os.userInfo().username;
    ctx.gitBranch = parts[1] || '';
    if (parts[2]) {
      let s = 0, m = 0, u = 0;
      for (const line of parts[2].split('\n')) {
        if (!line || line.length < 2) continue;
        const x = line[0], y = line[1];
        if (x === '?' && y === '?') { u++; continue; }
        if (x !== ' ' && x !== '?') s++;
        if (y !== ' ' && y !== '?') m++;
      }
      const parts2: string[] = [];
      if (s) parts2.push(`+${s}`);
      if (m) parts2.push(`~${m}`);
      if (u) parts2.push(`?${u}`);
      ctx.gitChanges = parts2.join(' ');
    }
  }

  // Memory DB size
  const memDb = path.join(projectRoot, '_kratos', '_memory', 'memory.db');
  try { if (fs.existsSync(memDb)) ctx.memoryKB = Math.round(fs.statSync(memDb).size / 1024); } catch { /* ignore */ }

  // Checkpoint count
  const cpDir = path.join(projectRoot, '_kratos', '_memory', 'checkpoints');
  try {
    if (fs.existsSync(cpDir))
      ctx.checkpoints = fs.readdirSync(cpDir).filter(f => f.endsWith('.json') || f.endsWith('.yaml')).length;
  } catch { /* ignore */ }

  // Sprint done/total
  const statusFile = path.join(projectRoot, 'docs', 'implementation-artifacts', 'sprint-status.yaml');
  try {
    if (fs.existsSync(statusFile)) {
      const content = fs.readFileSync(statusFile, 'utf-8');
      ctx.sprintDone  = (content.match(/status:\s*["']?done/gi) || []).length;
      ctx.sprintTotal = (content.match(/status:/gi) || []).length;
    }
  } catch { /* ignore */ }

  return ctx;
}

// ─── Markdown line renderer ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderMarkdownLine(line: string, chalk: any): string {
  // Headings: ### text  →  bold blue
  const headingMatch = line.match(/^(#{1,6}) (.+)/);
  if (headingMatch) {
    return chalk.bold.blue(headingMatch[2]);
  }
  // Horizontal rule
  if (/^---+$/.test(line.trim())) {
    return chalk.dim('─'.repeat(60));
  }
  // Bullet: "- " or "* " prefix  →  keep, but style bold/inline parts below
  let out = line;
  // Bold+italic: ***text***
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, (_: string, t: string) => chalk.bold.italic.blue(t));
  // Bold: **text**  →  bold cyan (matches "**Deploy & Ops**")
  out = out.replace(/\*\*([^*]+)\*\*/g, (_: string, t: string) => chalk.bold.cyan(t));
  // Italic: *text*  →  italic
  out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_: string, t: string) => chalk.italic(t));
  // Inline code: `text`  →  yellow
  out = out.replace(/`([^`]+)`/g, (_: string, t: string) => chalk.yellow(t));
  return out;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AgentEntry {
  name: string;
  displayName: string;
  title: string;
  icon: string;
  module: string;
  path: string;
}

export interface SessionOptions {
  model?: 'fast' | 'standard' | 'deep';
  stream?: boolean;
}

// ─── Manifest ────────────────────────────────────────────────────────────────

export function loadAgentManifest(kratosRoot: string): AgentEntry[] {
  const csvPath = path.join(kratosRoot, '_config', 'agent-manifest.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`agent-manifest.csv not found at ${csvPath}`);
  }

  const lines = fs.readFileSync(csvPath, 'utf-8').trim().split('\n');
  // Skip header row
  const entries: AgentEntry[] = [];
  for (const line of lines.slice(1)) {
    const cols = parseCSVLine(line);
    if (cols.length < 6) continue;
    entries.push({
      name: cols[0],
      displayName: cols[1],
      title: cols[2],
      icon: cols[3],
      module: cols[4],
      path: cols[5],
    });
  }
  return entries;
}

/** Minimal CSV line parser that handles double-quoted fields. */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let field = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        // Escaped quote
        field += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === ',' && !inQuote) {
      result.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  result.push(field);
  return result;
}

// ─── Agent file loading ───────────────────────────────────────────────────────

interface AgentContent {
  frontmatter: Record<string, string>;
  rawXml: string;
}

function loadAgentFile(agentPath: string, projectRoot: string): AgentContent {
  const fullPath = path.join(projectRoot, agentPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Agent file not found: ${fullPath}`);
  }

  const raw = fs.readFileSync(fullPath, 'utf-8');

  // Parse YAML frontmatter between --- delimiters
  const frontmatter: Record<string, string> = {};
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    for (const line of fmMatch[1].split('\n')) {
      const kv = line.match(/^(\w[\w-]*):\s*['"]?(.*?)['"]?$/);
      if (kv) frontmatter[kv[1]] = kv[2];
    }
  }

  // Strip markdown code fences (```xml ... ```) to get plain XML
  let xmlContent = raw;
  // Remove frontmatter block
  xmlContent = xmlContent.replace(/^---\n[\s\S]*?\n---\n/, '');
  // Remove any leading prose line ("You must fully embody...")
  xmlContent = xmlContent.replace(/^[^\n<]*\n/, '');
  // Strip ```xml / ``` fences
  xmlContent = xmlContent.replace(/```xml\s*/g, '').replace(/```\s*/g, '');

  return { frontmatter, rawXml: xmlContent.trim() };
}

// ─── XML content extraction ───────────────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  // Matches first occurrence of <tag ...>content</tag> or <tag>content</tag>
  const re = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : '';
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, 'i');
  const m = xml.match(re);
  return m ? m[1] : '';
}

// ─── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(
  entry: AgentEntry,
  agentContent: AgentContent,
  baseContent?: AgentContent
): string {
  const xml = agentContent.rawXml;

  const persona = extractTag(xml, 'persona');
  const roleConfig = extractTag(xml, 'role-config');
  const greeting = extractTag(xml, 'greeting');
  const rules = extractTag(xml, 'rules');
  const capabilities = extractAttr(xml, 'agent', 'capabilities');

  const parts: string[] = [];

  parts.push(
    `You are ${entry.displayName} (${entry.icon}), the ${entry.title} in the Kratos AI framework.`
  );

  if (capabilities) {
    parts.push(`\nYour capabilities: ${capabilities}`);
  }

  // Persona
  if (persona) {
    parts.push(`\n## Persona\n${persona}`);
  }

  // Role config
  if (roleConfig) {
    parts.push(`\n## Role Configuration\n${roleConfig}`);
  }

  // Shared base-dev behavior
  if (baseContent) {
    const sharedBehavior = extractTag(baseContent.rawXml, 'shared-behavior');
    if (sharedBehavior) {
      parts.push(`\n## Shared Developer Behavior\n${sharedBehavior}`);
    }
  }

  // Rules
  if (rules) {
    // Extract individual <r> rule items
    const ruleItems = [...rules.matchAll(/<r>([\s\S]*?)<\/r>/gi)].map(
      (m) => `- ${m[1].trim()}`
    );
    if (ruleItems.length > 0) {
      parts.push(`\n## Rules\n${ruleItems.join('\n')}`);
    }
  }

  parts.push(
    `\n## Communication Guidelines`,
    `- Stay in character at all times.`,
    `- Be concise and practical.`,
    `- When referencing files, use paths relative to the project root.`,
    `- When a user asks about workflows or commands, describe what they do and how to use them.`,
    `- Do not output internal XML tags or frontmatter in your responses.`
  );

  // Greeting becomes the first assistant turn, not system prompt
  // (returned separately for display)
  void greeting;

  return parts.join('\n');
}

// ─── Provider config ──────────────────────────────────────────────────────────

interface ProviderModel {
  fast: string;
  standard: string;
  deep: string;
}

function loadProviderModels(kratosRoot: string): ProviderModel {
  const defaults: ProviderModel = {
    fast: 'claude-haiku-4-5-20251001',
    standard: 'claude-sonnet-4-6',
    deep: 'claude-opus-4-6',
  };

  try {
    const yamlPath = path.join(kratosRoot, '_config', 'providers.yaml');
    if (!fs.existsSync(yamlPath)) return defaults;
    const raw = fs.readFileSync(yamlPath, 'utf-8');

    // Simple regex extraction instead of full YAML parse to avoid extra deps
    const fast = raw.match(/fast:\s*["']?([^\s"'\n]+)["']?\s*\n.*?standard:/s)?.[1];
    const standard = raw.match(/standard:\s*["']?([^\s"'\n]+)["']?/)?.[1];
    const deep = raw.match(/deep_reasoning:\s*["']?([^\s"'\n]+)["']?/)?.[1];

    return {
      fast: fast ?? defaults.fast,
      standard: standard ?? defaults.standard,
      deep: deep ?? defaults.deep,
    };
  } catch {
    return defaults;
  }
}

// ─── Mode detection ───────────────────────────────────────────────────────────

type RunMode = 'api' | 'claude-cli';

async function detectRunMode(): Promise<RunMode | null> {
  if (process.env.ANTHROPIC_API_KEY) return 'api';

  // Check if the `claude` CLI is available (Claude subscription / Claude Code)
  return new Promise((resolve) => {
    const proc = spawn('claude', ['--version'], { stdio: 'pipe' });
    proc.on('close', (code) => resolve(code === 0 ? 'claude-cli' : null));
    proc.on('error', () => resolve(null));
  });
}

// ─── Session ──────────────────────────────────────────────────────────────────

export async function startSession(
  agentName: string,
  kratosRoot: string,
  projectRoot: string,
  opts: SessionOptions = {}
): Promise<void> {
  await ui.init();

  // ── Load manifest & find agent ──────────────────────────────────────────
  const manifest = loadAgentManifest(kratosRoot);
  const entry = manifest.find(
    (e) =>
      e.name.toLowerCase() === agentName.toLowerCase() ||
      e.displayName.toLowerCase() === agentName.toLowerCase()
  );

  if (!entry) {
    ui.error(`Unknown agent: "${agentName}"`);
    ui.info(`Run ${ui.theme().accent('kratos agent list')} to see available agents.`);
    process.exit(1);
  }

  // ── Load agent file ─────────────────────────────────────────────────────
  const agentContent = loadAgentFile(entry.path, projectRoot);

  // Load base-dev if this agent extends it
  let baseContent: AgentContent | undefined;
  if (agentContent.frontmatter['extends'] === '_base-dev') {
    try {
      baseContent = loadAgentFile('_kratos/dev/agents/_base-dev.md', projectRoot);
    } catch {
      // Non-fatal — proceed without base content
    }
  }

  // ── Resolve model ───────────────────────────────────────────────────────
  const models = loadProviderModels(kratosRoot);
  const tier = opts.model ?? 'standard';
  const modelId = tier === 'fast' ? models.fast : tier === 'deep' ? models.deep : models.standard;

  // ── Detect run mode ─────────────────────────────────────────────────────
  const mode = await detectRunMode();
  if (!mode) {
    ui.error('No Claude access found.');
    console.log('');
    ui.info('Option 1 — Anthropic API key:');
    console.log(`       export ANTHROPIC_API_KEY=sk-ant-...`);
    ui.info('Option 2 — Claude subscription (Claude Code CLI):');
    console.log(`       Install from https://claude.ai/code, then log in.`);
    console.log('');
    process.exit(1);
  }

  // ── Build system prompt ─────────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(entry, agentContent, baseContent);

  // ── Prepare SDK client (api mode only) ─────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let anthropicClient: any = null;
  if (mode === 'api') {
    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
    } catch {
      ui.error('@anthropic-ai/sdk is not installed. Run: npm install @anthropic-ai/sdk');
      process.exit(1);
    }
  }

  // ── Print session header ────────────────────────────────────────────────
  const t = ui.theme();
  const ctx = gatherSessionContext(projectRoot);

  const sep = t.dim('│');
  const modeLabel = mode === 'api' ? `API · ${modelId}` : `${modelId} · subscription`;

  // Row 1: branding + agent identity
  const branding = `${t.heading(`${entry.icon}  ${entry.displayName}`)}  ${t.dim(`(${entry.title})`)}`;
  const moduleTag = t.dim(`Module: ${entry.module}`);
  console.log('');
  console.log(`  ${t.accent('▊')} ${branding}  ${sep}  ${moduleTag}`);

  // Row 2: Kratos status bar (model · user · branch · changes · memory · sprint)
  const statusParts: string[] = [];
  statusParts.push(t.accent(`▊ Kratos v2.2`));
  if (ctx.gitUser)   statusParts.push(`${t.dim('●')} ${t.heading(ctx.gitUser)}`);
  if (ctx.gitBranch) {
    let branch = `${t.accent('⎇')} ${ctx.gitBranch}`;
    if (ctx.gitChanges) branch += ` ${t.dim(ctx.gitChanges)}`;
    statusParts.push(branch);
  }
  statusParts.push(t.dim(modeLabel));
  if (ctx.memoryKB > 0) {
    const size = ctx.memoryKB >= 1024 ? `${(ctx.memoryKB / 1024).toFixed(1)}MB` : `${ctx.memoryKB}KB`;
    statusParts.push(`${t.dim('🗄')} ${size}`);
  }
  if (ctx.checkpoints > 0) statusParts.push(t.dim(`📌 ${ctx.checkpoints} cp`));
  if (ctx.sprintTotal > 0) statusParts.push(t.dim(`Sprint ✓${ctx.sprintDone}/${ctx.sprintTotal}`));
  console.log(`  ${statusParts.join(`  ${sep}  `)}`);

  // Row 3: hint
  console.log(`  ${t.dim('/exit or Ctrl+C to return to Kratos REPL')}`);
  console.log('');

  // ── Print agent greeting ────────────────────────────────────────────────
  const greeting = extractTag(agentContent.rawXml, 'greeting');
  if (greeting) {
    console.log(`  ${t.accent(entry.displayName + ':')}  ${greeting.replace(/\n/g, '\n  ')}`);
    console.log('');
  }

  // ── Conversation state ──────────────────────────────────────────────────
  type Message = { role: 'user' | 'assistant'; content: string };
  const history: Message[] = [];
  // Persistent CLI session ID — set on first turn, reused via --resume
  let cliSessionId: string | null = null;

  // ── Sends a message and streams the response ────────────────────────────
  async function sendMessage(userText: string): Promise<string> {
    history.push({ role: 'user', content: userText });

    // Show spinner while waiting for first token
    const spinner = ui.spinner(`${entry!.displayName} is thinking…`);

    let fullResponse = '';
    let spinnerStopped = false;

    function stopSpinner(): void {
      if (!spinnerStopped) {
        spinnerStopped = true;
        spinner.stop();
        process.stdout.write(`\n  ${t.accent(entry!.displayName + ':')}  `);
      }
    }

    if (mode === 'api') {
      // ── API key mode: use SDK streaming ──────────────────────────────
      if (opts.stream !== false) {
        const stream = await anthropicClient.messages.stream({
          model: modelId,
          max_tokens: 2048,
          system: systemPrompt,
          messages: history,
        });
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta?.type === 'text_delta'
          ) {
            stopSpinner();
            const text = chunk.delta.text as string;
            process.stdout.write(text);
            fullResponse += text;
          }
        }
        stopSpinner(); // ensure stopped even if empty response
      } else {
        const response = await anthropicClient.messages.create({
          model: modelId,
          max_tokens: 2048,
          system: systemPrompt,
          messages: history,
        });
        stopSpinner();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fullResponse = (response.content[0] as any).text as string;
        process.stdout.write(fullResponse);
      }
    } else {
      // ── Claude CLI mode: persistent session via --session-id / --resume ──
      // First message: create a fresh session with a stable UUID so Claude
      // maintains full conversation history across turns.
      // Subsequent messages: resume that session — no manual history injection needed.
      await new Promise<void>((resolve, reject) => {
        const isFirstMessage = history.length === 1; // only the user turn we just pushed

        const args: string[] = [
          '-p', userText,
          '--output-format', 'stream-json',
          '--verbose',
          '--append-system-prompt', systemPrompt,
        ];

        if (isFirstMessage) {
          // Pin a UUID so we can resume it on the next turn
          cliSessionId = crypto.randomUUID();
          args.push('--session-id', cliSessionId);
        } else if (cliSessionId) {
          args.push('--resume', cliSessionId);
        }

        // Strip CLAUDECODE so the child is not blocked as a nested session
        const childEnv = Object.fromEntries(
          Object.entries(process.env).filter(([k]) => k !== 'CLAUDECODE')
        ) as NodeJS.ProcessEnv;

        const proc = spawn('claude', args, { stdio: ['ignore', 'pipe', 'pipe'], env: childEnv });

        let stderrBuf = '';
        // Line-buffer for markdown rendering: flush styled lines as they complete
        let lineBuf = '';
        const chalk = ui.chalkInstance();

        function flushLineBuf(final = false): void {
          const parts = lineBuf.split('\n');
          const limit = final ? parts.length : parts.length - 1;
          for (let i = 0; i < limit; i++) {
            const rendered = renderMarkdownLine(parts[i], chalk);
            process.stdout.write((i === 0 ? '' : '\n') + rendered);
          }
          lineBuf = final ? '' : (parts[parts.length - 1] ?? '');
        }

        function appendText(text: string): void {
          stopSpinner();
          lineBuf += text;
          fullResponse += text;
          flushLineBuf(false);
        }

        proc.stdout.on('data', (chunk: Buffer) => {
          for (const line of chunk.toString().split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const evt = JSON.parse(trimmed);
              if (evt.type === 'assistant' && Array.isArray(evt.message?.content)) {
                for (const block of evt.message.content) {
                  if (block.type === 'text' && typeof block.text === 'string') {
                    appendText(block.text);
                  }
                }
              }
              if (evt.type === 'result' && typeof evt.result === 'string' && !fullResponse) {
                appendText(evt.result);
              }
            } catch {
              if (trimmed && !trimmed.startsWith('{')) {
                appendText(trimmed);
              }
            }
          }
        });

        proc.stderr.on('data', (chunk: Buffer) => {
          stderrBuf += chunk.toString();
        });

        proc.on('close', (code) => {
          // Flush any remaining partial line
          if (lineBuf) flushLineBuf(true);
          if (code === 0 || fullResponse) {
            stopSpinner(); // no-op if already stopped
            resolve();
          } else {
            stopSpinner();
            const detail = stderrBuf.trim() ? `\n${stderrBuf.trim()}` : '';
            reject(new Error(`claude CLI exited with code ${code}${detail}`));
          }
        });

        proc.on('error', (err) => reject(err));
      });
    }

    console.log('\n');
    history.push({ role: 'assistant', content: fullResponse });
    return fullResponse;
  }

  // ── Readline REPL (resolves when session ends — no process.exit) ────────
  await new Promise<void>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    const prompt = () => {
      rl.question(`  ${t.dim('You:')} `, handleInput);
    };

    async function handleInput(userInput: string): Promise<void> {
      const trimmed = userInput.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      // Exit commands — close and resolve so the caller (REPL) can continue
      if (['/exit', 'exit', 'quit', '/quit', 'bye', '/bye'].includes(trimmed.toLowerCase())) {
        console.log('');
        ui.success(`Session ended. Back to Kratos REPL.`);
        console.log('');
        rl.close();
        resolve();
        return;
      }

      try {
        console.log('');
        await sendMessage(trimmed);
      } catch (err: unknown) {
        console.log('');
        if (err instanceof Error) {
          ui.error(`Error: ${err.message}`);
        } else {
          ui.error('An unexpected error occurred.');
        }
        history.pop();
        console.log('');
      }

      prompt();
    }

    // Ctrl+C — end session, return to REPL
    rl.on('SIGINT', () => {
      console.log('');
      ui.success(`Session ended. Back to Kratos REPL.`);
      console.log('');
      rl.close();
      resolve();
    });

    // Ctrl+D
    rl.on('close', () => resolve());

    prompt();
  });
}

// ─── List helpers (exported for CLI use) ─────────────────────────────────────

export function listAgents(kratosRoot: string): AgentEntry[] {
  return loadAgentManifest(kratosRoot);
}

export function findAgent(kratosRoot: string, nameOrDisplayName: string): AgentEntry | undefined {
  const manifest = loadAgentManifest(kratosRoot);
  return manifest.find(
    (e) =>
      e.name.toLowerCase() === nameOrDisplayName.toLowerCase() ||
      e.displayName.toLowerCase() === nameOrDisplayName.toLowerCase()
  );
}

export function getAgentDetails(
  agent: AgentEntry,
  projectRoot: string
): Record<string, string> {
  try {
    const content = loadAgentFile(agent.path, projectRoot);
    const capabilities = extractAttr(content.rawXml, 'agent', 'capabilities');
    const missionText = extractTag(content.rawXml, 'mission');
    const ownsText = extractTag(content.rawXml, 'owns');
    return {
      capabilities: capabilities || '—',
      mission: missionText || '—',
      owns: ownsText || '—',
      extends: content.frontmatter['extends'] || '—',
      abstract: content.frontmatter['abstract'] || 'false',
    };
  } catch {
    return { capabilities: '—', mission: '—', owns: '—', extends: '—', abstract: 'false' };
  }
}
