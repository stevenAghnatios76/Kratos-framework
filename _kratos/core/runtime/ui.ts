// ui.ts — Centralized terminal formatting for the Kratos CLI
// chalk v5 and ora v9 are ESM-only; lazy-load via dynamic import()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _chalk: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ora: any = null;

async function getChalk(): Promise<any> {
  if (!_chalk) _chalk = (await import('chalk')).default;
  return _chalk;
}

async function getOra(): Promise<any> {
  if (!_ora) _ora = (await import('ora')).default;
  return _ora;
}

// ── Eager-load on first use ─────────────────────────────────

let _ready = false;

export async function init(): Promise<void> {
  if (_ready) return;
  await getChalk();
  await getOra();
  _ready = true;
}

// After init(), chalk is guaranteed available
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function c(): any {
  return _chalk!;
}

/** Returns the chalk instance directly (for callers that do their own formatting). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function chalkInstance(): any {
  return _chalk!;
}

// ── Theme accessors (call after init) ───────────────────────

export function theme() {
  const k = c();
  return {
    primary:  k.white,
    dim:      k.dim.gray,
    accent:   k.cyan,
    label:    k.dim.white,
    pass:     k.green,
    fail:     k.red,
    warn:     k.yellow,
    muted:    k.dim,
    heading:  k.bold.white,
    command:  k.cyan.bold,
  };
}

export function icons() {
  const k = c();
  return {
    pass:     k.green('✓'),
    fail:     k.red('✗'),
    active:   k.cyan('●'),
    inactive: k.dim('○'),
    arrow:    k.dim('▸'),
    bullet:   k.dim('·'),
  };
}

// ── Heading ─────────────────────────────────────────────────

export function heading(text: string): void {
  const t = theme();
  const width = Math.min(process.stdout.columns || 60, 60);
  const inner = ` ${text} `;
  const fill = Math.max(0, width - inner.length - 4);
  console.log('');
  console.log(`  ${t.dim('╭─')}${t.heading(inner)}${t.dim('─'.repeat(fill) + '╮')}`);
}

// ── Subheading ──────────────────────────────────────────────

export function subheading(text: string): void {
  console.log('');
  console.log(`  ${theme().accent(text)}`);
}

// ── Key-Value pair ──────────────────────────────────────────

export function keyValue(label: string, value: string | number, indent: number = 4): void {
  const t = theme();
  const pad = Math.max(0, 20 - label.length);
  const prefix = ' '.repeat(indent);
  console.log(`${prefix}${t.label(label)}${' '.repeat(pad)}${t.primary(String(value))}`);
}

// ── Status row (pass/fail) ──────────────────────────────────

export function statusRow(passed: boolean, name: string, detail?: string): void {
  const t = theme();
  const ic = icons();
  const icon = passed ? ic.pass : ic.fail;
  const suffix = detail ? ` ${t.dim('—')} ${t.dim(detail)}` : '';
  console.log(`  ${icon} ${t.primary(name)}${suffix}`);
}

// ── Result row (search results, patterns) ───────────────────

export function resultRow(label: string, content: string, score?: number): void {
  const t = theme();
  const scorePart = score !== undefined ? `${t.dim('[')}${t.accent(score.toFixed(2))}${t.dim(']')} ` : '';
  console.log(`  ${scorePart}${t.primary(label)}`);
  if (content) {
    console.log(`       ${t.dim(content.split('\n')[0].substring(0, 120))}`);
  }
}

// ── Panel (boxed output) ────────────────────────────────────

export function panel(title: string, lines: string[]): void {
  const t = theme();
  const maxWidth = Math.min(process.stdout.columns || 60, 60);
  const contentWidth = maxWidth - 6;
  const titleInner = ` ${title} `;
  const topFill = Math.max(0, contentWidth - titleInner.length);

  console.log('');
  console.log(`  ${t.dim('╭─')}${t.heading(titleInner)}${t.dim('─'.repeat(topFill) + '─╮')}`);

  for (const line of lines) {
    const stripped = stripAnsi(line);
    const pad = Math.max(0, contentWidth - stripped.length);
    console.log(`  ${t.dim('│')}  ${line}${' '.repeat(pad)}  ${t.dim('│')}`);
  }

  console.log(`  ${t.dim('╰' + '─'.repeat(contentWidth + 4) + '╯')}`);
  console.log('');
}

// ── Simple table (no borders) ───────────────────────────────

export function table(headers: string[], rows: string[][]): void {
  const t = theme();
  const colWidths = headers.map((h, i) => {
    const maxData = rows.reduce((max, row) => Math.max(max, (row[i] || '').length), 0);
    return Math.max(h.length, maxData) + 2;
  });

  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join('');
  console.log(`    ${t.dim(headerLine)}`);

  for (const row of rows) {
    const line = row.map((cell, i) => cell.padEnd(colWidths[i])).join('');
    console.log(`    ${t.primary(line)}`);
  }
}

// ── Messages ────────────────────────────────────────────────

export function error(message: string): void {
  const t = theme();
  const ic = icons();
  console.error(`  ${ic.fail} ${t.fail(message)}`);
}

export function warn(message: string): void {
  const k = c();
  console.log(`  ${k.yellow('●')} ${theme().warn(message)}`);
}

export function success(message: string): void {
  const t = theme();
  const ic = icons();
  console.log(`  ${ic.pass} ${t.pass(message)}`);
}

export function info(message: string): void {
  const t = theme();
  const ic = icons();
  console.log(`  ${ic.bullet} ${t.dim(message)}`);
}

// ── Divider ─────────────────────────────────────────────────

export function divider(): void {
  const width = Math.min(process.stdout.columns || 40, 40);
  console.log(`  ${theme().dim('─'.repeat(width))}`);
}

// ── Spinner ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function spinner(text: string): any {
  const oraFn = _ora!;
  const t = theme();
  const s = oraFn({
    text: t.dim(text),
    color: 'cyan',
    spinner: 'dots',
    indent: 2,
  }).start();
  return s;
}

// ── Command help (slash-command style) ──────────────────────

export function commandHelp(name: string, desc: string): void {
  const t = theme();
  const padded = name.padEnd(24);
  console.log(`  ${t.command(padded)} ${t.dim(desc)}`);
}

// ── Raw pass-through (for formatReport) ─────────────────────

export function raw(text: string): void {
  for (const line of text.split('\n')) {
    console.log(`  ${line}`);
  }
}

// ── Internal helpers ────────────────────────────────────────

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
