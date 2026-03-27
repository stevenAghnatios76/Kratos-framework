#!/usr/bin/env node
import { Command } from 'commander';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import { spawn } from 'child_process';
import * as ui from './ui.js';
import { showSplash } from './splash.js';
import { startSession, listAgents, findAgent, getAgentDetails } from './agent-runner.js';

const program = new Command();

// ── Credentials ───────────────────────────────────────────────────────────────
const CREDENTIALS_PATH = path.join(os.homedir(), '.kratos', 'credentials.json');

/** Read ~/.kratos/credentials.json and inject keys into process.env (non-destructive). */
function loadCredentials(): void {
  try {
    if (!fs.existsSync(CREDENTIALS_PATH)) return;
    const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8')) as Record<string, string>;
    for (const [key, value] of Object.entries(creds)) {
      if (typeof value === 'string' && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // Silently ignore — bad JSON or unreadable file
  }
}

loadCredentials();

// Resolve project root (walk up until we find _kratos/)
function findProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '_kratos'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();
const KRATOS_ROOT = path.join(PROJECT_ROOT, '_kratos');
const MEMORY_DB_PATH = path.join(KRATOS_ROOT, '_memory', 'memory.db');
const CHECKPOINT_DIR = path.join(KRATOS_ROOT, '_memory', 'checkpoints');

program
  .name('kratos')
  .description('Kratos Framework CLI — AI-powered product development')
  .version('2.2.0')
  .option('--splash', 'Show splash screen')
  .action(async () => {
    // Called only in single-command mode with no subcommand — show help
    program.outputHelp();
  });

program.on('option:splash', async () => {
  await ui.init();
  await showSplash();
  process.exit(0);
});

// ============================================================
// MEMORY COMMANDS
// ============================================================
const memory = program.command('memory').description('Manage agent memory');

memory
  .command('search <query>')
  .description('Semantic search across all agent memory')
  .option('-a, --agent <id>', 'Filter by agent ID')
  .option('-p, --partition <name>', 'Filter by partition')
  .option('-l, --limit <n>', 'Max results', '10')
  .action(async (query: string, opts: { agent?: string; partition?: string; limit: string }) => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const s = ui.spinner('Searching memory...');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const results = await mm.search(query, {
      agent_id: opts.agent,
      partition: opts.partition,
      limit: parseInt(opts.limit),
    });
    s.stop();

    if (results.length === 0) {
      ui.info('No results found.');
    } else {
      ui.heading('Search Results');
      for (const entry of results) {
        ui.resultRow(entry.title, entry.content.split('\n')[0].substring(0, 120), entry.score);
        ui.info(`${entry.partition} · ${entry.agent_id}`);
        console.log('');
      }
    }

    await mm.close();
  });

memory
  .command('stats')
  .description('Show memory statistics')
  .action(async () => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const s = ui.spinner('Loading memory stats...');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();
    const stats = await mm.getStats();
    s.stop();

    ui.heading('Memory Statistics');
    ui.keyValue('Total entries', stats.total_entries);
    ui.keyValue('Stale', stats.stale_count);
    ui.keyValue('Expired', stats.expired_count);

    ui.subheading('By partition');
    for (const [p, count] of Object.entries(stats.by_partition)) {
      ui.keyValue(p, count as number);
    }

    ui.subheading('By agent');
    for (const [a, count] of Object.entries(stats.by_agent)) {
      ui.keyValue(a, count as number);
    }

    await mm.close();
  });

memory
  .command('export')
  .description('Export memory to markdown sidecars')
  .option('-a, --agent <id>', 'Export specific agent only')
  .option('-o, --output <dir>', 'Output directory', path.join(KRATOS_ROOT, '_memory'))
  .action(async (opts: { agent?: string; output: string }) => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    if (opts.agent) {
      const md = await mm.exportAgentSidecar(opts.agent);
      ui.raw(md);
    } else {
      await mm.exportAllSidecars(opts.output);
      ui.success(`Sidecars exported to ${opts.output}`);
    }

    await mm.close();
  });

memory
  .command('migrate')
  .description('Import existing markdown sidecars into database')
  .action(async () => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const { SidecarMigration } = await import('../../intelligence/memory/migration.js');
    const s = ui.spinner('Migrating sidecars...');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const migration = new SidecarMigration(mm, path.join(KRATOS_ROOT, '_memory'));
    const result = await migration.migrate();
    s.stop();

    ui.heading('Migration Complete');
    ui.keyValue('Agents migrated', result.agents_migrated);
    ui.keyValue('Entries imported', result.entries_imported);
    if (result.errors.length > 0) {
      ui.subheading('Errors');
      for (const err of result.errors) {
        ui.error(err);
      }
    }

    await mm.close();
  });

memory
  .command('expire')
  .description('Remove expired entries')
  .action(async () => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const s = ui.spinner('Expiring stale entries...');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();
    const count = await mm.expireStaleEntries();
    s.stop();
    ui.success(`Expired ${count} entries.`);
    await mm.close();
  });

// ============================================================
// LEARN COMMANDS
// ============================================================
const learn = program.command('learn').description('Self-learning system');

learn
  .command('distill')
  .description('Extract patterns from scored trajectories')
  .option('-a, --agent <id>', 'Distill for specific agent')
  .action(async (opts: { agent?: string }) => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const { PatternDistiller } = await import('../../intelligence/learning/pattern-distiller.js');
    const s = ui.spinner('Distilling patterns...');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const distiller = new PatternDistiller(mm);
    const result = await distiller.runDistillationCycle();
    s.stop();

    ui.heading('Distillation Complete');
    ui.keyValue('Patterns created', result.patterns_created);
    ui.keyValue('Anti-patterns created', result.anti_patterns_created);
    ui.keyValue('Trajectories analyzed', result.trajectories_analyzed);

    await mm.close();
  });

learn
  .command('patterns')
  .description('List learned patterns')
  .option('-a, --agent <id>', 'Filter by agent')
  .option('--anti', 'Show anti-patterns instead')
  .action(async (opts: { agent?: string; anti?: boolean }) => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const partition = opts.anti ? 'anti-patterns' : 'patterns';
    const entries = await mm.query({
      partition,
      agent_id: opts.agent,
      status: 'active',
      order_by: 'score',
    });

    if (entries.length === 0) {
      ui.info(`No ${partition} found.`);
    } else {
      ui.heading(opts.anti ? 'Anti-Patterns' : 'Patterns');
      for (const entry of entries) {
        ui.resultRow(entry.title, entry.content.split('\n')[0].substring(0, 120), entry.score);
        ui.info(`agent: ${entry.agent_id}`);
        console.log('');
      }
    }

    await mm.close();
  });

learn
  .command('protect')
  .description('Run forgetting shield protection cycle')
  .action(async () => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const { ForgettingShield } = await import('../../intelligence/learning/forgetting-shield.js');
    const s = ui.spinner('Running protection cycle...');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const shield = new ForgettingShield(mm);
    const result = await shield.runProtectionCycle();
    s.stop();

    ui.heading('Protection Cycle Complete');
    ui.keyValue('Newly protected', result.newly_protected);
    ui.keyValue('Unprotected', result.unprotected);
    ui.keyValue('Total protected', result.total_protected);

    await mm.close();
  });

// ============================================================
// SPRINT COMMANDS
// ============================================================
const sprint = program.command('sprint').description('Sprint execution');

sprint
  .command('plan')
  .description('Generate parallel execution plan for current sprint')
  .option('-s, --status <path>', 'Sprint status file path')
  .action(async (opts: { status?: string }) => {
    const { DependencyGraph } = await import('./dependency-graph.js');
    const statusPath = opts.status || path.join(PROJECT_ROOT, 'docs', 'implementation-artifacts', 'sprint-status.yaml');

    if (!fs.existsSync(statusPath)) {
      ui.error(`Sprint status file not found: ${statusPath}`);
      process.exit(1);
    }

    const graph = new DependencyGraph();
    await graph.buildFromSprint(statusPath);
    ui.raw(graph.toText());
  });

sprint
  .command('reviews <story_key>')
  .description('Run all 6 review gates in parallel for a story')
  .action(async (storyKey: string) => {
    const { ParallelExecutor } = await import('./parallel-executor.js');
    const executor = new ParallelExecutor({
      max_concurrent: 6,
      mode: 'parallel',
      conflict_detection: false,
      heartbeat_interval_sec: 60,
      stall_timeout_sec: 300,
      execution_mode: 'normal',
    });

    const s = ui.spinner(`Running all 6 reviews for ${storyKey}...`);
    const result = await executor.executeReviewsParallel(storyKey);
    s.stop();

    ui.heading(`Review Results — ${storyKey}`);
    for (const [review, status] of Object.entries(result.results)) {
      ui.statusRow(status === 'PASSED', review);
    }
    ui.divider();
    ui.keyValue('All passed', result.all_passed ? 'Yes' : 'No');
    ui.keyValue('Duration', `${result.duration_sec.toFixed(1)}s`);
  });

// ============================================================
// PROVIDERS COMMANDS
// ============================================================
const providers = program.command('providers').description('Manage LLM providers');

providers
  .command('list')
  .description('Show configured providers and availability')
  .action(async () => {
    const { ProviderRegistry } = await import('../../providers/index.js');
    const registry = new ProviderRegistry();
    const configPath = path.join(KRATOS_ROOT, '_config', 'providers.yaml');
    await registry.init(configPath);

    const list = registry.listProviders();
    ui.heading('LLM Providers');
    for (const p of list) {
      ui.statusRow(p.available, `${p.name} (${p.tier})`);
      ui.keyValue('fast', p.models.fast, 6);
      ui.keyValue('standard', p.models.standard, 6);
      ui.keyValue('deep_reasoning', p.models.deep_reasoning, 6);
      console.log('');
    }
  });

providers
  .command('test <name>')
  .description('Send test prompt to a provider')
  .action(async (name: string) => {
    const { ProviderRegistry } = await import('../../providers/index.js');
    const registry = new ProviderRegistry();
    const configPath = path.join(KRATOS_ROOT, '_config', 'providers.yaml');
    await registry.init(configPath);

    const provider = registry.getProvider(name);
    if (!provider) {
      ui.error(`Unknown provider: ${name}`);
      process.exit(1);
    }
    if (!provider.available) {
      ui.error(`Provider ${name} is not available (SDK missing or not configured)`);
      process.exit(1);
    }

    const s = ui.spinner(`Testing ${name}...`);
    const result = await provider.test();
    if (result.ok) {
      s.succeed(`${name} — OK`);
    } else {
      s.fail(`${name} — Failed`);
    }
    ui.keyValue('Latency', `${result.latency_ms}ms`);
    if (result.error) ui.error(result.error);
  });

providers
  .command('cost-estimate')
  .description('Estimate sprint cost across providers')
  .option('-t, --tokens <n>', 'Estimated total tokens per sprint', '500000')
  .action(async (opts: { tokens: string }) => {
    const { ProviderRegistry } = await import('../../providers/index.js');
    const registry = new ProviderRegistry();
    const configPath = path.join(KRATOS_ROOT, '_config', 'providers.yaml');
    await registry.init(configPath);

    const totalTokens = parseInt(opts.tokens);
    const inputTokens = Math.round(totalTokens * 0.7);
    const outputTokens = Math.round(totalTokens * 0.3);

    ui.heading(`Sprint Cost Estimate (${totalTokens.toLocaleString()} tokens)`);
    for (const tier of ['fast', 'standard', 'deep_reasoning'] as const) {
      const estimates = registry.estimateCost(inputTokens, outputTokens, tier);
      ui.subheading(tier);
      for (const [provider, amount] of Object.entries(estimates)) {
        ui.keyValue(provider, `$${(amount as number).toFixed(4)}`);
      }
    }
  });

// Mapping of provider name → env var name
const PROVIDER_ENV_VARS: Record<string, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai:    'OPENAI_API_KEY',
  google:    'GOOGLE_AI_API_KEY',
};

providers
  .command('set-key <provider> <key>')
  .description('Save an API key for a provider (stored in ~/.kratos/credentials.json)')
  .action((provider: string, key: string) => {
    const envVar = PROVIDER_ENV_VARS[provider.toLowerCase()];
    if (!envVar) {
      ui.error(`Unknown provider: "${provider}". Valid: ${Object.keys(PROVIDER_ENV_VARS).join(', ')}`);
      process.exit(1);
    }

    let creds: Record<string, string> = {};
    if (fs.existsSync(CREDENTIALS_PATH)) {
      try { creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8')); } catch { /* ignore */ }
    }

    const dir = path.dirname(CREDENTIALS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    creds[envVar] = key;
    fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), { mode: 0o600 });
    ui.success(`API key for ${provider} saved to ${CREDENTIALS_PATH}`);
    ui.info(`Environment variable: ${envVar}`);
  });

providers
  .command('remove-key <provider>')
  .description('Remove a saved API key for a provider')
  .action((provider: string) => {
    const envVar = PROVIDER_ENV_VARS[provider.toLowerCase()];
    if (!envVar) {
      ui.error(`Unknown provider: "${provider}". Valid: ${Object.keys(PROVIDER_ENV_VARS).join(', ')}`);
      process.exit(1);
    }

    if (!fs.existsSync(CREDENTIALS_PATH)) {
      ui.info('No credentials file found — nothing to remove.');
      return;
    }

    let creds: Record<string, string> = {};
    try { creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8')); } catch { /* ignore */ }

    if (!creds[envVar]) {
      ui.info(`No saved key found for ${provider}.`);
      return;
    }

    delete creds[envVar];
    fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), { mode: 0o600 });
    ui.success(`API key for ${provider} removed.`);
  });

providers
  .command('keys')
  .description('Show which API keys are configured (values masked)')
  .action(() => {
    let fileCreds: Record<string, string> = {};
    if (fs.existsSync(CREDENTIALS_PATH)) {
      try { fileCreds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8')); } catch { /* ignore */ }
    }

    ui.heading('API Keys');
    for (const [name, envVar] of Object.entries(PROVIDER_ENV_VARS)) {
      const value = process.env[envVar] || fileCreds[envVar];
      const source = process.env[envVar] ? 'env var' : fileCreds[envVar] ? 'credentials file' : 'not set';
      const masked = value
        ? `${value.slice(0, 8)}****${value.slice(-4)}`
        : '—';
      ui.keyValue(name, `${masked}  (${source})`);
    }
    console.log('');
    ui.info(`Credentials file: ${CREDENTIALS_PATH}`);
  });

// ============================================================
// COST COMMANDS
// ============================================================
const cost = program.command('cost').description('Cost tracking and routing');

cost
  .command('report')
  .description('Show cost report')
  .option('-p, --period <period>', 'Time period: today, week, month, all', 'today')
  .action(async (opts: { period: string }) => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const { BudgetTracker } = await import('../../providers/budget-tracker.js');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const tracker = new BudgetTracker(mm);
    const report = await tracker.getSpend(opts.period as 'today' | 'week' | 'month' | 'all');
    ui.raw(tracker.formatReport(report));

    await mm.close();
  });

cost
  .command('route <workflow>')
  .description('Preview routing decision for a workflow')
  .action(async (workflow: string) => {
    const { CostRouter } = await import('../../providers/cost-router.js');
    const router = new CostRouter();
    const decision = router.route(workflow);
    ui.raw(router.formatDecision(decision));
  });

cost
  .command('savings')
  .description('Show savings vs all-Opus baseline')
  .option('-p, --period <period>', 'Time period: today, week, month, all', 'month')
  .action(async (opts: { period: string }) => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const { BudgetTracker } = await import('../../providers/budget-tracker.js');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const tracker = new BudgetTracker(mm);
    const savings = await tracker.calculateSavings(opts.period as 'today' | 'week' | 'month' | 'all');

    ui.heading(`Cost Savings (${opts.period})`);
    ui.keyValue('Actual cost', `$${savings.actual_cost.toFixed(4)}`);
    ui.keyValue('Opus baseline', `$${savings.opus_baseline.toFixed(4)}`);
    ui.keyValue('Savings', `$${savings.savings.toFixed(4)} (${savings.savings_pct.toFixed(1)}%)`);

    await mm.close();
  });

// ============================================================
// VALIDATE COMMANDS
// ============================================================
const validate = program.command('validate').description('Artifact validation');

validate
  .command('artifact <path>')
  .description('Validate artifact claims against ground truth')
  .action(async (artifactPath: string) => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const { GroundTruth } = await import('../../intelligence/validation/ground-truth.js');
    const { Validator } = await import('../../intelligence/validation/validator.js');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const gt = new GroundTruth(mm, PROJECT_ROOT);
    const s = ui.spinner('Refreshing ground truth...');
    await gt.refresh();
    s.stop();

    const validator = new Validator(gt);
    const resolvedPath = path.resolve(artifactPath);
    const report = await validator.validate(resolvedPath);
    ui.raw(validator.formatReport(report));

    await mm.close();
    process.exit(report.pass ? 0 : 1);
  });

validate
  .command('refresh-ground-truth')
  .description('Rescan filesystem and update ground truth')
  .action(async () => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const { GroundTruth } = await import('../../intelligence/validation/ground-truth.js');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const gt = new GroundTruth(mm, PROJECT_ROOT);
    const s = ui.spinner('Scanning filesystem...');
    const result = await gt.refresh();
    s.stop();

    ui.heading('Ground Truth Refreshed');
    ui.keyValue('Facts stored', result.facts_stored);
    for (const [category, count] of Object.entries(result.categories)) {
      ui.keyValue(category, count as number);
    }

    await mm.close();
  });

validate
  .command('ground-truth')
  .description('Show cached ground truth facts')
  .option('-c, --category <cat>', 'Filter by category: file, dependency, config, structure')
  .action(async (opts: { category?: string }) => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const { GroundTruth } = await import('../../intelligence/validation/ground-truth.js');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const gt = new GroundTruth(mm, PROJECT_ROOT);
    const facts = await gt.getFacts(opts.category);

    if (facts.length === 0) {
      ui.info('No ground truth facts found.');
      ui.info('Run: kratos validate refresh-ground-truth');
    } else {
      ui.heading(`Ground Truth Facts (${facts.length})`);
      const grouped: Record<string, typeof facts> = {};
      for (const f of facts) {
        if (!grouped[f.category]) grouped[f.category] = [];
        grouped[f.category].push(f);
      }
      for (const [category, items] of Object.entries(grouped)) {
        ui.subheading(`${category} (${items.length})`);
        for (const item of items.slice(0, 20)) {
          ui.keyValue(item.key, item.value);
        }
        if (items.length > 20) ui.info(`... and ${items.length - 20} more`);
      }
    }

    await mm.close();
  });

// ============================================================
// STATUS COMMAND
// ============================================================
program
  .command('status')
  .description('Show current sprint status + agent health')
  .action(async () => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();
    const stats = await mm.getStats();

    ui.heading('Kratos Status');
    ui.keyValue('Memory entries', stats.total_entries);
    ui.keyValue('Stale entries', stats.stale_count);

    const statusPath = path.join(PROJECT_ROOT, 'docs', 'implementation-artifacts', 'sprint-status.yaml');
    if (fs.existsSync(statusPath)) {
      ui.statusRow(true, 'Sprint status', statusPath);
    } else {
      ui.statusRow(false, 'Sprint status', 'No active sprint');
    }

    await mm.close();
  });

// ============================================================
// DOCTOR COMMAND
// ============================================================
program
  .command('doctor')
  .description('System health check')
  .action(async () => {
    const checks: { name: string; passed: boolean; detail: string }[] = [];

    // Node.js version
    const nodeVersion = process.version.replace('v', '');
    const major = parseInt(nodeVersion.split('.')[0]);
    checks.push({
      name: 'Node.js >= 18',
      passed: major >= 18,
      detail: `v${nodeVersion}`,
    });

    // _kratos/ directory
    checks.push({
      name: '_kratos/ directory exists',
      passed: fs.existsSync(KRATOS_ROOT),
      detail: KRATOS_ROOT,
    });

    // global.yaml
    const globalYamlPath = path.join(KRATOS_ROOT, '_config', 'global.yaml');
    checks.push({
      name: 'global.yaml is readable',
      passed: fs.existsSync(globalYamlPath),
      detail: globalYamlPath,
    });

    // Intelligence module
    checks.push({
      name: 'Intelligence module exists',
      passed: fs.existsSync(path.join(KRATOS_ROOT, 'intelligence', 'index.ts')),
      detail: path.join(KRATOS_ROOT, 'intelligence/'),
    });

    // sql.js
    let sqlJsInstalled = false;
    try {
      require.resolve('sql.js');
      sqlJsInstalled = true;
    } catch { /* not installed */ }
    checks.push({
      name: 'sql.js installed',
      passed: sqlJsInstalled,
      detail: sqlJsInstalled ? 'OK' : 'Run: npm install sql.js',
    });

    // Memory directory
    const memoryDir = path.join(KRATOS_ROOT, '_memory');
    checks.push({
      name: 'Memory directory exists',
      passed: fs.existsSync(memoryDir),
      detail: memoryDir,
    });

    // Phase 1 checkpoint
    const phase1Checkpoint = path.join(CHECKPOINT_DIR, 'upgrade-phase-1.yaml');
    checks.push({
      name: 'Phase 1 checkpoint',
      passed: fs.existsSync(phase1Checkpoint),
      detail: fs.existsSync(phase1Checkpoint) ? 'Completed' : 'Not found',
    });

    // Phase 3: providers.yaml
    const providersYamlPath = path.join(KRATOS_ROOT, '_config', 'providers.yaml');
    checks.push({
      name: 'providers.yaml exists',
      passed: fs.existsSync(providersYamlPath),
      detail: fs.existsSync(providersYamlPath) ? 'OK' : 'Missing — Phase 3 not installed',
    });

    // Phase 3: optional deps
    const optDeps = ['@anthropic-ai/sdk', 'openai', '@google/generative-ai'];
    for (const dep of optDeps) {
      let installed = false;
      try { require.resolve(dep); installed = true; } catch { /* optional */ }
      checks.push({
        name: `${dep} (optional)`,
        passed: true, // optional deps don't fail the check
        detail: installed ? 'Installed' : 'Not installed (optional)',
      });
    }

    // Phase 3 checkpoint
    const phase3Checkpoint = path.join(CHECKPOINT_DIR, 'upgrade-phase-3.yaml');
    checks.push({
      name: 'Phase 3 checkpoint',
      passed: fs.existsSync(phase3Checkpoint),
      detail: fs.existsSync(phase3Checkpoint) ? 'Completed' : 'Not found',
    });

    // Phase 4: observability modules
    checks.push({
      name: 'Observability metrics module',
      passed: fs.existsSync(path.join(KRATOS_ROOT, 'observability', 'metrics', 'index.ts')),
      detail: fs.existsSync(path.join(KRATOS_ROOT, 'observability', 'metrics', 'index.ts')) ? 'OK' : 'Missing',
    });
    checks.push({
      name: 'Observability codebase module',
      passed: fs.existsSync(path.join(KRATOS_ROOT, 'observability', 'codebase', 'index.ts')),
      detail: fs.existsSync(path.join(KRATOS_ROOT, 'observability', 'codebase', 'index.ts')) ? 'OK' : 'Missing',
    });
    checks.push({
      name: 'Observability plugins module',
      passed: fs.existsSync(path.join(KRATOS_ROOT, 'observability', 'plugins', 'index.ts')),
      detail: fs.existsSync(path.join(KRATOS_ROOT, 'observability', 'plugins', 'index.ts')) ? 'OK' : 'Missing',
    });
    checks.push({
      name: 'plugins.yaml exists',
      passed: fs.existsSync(path.join(KRATOS_ROOT, '_config', 'plugins.yaml')),
      detail: fs.existsSync(path.join(KRATOS_ROOT, '_config', 'plugins.yaml')) ? 'OK' : 'Missing',
    });

    // Phase 4 checkpoint
    const phase4Checkpoint = path.join(CHECKPOINT_DIR, 'upgrade-phase-4.yaml');
    checks.push({
      name: 'Phase 4 checkpoint',
      passed: fs.existsSync(phase4Checkpoint),
      detail: fs.existsSync(phase4Checkpoint) ? 'Completed' : 'Not found',
    });

    console.log('');
    ui.heading('Kratos Health Check');
    let allPassed = true;
    for (const check of checks) {
      ui.statusRow(check.passed, check.name, check.detail);
      if (!check.passed) allPassed = false;
    }
    ui.divider();
    if (allPassed) {
      ui.success('All checks passed.');
    } else {
      ui.error('Some checks failed.');
    }
    process.exit(allPassed ? 0 : 1);
  });

// ============================================================
// DASHBOARD COMMAND
// ============================================================
program
  .command('dashboard')
  .description('Launch web dashboard')
  .option('-p, --port <n>', 'Port number', '3456')
  .action(async (opts: { port: string }) => {
    const { spawn } = await import('child_process');
    const dashboardDir = path.join(PROJECT_ROOT, 'dashboard');
    if (!fs.existsSync(dashboardDir)) {
      ui.error('Dashboard directory not found.');
      process.exit(1);
    }
    const s = ui.spinner(`Launching dashboard on port ${opts.port}...`);
    const child = spawn('npm', ['start'], {
      cwd: dashboardDir,
      stdio: 'inherit',
      env: { ...process.env, PORT: opts.port },
    });
    child.on('spawn', () => s.succeed(`Dashboard running on port ${opts.port}`));
    child.on('error', (err: Error) => { s.fail(`Failed to start dashboard: ${err.message}`); });
  });

// ============================================================
// HOOKS COMMANDS
// ============================================================
const hooks = program.command('hooks').description('Manage lifecycle hooks');

hooks
  .command('list')
  .description('List all configured hooks')
  .action(async () => {
    const { HookExecutor } = await import('./hook-executor.js');
    const hooksConfigPath = path.join(KRATOS_ROOT, '_config', 'hooks.yaml');
    const executor = new HookExecutor(hooksConfigPath);
    await executor.loadConfig();
    const allHooks = executor.listHooks();

    ui.heading('Lifecycle Hooks');
    for (const [point, defs] of Object.entries(allHooks)) {
      const hookDefs = defs as { command: string; on_fail: string }[];
      const count = hookDefs.length;
      ui.subheading(`${point}: ${count === 0 ? '(none)' : `${count} hook(s)`}`);
      for (const def of hookDefs) {
        ui.keyValue(def.command, `on_fail: ${def.on_fail}`, 6);
      }
    }
  });

hooks
  .command('test <hookPoint>')
  .description('Test-fire a hook point with sample context')
  .action(async (hookPoint: string) => {
    const { HookExecutor } = await import('./hook-executor.js');
    const hooksConfigPath = path.join(KRATOS_ROOT, '_config', 'hooks.yaml');
    const executor = new HookExecutor(hooksConfigPath);
    await executor.loadConfig();

    const s = ui.spinner(`Testing hook point: ${hookPoint}...`);
    const results = await executor.execute(hookPoint, {
      workflow_name: 'test',
      step_number: 1,
      story_key: 'TEST-001',
    });
    s.stop();

    if (results.length === 0) {
      ui.info('No hooks configured for this point.');
    } else {
      ui.heading(`Hook Results — ${hookPoint}`);
      for (const r of results) {
        ui.statusRow(r.exit_code === 0, r.command, `${r.duration_ms}ms — ${r.action_taken}`);
      }
    }
  });

// ============================================================
// METRICS COMMANDS (Phase 4)
// ============================================================
const metrics = program.command('metrics').description('Observability metrics');

metrics
  .command('sprint')
  .description('Show sprint velocity, cycle time, burndown, and health')
  .option('-s, --status <path>', 'Sprint status file path')
  .action(async (opts: { status?: string }) => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const { SprintMetrics } = await import('../../observability/metrics/sprint-metrics.js');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const statusPath = opts.status || path.join(PROJECT_ROOT, 'docs', 'implementation-artifacts', 'sprint-status.yaml');
    const sm = new SprintMetrics(mm);
    try {
      const report = sm.calculate(statusPath);
      sm.recordMetrics(report);
      ui.raw(sm.formatReport(report));
    } catch (err) {
      ui.error((err as Error).message);
      process.exit(1);
    }
    await mm.close();
  });

metrics
  .command('agents')
  .description('Show agent leaderboard with pass rates and learning trends')
  .action(async () => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const { AgentMetrics } = await import('../../observability/metrics/agent-metrics.js');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const am = new AgentMetrics(mm);
    const report = am.calculate();
    am.recordMetrics(report);
    ui.raw(am.formatReport(report));
    await mm.close();
  });

metrics
  .command('quality')
  .description('Show first-pass rate, gate pass rates, and quality score')
  .action(async () => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const { QualityMetrics } = await import('../../observability/metrics/quality-metrics.js');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const qm = new QualityMetrics(mm);
    const report = qm.calculate();
    qm.recordMetrics(report);
    ui.raw(qm.formatReport(report));
    await mm.close();
  });

metrics
  .command('cost')
  .description('Show cost per story, tier distribution, savings, and forecast')
  .option('-p, --period <period>', 'Time period: today, week, month, all', 'month')
  .action(async (opts: { period: string }) => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const { CostMetrics } = await import('../../observability/metrics/cost-metrics.js');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const cm = new CostMetrics(mm);
    const report = cm.calculate(opts.period as 'today' | 'week' | 'month' | 'all');
    cm.recordMetrics(report);
    ui.raw(cm.formatReport(report));
    await mm.close();
  });

metrics
  .command('export')
  .description('Export all metrics as JSON')
  .option('-t, --type <type>', 'Filter by metric type')
  .option('-o, --output <file>', 'Output file path')
  .action(async (opts: { type?: string; output?: string }) => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const { MetricsCollector } = await import('../../observability/metrics/collector.js');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const mc = new MetricsCollector(mm);
    const data = mc.exportJson({ metric_type: opts.type });

    if (opts.output) {
      fs.writeFileSync(opts.output, JSON.stringify(data, null, 2));
      ui.success(`Exported ${data.length} metrics to ${opts.output}`);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
    await mm.close();
  });

// ============================================================
// CODEBASE COMMANDS (Phase 4)
// ============================================================
const codebase = program.command('codebase').description('Codebase intelligence');

codebase
  .command('scan')
  .description('Run incremental codebase scan with checksums')
  .action(async () => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const { CodebaseScanner } = await import('../../observability/codebase/scanner.js');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const scanner = new CodebaseScanner(mm, PROJECT_ROOT);
    const s = ui.spinner('Scanning codebase...');
    const result = scanner.scan();
    s.stop();
    ui.raw(scanner.formatReport(result));
    await mm.close();
  });

codebase
  .command('drift')
  .description('Detect architecture doc vs reality drift')
  .action(async () => {
    const { DriftDetector } = await import('../../observability/codebase/drift-detector.js');
    const detector = new DriftDetector(PROJECT_ROOT);
    const s = ui.spinner('Detecting architecture drift...');
    const report = detector.detect();
    s.stop();
    ui.raw(detector.formatReport(report));
    process.exit(report.drift_score > 50 ? 1 : 0);
  });

codebase
  .command('debt')
  .description('Detect technical debt: complexity, size, test gaps')
  .action(async () => {
    const { DebtTracker } = await import('../../observability/codebase/debt-tracker.js');
    const tracker = new DebtTracker(PROJECT_ROOT);
    const s = ui.spinner('Analyzing technical debt...');
    const report = tracker.analyze();
    s.stop();
    ui.raw(tracker.formatReport(report));
  });

codebase
  .command('hotspots')
  .description('Show files with most issues and changes')
  .action(async () => {
    const { DebtTracker } = await import('../../observability/codebase/debt-tracker.js');
    const tracker = new DebtTracker(PROJECT_ROOT);
    const report = tracker.analyze();

    ui.heading('Codebase Hotspots');
    if (report.hotspots.length === 0) {
      ui.info('No hotspots detected.');
    } else {
      for (const h of report.hotspots) {
        ui.keyValue(h.file, `${h.issues} issues`);
      }
    }
  });

codebase
  .command('ownership')
  .description('Show file-to-story-to-agent ownership map')
  .action(async () => {
    const { OwnershipMap } = await import('../../observability/codebase/ownership-map.js');
    const ownership = new OwnershipMap(CHECKPOINT_DIR);
    const report = ownership.build();
    ui.raw(ownership.formatReport(report));
  });

codebase
  .command('stats')
  .description('Show codebase size and language breakdown')
  .action(async () => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager.js');
    const { CodebaseScanner } = await import('../../observability/codebase/scanner.js');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const scanner = new CodebaseScanner(mm, PROJECT_ROOT);
    const stats = scanner.getStats();
    ui.heading('Codebase Stats');
    ui.keyValue('Total files', stats.total_files);
    ui.keyValue('Total lines', stats.total_lines.toLocaleString());

    ui.subheading('By Language');
    const sorted = Object.entries(stats.by_language).sort((a, b) => b[1] - a[1]);
    for (const [lang, count] of sorted) {
      ui.keyValue(lang, `${count} files`);
    }
    await mm.close();
  });

// ============================================================
// PLUGINS COMMANDS (Phase 4)
// ============================================================
const plugins = program.command('plugins').description('Plugin management');

plugins
  .command('list')
  .description('List all discovered and registered plugins')
  .action(async () => {
    const { PluginManifest } = await import('../../observability/plugins/plugin-manifest.js');
    const { PluginLoader } = await import('../../observability/plugins/plugin-loader.js');
    const { PluginRegistry } = await import('../../observability/plugins/plugin-registry.js');

    const configPath = path.join(KRATOS_ROOT, '_config', 'plugins.yaml');
    const pluginsDir = path.join(KRATOS_ROOT, 'plugins');

    const manifest = new PluginManifest(configPath);
    manifest.load();
    const loader = new PluginLoader(pluginsDir, manifest);
    const registry = new PluginRegistry(manifest, loader);

    const allPlugins = registry.discoverAndList();
    ui.raw(registry.formatList(allPlugins));
  });

plugins
  .command('discover')
  .description('Scan plugins directory for unregistered plugins')
  .action(async () => {
    const { PluginManifest } = await import('../../observability/plugins/plugin-manifest.js');
    const { PluginLoader } = await import('../../observability/plugins/plugin-loader.js');

    const configPath = path.join(KRATOS_ROOT, '_config', 'plugins.yaml');
    const pluginsDir = path.join(KRATOS_ROOT, 'plugins');

    const manifest = new PluginManifest(configPath);
    manifest.load();
    const loader = new PluginLoader(pluginsDir, manifest);
    const discovered = loader.discover();

    if (discovered.length === 0) {
      ui.info('No plugins discovered.');
    } else {
      ui.heading(`Discovered ${discovered.length} plugin(s)`);
      for (const p of discovered) {
        ui.keyValue(p.name, `${p.type} — ${p.has_manifest ? 'has manifest' : 'no manifest'}`);
      }
    }
  });

plugins
  .command('validate <name>')
  .description('Validate a plugin definition')
  .action(async (name: string) => {
    const { PluginManifest } = await import('../../observability/plugins/plugin-manifest.js');
    const { PluginLoader } = await import('../../observability/plugins/plugin-loader.js');

    const configPath = path.join(KRATOS_ROOT, '_config', 'plugins.yaml');
    const pluginsDir = path.join(KRATOS_ROOT, 'plugins');

    const manifest = new PluginManifest(configPath);
    manifest.load();
    const plugin = manifest.getPlugin(name);
    if (!plugin) {
      ui.error(`Plugin not found: ${name}`);
      process.exit(1);
    }

    const loader = new PluginLoader(pluginsDir, manifest);
    const result = loader.validate(plugin);

    if (result.valid) {
      ui.success(`Validation for ${name}: VALID`);
    } else {
      ui.error(`Validation for ${name}: INVALID`);
    }
    if (result.errors.length > 0) {
      ui.subheading('Errors');
      for (const e of result.errors) ui.error(e);
    }
    if (result.warnings.length > 0) {
      ui.subheading('Warnings');
      for (const w of result.warnings) ui.warn(w);
    }
    process.exit(result.valid ? 0 : 1);
  });

plugins
  .command('enable <name>')
  .description('Enable a registered plugin')
  .action(async (name: string) => {
    const { PluginManifest } = await import('../../observability/plugins/plugin-manifest.js');
    const { PluginLoader } = await import('../../observability/plugins/plugin-loader.js');
    const { PluginRegistry } = await import('../../observability/plugins/plugin-registry.js');

    const configPath = path.join(KRATOS_ROOT, '_config', 'plugins.yaml');
    const pluginsDir = path.join(KRATOS_ROOT, 'plugins');

    const manifest = new PluginManifest(configPath);
    manifest.load();
    const loader = new PluginLoader(pluginsDir, manifest);
    const registry = new PluginRegistry(manifest, loader);
    const result = registry.enable(name);
    result.success ? ui.success(result.message) : ui.error(result.message);
    process.exit(result.success ? 0 : 1);
  });

plugins
  .command('disable <name>')
  .description('Disable a registered plugin')
  .action(async (name: string) => {
    const { PluginManifest } = await import('../../observability/plugins/plugin-manifest.js');
    const { PluginLoader } = await import('../../observability/plugins/plugin-loader.js');
    const { PluginRegistry } = await import('../../observability/plugins/plugin-registry.js');

    const configPath = path.join(KRATOS_ROOT, '_config', 'plugins.yaml');
    const pluginsDir = path.join(KRATOS_ROOT, 'plugins');

    const manifest = new PluginManifest(configPath);
    manifest.load();
    const loader = new PluginLoader(pluginsDir, manifest);
    const registry = new PluginRegistry(manifest, loader);
    const result = registry.disable(name);
    result.success ? ui.success(result.message) : ui.error(result.message);
    process.exit(result.success ? 0 : 1);
  });

plugins
  .command('create <name>')
  .description('Create a new plugin scaffold')
  .option('-t, --type <type>', 'Plugin type: agent, workflow, skill, task, hook', 'agent')
  .action(async (name: string, opts: { type: string }) => {
    const { PluginManifest } = await import('../../observability/plugins/plugin-manifest.js');
    const { PluginLoader } = await import('../../observability/plugins/plugin-loader.js');
    const { PluginRegistry } = await import('../../observability/plugins/plugin-registry.js');

    const configPath = path.join(KRATOS_ROOT, '_config', 'plugins.yaml');
    const pluginsDir = path.join(KRATOS_ROOT, 'plugins');

    const manifest = new PluginManifest(configPath);
    manifest.load();
    const loader = new PluginLoader(pluginsDir, manifest);
    const registry = new PluginRegistry(manifest, loader);

    const validTypes = ['agent', 'workflow', 'skill', 'task', 'hook'];
    if (!validTypes.includes(opts.type)) {
      ui.error(`Invalid type: ${opts.type}. Must be one of: ${validTypes.join(', ')}`);
      process.exit(1);
    }

    const result = registry.create(name, opts.type as 'agent' | 'workflow' | 'skill' | 'task' | 'hook');
    result.success ? ui.success(result.message) : ui.error(result.message);
    process.exit(result.success ? 0 : 1);
  });

// ============================================================
// CONTEXT COMMANDS (Phase 4)
// ============================================================
const context = program.command('context').description('Context optimization');

context
  .command('build')
  .description('Pre-compile agent context caches')
  .action(async () => {
    const { ContextCache } = await import('../engine/context-cache.js');
    const cache = new ContextCache(KRATOS_ROOT);
    const s = ui.spinner('Building context caches...');
    const contexts = cache.buildAll();
    s.stop();
    ui.success(`Built context caches for ${contexts.length} agent(s).`);
    for (const ctx of contexts) {
      ui.keyValue(ctx.agent_id, `${ctx.estimated_tokens.toLocaleString()} tokens (${ctx.total_lines} lines)`);
    }
  });

context
  .command('stats')
  .description('Show context cache statistics and savings estimate')
  .action(async () => {
    const { ContextCache } = await import('../engine/context-cache.js');
    const cache = new ContextCache(KRATOS_ROOT);
    const stats = cache.getStats();
    ui.raw(cache.formatStats(stats));
  });

context
  .command('invalidate')
  .description('Clear all context caches')
  .action(async () => {
    const { ContextCache } = await import('../engine/context-cache.js');
    const cache = new ContextCache(KRATOS_ROOT);
    const count = cache.invalidate();
    ui.success(`Invalidated ${count} cache file(s).`);
  });

context
  .command('budget [agentId]')
  .description('Check if an agent context fits within the 40K token budget')
  .action(async (agentId?: string) => {
    const { ContextCache } = await import('../engine/context-cache.js');
    const cache = new ContextCache(KRATOS_ROOT);

    if (agentId) {
      const result = cache.checkBudget(agentId);
      ui.heading(`Budget Check — ${agentId}`);
      ui.keyValue('Tokens', result.tokens.toLocaleString());
      ui.keyValue('Budget', result.budget.toLocaleString());
      ui.statusRow(result.fits, 'Within budget');
      if (result.overage > 0) {
        ui.keyValue('Overage', `${result.overage.toLocaleString()} tokens`);
      }
    } else {
      const stats = cache.getStats();
      ui.heading('Context Budget');
      ui.keyValue('Budget max', `${stats.budget_max.toLocaleString()} tokens`);
      ui.keyValue('Max usage', `${stats.budget_used_pct.toFixed(1)}%`);
      ui.keyValue('Agents cached', stats.agents_cached);
    }
  });

context
  .command('skill-sections [skillName]')
  .description('List skill sections available for JIT loading')
  .action(async (skillName?: string) => {
    const { SkillIndex } = await import('../engine/skill-index.js');
    const skillsDir = path.join(KRATOS_ROOT, 'dev', 'skills');
    const cacheDir = path.join(KRATOS_ROOT, '.cache', 'skills');
    const idx = new SkillIndex(skillsDir, cacheDir);

    if (skillName) {
      const sections = idx.listSections(skillName);
      if (sections.length === 0) {
        ui.info(`No sections found for skill: ${skillName}`);
      } else {
        ui.heading(`Sections — ${skillName}`);
        for (const s of sections) {
          ui.keyValue(s.heading, `${s.line_count} lines`);
        }
      }
    } else {
      const index = idx.build();
      ui.raw(idx.formatIndex(index));
    }
  });

// ============================================================
// AGENT COMMANDS
// ============================================================
const agent = program.command('agent').description('Run Kratos agents interactively');

agent
  .command('list')
  .description('List all available Kratos agents')
  .action(async () => {
    await ui.init();
    try {
      const agents = listAgents(KRATOS_ROOT);
      ui.heading('Kratos Agents');
      ui.table(
        ['Name', 'Persona', 'Title', 'Module'],
        agents.map(a => [a.name, `${a.icon} ${a.displayName}`, a.title, a.module])
      );
      console.log('');
      ui.info(`Run ${ui.theme().accent('kratos agent run <name>')} to start a session.`);
      console.log('');
    } catch (err: unknown) {
      ui.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

agent
  .command('info <name>')
  .description('Show details for a specific agent')
  .action(async (name: string) => {
    await ui.init();
    const entry = findAgent(KRATOS_ROOT, name);
    if (!entry) {
      ui.error(`Unknown agent: "${name}"`);
      ui.info(`Run ${ui.theme().accent('kratos agent list')} to see all agents.`);
      process.exit(1);
    }
    const details = getAgentDetails(entry, PROJECT_ROOT);
    ui.heading(`${entry.icon}  ${entry.displayName}`);
    ui.keyValue('Name', entry.name);
    ui.keyValue('Title', entry.title);
    ui.keyValue('Module', entry.module);
    ui.keyValue('Path', entry.path);
    ui.keyValue('Extends', details.extends);
    if (details.capabilities !== '—') ui.keyValue('Capabilities', details.capabilities);
    if (details.mission !== '—') {
      ui.subheading('Mission');
      console.log(`    ${ui.theme().dim(details.mission)}`);
    }
    if (details.owns !== '—') {
      ui.subheading('Owns');
      console.log(`    ${ui.theme().dim(details.owns)}`);
    }
    console.log('');
    ui.info(`Start session: ${ui.theme().accent('kratos agent run ' + entry.name)}`);
    console.log('');
  });

agent
  .command('run <name>')
  .description('Start an interactive Claude session with an agent')
  .option('-m, --model <tier>', 'Model tier: fast | standard | deep', 'standard')
  .option('--no-stream', 'Disable streaming responses')
  .action(async (name: string, opts: { model: string; stream: boolean }) => {
    await ui.init();
    const tier = (['fast', 'standard', 'deep'].includes(opts.model)
      ? opts.model
      : 'standard') as 'fast' | 'standard' | 'deep';
    await startSession(name, KRATOS_ROOT, PROJECT_ROOT, {
      model: tier,
      stream: opts.stream,
    });
  });

// Shorthand: `kratos agent <name>` without explicit `run` subcommand
agent
  .argument('[name]')
  .option('-m, --model <tier>', 'Model tier: fast | standard | deep', 'standard')
  .option('--no-stream', 'Disable streaming responses')
  .action(async (name: string | undefined, opts: { model: string; stream: boolean }) => {
    if (!name) {
      agent.outputHelp();
      return;
    }
    await ui.init();
    const tier = (['fast', 'standard', 'deep'].includes(opts.model)
      ? opts.model
      : 'standard') as 'fast' | 'standard' | 'deep';
    await startSession(name, KRATOS_ROOT, PROJECT_ROOT, {
      model: tier,
      stream: opts.stream,
    });
  });

// ============================================================
// REPL — Command registry, smart suggestions, inline hints
// ============================================================

interface CmdEntry {
  cmd: string;
  desc: string;
  group: string;
  tags: string[];
}

const COMMAND_REGISTRY: CmdEntry[] = [
  // memory
  { cmd: 'memory search',          desc: 'Semantic search across agent memory',             group: 'memory',    tags: ['search','find','query'] },
  { cmd: 'memory stats',           desc: 'Memory entry counts by partition/agent',          group: 'memory',    tags: ['stats','count'] },
  { cmd: 'memory export',          desc: 'Export memory to markdown sidecars',              group: 'memory',    tags: ['export','backup'] },
  { cmd: 'memory migrate',         desc: 'Import markdown sidecars into database',          group: 'memory',    tags: ['import','migrate'] },
  { cmd: 'memory expire',          desc: 'Remove expired memory entries',                   group: 'memory',    tags: ['clean','prune','expire'] },
  // learn
  { cmd: 'learn distill',          desc: 'Extract patterns from scored trajectories',       group: 'learn',     tags: ['patterns','distill','train'] },
  { cmd: 'learn patterns',         desc: 'List learned patterns and anti-patterns',         group: 'learn',     tags: ['patterns','list'] },
  { cmd: 'learn protect',          desc: 'Run forgetting-shield protection cycle',          group: 'learn',     tags: ['protect','shield','forgetting'] },
  // sprint
  { cmd: 'sprint plan',            desc: 'Generate parallel execution plan',                group: 'sprint',    tags: ['plan','parallel','schedule'] },
  { cmd: 'sprint reviews',         desc: 'Run all 6 review gates in parallel',              group: 'sprint',    tags: ['review','gates','qa'] },
  // providers
  { cmd: 'providers list',                     desc: 'Show configured LLM providers',              group: 'providers', tags: ['list','llm','models'] },
  { cmd: 'providers test',                     desc: 'Send test prompt to a provider',              group: 'providers', tags: ['test','ping','check'] },
  { cmd: 'providers cost-estimate',            desc: 'Estimate sprint cost across providers',       group: 'providers', tags: ['cost','estimate','budget'] },
  { cmd: 'providers set-key <provider> <key>', desc: 'Save an API key for a provider',              group: 'providers', tags: ['key','api','auth','credentials','set'] },
  { cmd: 'providers remove-key <provider>',    desc: 'Remove a saved API key',                      group: 'providers', tags: ['key','remove','delete'] },
  { cmd: 'providers keys',                     desc: 'Show configured API keys (masked)',            group: 'providers', tags: ['key','list','show','auth'] },
  // cost
  { cmd: 'cost report',            desc: 'Show cost report by period',                      group: 'cost',      tags: ['report','spend','billing'] },
  { cmd: 'cost route',             desc: 'Preview model-routing decision for a workflow',   group: 'cost',      tags: ['route','routing','model'] },
  { cmd: 'cost savings',           desc: 'Show savings vs all-Opus baseline',               group: 'cost',      tags: ['savings','baseline','compare'] },
  // validate
  { cmd: 'validate artifact',      desc: 'Validate artifact claims against ground truth',   group: 'validate',  tags: ['validate','check','artifact'] },
  { cmd: 'validate refresh-ground-truth', desc: 'Rescan filesystem and update ground truth',group: 'validate',  tags: ['refresh','scan','filesystem'] },
  { cmd: 'validate ground-truth',  desc: 'Show cached ground-truth facts',                  group: 'validate',  tags: ['facts','ground-truth','cache'] },
  // root
  { cmd: 'status',                 desc: 'Current sprint status + agent health',            group: 'root',      tags: ['status','health','overview'] },
  { cmd: 'doctor',                 desc: 'Run system health check',                         group: 'root',      tags: ['health','check','diagnose','doctor'] },
  { cmd: 'dashboard',              desc: 'Launch web dashboard',                            group: 'root',      tags: ['dashboard','web','ui','browser'] },
  // hooks
  { cmd: 'hooks list',             desc: 'List all configured lifecycle hooks',              group: 'hooks',     tags: ['list','hooks'] },
  { cmd: 'hooks test',             desc: 'Test-fire a hook point with sample context',      group: 'hooks',     tags: ['test','fire','trigger'] },
  // metrics
  { cmd: 'metrics sprint',         desc: 'Sprint velocity, burndown, and health',           group: 'metrics',   tags: ['sprint','velocity','burndown'] },
  { cmd: 'metrics agents',         desc: 'Agent leaderboard with pass rates',               group: 'metrics',   tags: ['agents','leaderboard','passrate'] },
  { cmd: 'metrics quality',        desc: 'First-pass rate and quality score',               group: 'metrics',   tags: ['quality','score','firstpass'] },
  { cmd: 'metrics cost',           desc: 'Cost per story, tier distribution, forecast',     group: 'metrics',   tags: ['cost','forecast','tiers'] },
  { cmd: 'metrics export',         desc: 'Export all metrics as JSON',                      group: 'metrics',   tags: ['export','json','download'] },
  // codebase
  { cmd: 'codebase scan',          desc: 'Incremental codebase scan with checksums',        group: 'codebase',  tags: ['scan','index','checksums'] },
  { cmd: 'codebase drift',         desc: 'Detect architecture doc vs reality drift',        group: 'codebase',  tags: ['drift','architecture','gap'] },
  { cmd: 'codebase debt',          desc: 'Detect tech debt: complexity, size, test gaps',   group: 'codebase',  tags: ['debt','complexity','technical'] },
  { cmd: 'codebase hotspots',      desc: 'Files with most issues and changes',              group: 'codebase',  tags: ['hotspots','issues','files'] },
  { cmd: 'codebase ownership',     desc: 'File-to-story-to-agent ownership map',            group: 'codebase',  tags: ['ownership','map','traceability'] },
  { cmd: 'codebase stats',         desc: 'Codebase size and language breakdown',            group: 'codebase',  tags: ['stats','languages','size'] },
  // plugins
  { cmd: 'plugins list',           desc: 'List all discovered and registered plugins',      group: 'plugins',   tags: ['list'] },
  { cmd: 'plugins discover',       desc: 'Scan plugins directory for unregistered',         group: 'plugins',   tags: ['discover','scan','find'] },
  { cmd: 'plugins validate',       desc: 'Validate a plugin definition',                    group: 'plugins',   tags: ['validate','check'] },
  { cmd: 'plugins enable',         desc: 'Enable a registered plugin',                      group: 'plugins',   tags: ['enable','activate','on'] },
  { cmd: 'plugins disable',        desc: 'Disable a registered plugin',                     group: 'plugins',   tags: ['disable','deactivate','off'] },
  { cmd: 'plugins create',         desc: 'Create a new plugin scaffold',                    group: 'plugins',   tags: ['create','scaffold','new','generate'] },
  // context
  { cmd: 'context build',          desc: 'Pre-compile agent context caches',                group: 'context',   tags: ['build','compile','cache'] },
  { cmd: 'context stats',          desc: 'Context cache statistics and savings estimate',   group: 'context',   tags: ['stats','cache','tokens'] },
  { cmd: 'context invalidate',     desc: 'Clear all context caches',                        group: 'context',   tags: ['clear','reset','invalidate'] },
  { cmd: 'context budget',         desc: 'Check agent context fits 40K token budget',       group: 'context',   tags: ['budget','tokens','limit'] },
  { cmd: 'context skill-sections', desc: 'List skill sections for JIT loading',             group: 'context',   tags: ['skills','sections','jit'] },
  // agent
  { cmd: 'agent list',             desc: 'List all 17 available Kratos agents',             group: 'agent',     tags: ['list','agents','show'] },
  { cmd: 'agent info <name>',      desc: 'Show details for a specific agent',               group: 'agent',     tags: ['info','details','inspect'] },
  { cmd: 'agent run <name>',       desc: 'Start an interactive Claude session as an agent', group: 'agent',     tags: ['run','start','session','chat','interactive'] },
];

// Context-aware next-step suggestions keyed by resolved command
const NEXT_STEPS: Record<string, string[]> = {
  'doctor':                    ['status', 'providers list', 'memory stats'],
  'status':                    ['sprint plan', 'metrics sprint', 'codebase scan'],
  'memory stats':              ['memory search', 'learn distill', 'memory export'],
  'memory search':             ['learn patterns', 'memory stats'],
  'memory expire':             ['memory stats', 'learn distill'],
  'memory migrate':            ['memory stats', 'memory export'],
  'learn distill':             ['learn patterns', 'learn protect'],
  'learn patterns':            ['learn protect', 'memory stats'],
  'learn protect':             ['memory stats', 'learn distill'],
  'sprint plan':               ['sprint reviews', 'metrics sprint'],
  'sprint reviews':            ['metrics sprint', 'metrics quality'],
  'codebase scan':             ['codebase drift', 'codebase debt', 'codebase hotspots'],
  'codebase drift':            ['codebase debt', 'validate refresh-ground-truth'],
  'codebase debt':             ['codebase hotspots', 'codebase ownership'],
  'codebase hotspots':         ['codebase debt', 'codebase ownership'],
  'metrics sprint':            ['metrics agents', 'metrics quality', 'metrics cost'],
  'metrics agents':            ['metrics quality', 'learn patterns'],
  'metrics quality':           ['metrics sprint', 'metrics cost'],
  'providers list':            ['providers keys', 'providers test', 'providers cost-estimate'],
  'providers test':            ['providers list', 'providers set-key', 'cost report'],
  'providers keys':            ['providers set-key', 'providers list', 'providers test'],
  'providers set-key':         ['providers keys', 'providers test', 'providers list'],
  'validate artifact':         ['validate refresh-ground-truth', 'validate ground-truth'],
  'validate refresh-ground-truth': ['validate artifact', 'validate ground-truth'],
  'context build':             ['context stats', 'context budget'],
  'context stats':             ['context build', 'context budget'],
  'plugins list':              ['plugins discover', 'plugins validate'],
  'plugins create':            ['plugins list', 'plugins enable'],
};

// Groups that match a single keyword (for "memory" → list memory subcommands)
const COMMAND_GROUPS = ['memory','learn','sprint','providers','cost','validate',
                        'hooks','metrics','codebase','plugins','context','agent'];

// ── Levenshtein distance for fuzzy matching ──────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function fuzzyFind(input: string): CmdEntry[] {
  return COMMAND_REGISTRY
    .map(e => ({ entry: e, dist: levenshtein(input, e.cmd.split(' ')[0]) }))
    .filter(x => x.dist <= 3)
    .sort((a, b) => a.dist - b.dist)
    .map(x => x.entry)
    .slice(0, 4);
}

// ── Hint: dim text after cursor (fish-shell style) ───────────
let ghostActive = false;
const ESC = '\x1b';

function clearGhost(): void {
  ghostActive = false;
}

function paintGhost(rl: readline.Interface, currentLine: string): void {
  if (!process.stdout.isTTY) return;
  const lower = currentLine.toLowerCase();
  if (lower.length < 2) return;
  const hit = COMMAND_REGISTRY.find(e => e.cmd.startsWith(lower) && e.cmd !== lower);
  if (!hit) return;
  const ghost = hit.cmd.slice(currentLine.length);
  if (!ghost) return;
  // save cursor → dim ghost text → restore cursor
  process.stdout.write(`${ESC}7${ESC}[2m${ghost}${ESC}[0m${ESC}8`);
  ghostActive = true;
}

// ── Post-command "next steps" panel ─────────────────────────
function showNextSteps(cmd: string): void {
  const steps = NEXT_STEPS[cmd];
  if (!steps || steps.length === 0) return;
  const t = ui.theme?.() ?? null;
  if (!t) return;
  console.log('');
  console.log(`  ${t.dim('╌╌ suggested next ╌╌')}`);
  for (const s of steps.slice(0, 3)) {
    const entry = COMMAND_REGISTRY.find(e => e.cmd === s);
    const desc = entry ? `  ${t.dim('·')} ${t.dim(entry.desc)}` : '';
    console.log(`    ${t.accent(s)}${desc}`);
  }
}

// ── Show group subcommands ───────────────────────────────────
function showGroupHelp(group: string): void {
  const entries = COMMAND_REGISTRY.filter(e => e.group === group);
  if (entries.length === 0) return;
  const t = ui.theme?.() ?? null;
  if (!t) return;
  console.log('');
  console.log(`  ${t.heading(` ${group} commands `)}`);
  for (const e of entries) {
    const padded = e.cmd.padEnd(34);
    console.log(`    ${t.accent(padded)}${t.dim(e.desc)}`);
  }
  console.log('');
}

// ── REPL entrypoint ──────────────────────────────────────────
async function startRepl(isRestart = false): Promise<void> {
  await ui.init();
  if (!isRestart) await showSplash();

  // Remove any stale keypress listeners from a previous REPL or agent session
  // to prevent duplicate echo (each listener would re-echo every keystroke).
  process.stdin.removeAllListeners('keypress');

  const completer = (line: string): [string[], string] => {
    const lower = line.toLowerCase().trim();
    if (!lower) {
      const groups = COMMAND_GROUPS;
      const roots = COMMAND_REGISTRY.filter(e => e.group === 'root').map(e => e.cmd);
      return [[...groups, ...roots], line];
    }
    const hits = COMMAND_REGISTRY.filter(e => e.cmd.startsWith(lower));
    if (hits.length > 0) return [hits.map(e => e.cmd), line];
    const tagHits = COMMAND_REGISTRY.filter(e =>
      e.tags.some(t => t.startsWith(lower)) || e.desc.toLowerCase().includes(lower)
    );
    return [tagHits.map(e => e.cmd), line];
  };

  const rl: readline.Interface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\nkratos> ',
    completer,
  });

  // Set up keypress-based inline ghost text
  if (process.stdout.isTTY) {
    readline.emitKeypressEvents(process.stdin, rl);

    process.stdin.on('keypress', (_ch: string | undefined, key: readline.Key | undefined) => {
      // Clear existing ghost on any destructive key
      if (key?.name === 'backspace' || key?.name === 'delete' ||
          key?.name === 'return'    || key?.name === 'enter'  ||
          key?.ctrl) {
        clearGhost();
        return;
      }
      // After readline redraws, paint suggestion
      setImmediate(() => {
        const currentLine = (rl as unknown as { line: string }).line ?? '';
        paintGhost(rl, currentLine);
      });
    });
  }

  const t = ui.theme();
  console.log(`  ${t.dim('Tab')} complete  ${t.dim('↑↓')} history  ${t.dim('"?"')} categories  ${t.dim('Ctrl+D')} exit\n`);
  rl.prompt();

  rl.on('line', (line: string) => {
    clearGhost();
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // ── built-in builtins ──
    if (input === 'exit' || input === 'quit') {
      console.log('\n  Goodbye!\n');
      rl.close();
      process.exit(0);
    }

    if (input === 'clear' || input === 'cls') {
      console.clear();
      rl.prompt();
      return;
    }

    if (input === 'help') {
      program.outputHelp();
      rl.prompt();
      return;
    }

    if (input === '?' || input === 'commands') {
      for (const grp of COMMAND_GROUPS) {
        showGroupHelp(grp);
      }
      rl.prompt();
      return;
    }

    // ── group name alone → show group subcommands ──
    if (COMMAND_GROUPS.includes(input)) {
      showGroupHelp(input);
      rl.prompt();
      return;
    }

    // ── unknown command? fuzzy "did you mean?" ──
    const knownCmd = COMMAND_REGISTRY.some(e => {
      const normalized = e.cmd.replace(/ <[^>]+>/g, '').replace(/ \[[^\]]+\]/g, '');
      return input === normalized || input.startsWith(normalized + ' ');
    });

    if (!knownCmd) {
      const suggestions = fuzzyFind(input);
      if (suggestions.length > 0) {
        const th = ui.theme();
        console.log(`\n  ${th.warn('Unknown command.')} Did you mean:`);
        for (const s of suggestions) {
          console.log(`    ${th.accent(s.cmd)}  ${th.dim(s.desc)}`);
        }
        console.log('');
      } else {
        const th = ui.theme();
        console.log(`\n  ${th.warn(`Unknown command: "${input}".`)} Type ${th.accent('"?"')} to list all commands.\n`);
      }
      rl.prompt();
      return;
    }

    // ── agent run <name> — run inline to avoid dual-readline rendering artifacts ──
    const args = input.split(/\s+/);
    if (args[0] === 'agent' && args[1] === 'run' && args[2]) {
      const agentName = args[2];
      const modelTier = (args[3] as 'fast' | 'standard' | 'deep') || undefined;
      // Close this REPL's readline so it doesn't conflict with the agent session
      rl.removeAllListeners('close');
      rl.removeAllListeners('SIGINT');
      rl.close();
      (async () => {
        await startSession(agentName, KRATOS_ROOT, PROJECT_ROOT, { model: modelTier }).catch(() => {});
        // Session ended normally — restart the REPL (skip splash, clean up listeners)
        await startRepl(true);
      })();
      return;
    }

    // ── run as subprocess so Commander state stays clean ──
    const scriptPath = process.argv[1];
    rl.pause();

    const child = spawn(process.execPath, [scriptPath, ...args], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('close', () => {
      // Resolve the matched command (strip arguments) for next-step suggestions
      const resolvedCmd = COMMAND_REGISTRY.find(e => {
        const base = e.cmd.replace(/ <[^>]+>/g,'').replace(/ \[[^\]]+\]/g,'');
        return input === base || input.startsWith(base + ' ');
      })?.cmd.replace(/ <[^>]+>/g,'').replace(/ \[[^\]]+\]/g,'');
      if (resolvedCmd) showNextSteps(resolvedCmd);
      rl.resume();
      rl.prompt();
    });

    child.on('error', (err: Error) => {
      const th = ui.theme();
      console.error(`\n  ${th.fail ? th.fail('Error: ') : 'Error: '}${err.message}\n`);
      rl.resume();
      rl.prompt();
    });
  });

  // Ctrl+C — keep running, remind user
  rl.on('SIGINT', () => {
    clearGhost();
    const th = ui.theme();
    console.log(`\n  ${th.dim('(Ctrl+D or "exit" to quit)')}`);
    rl.prompt();
  });

  // Ctrl+D / stream close
  rl.on('close', () => {
    console.log('');
    process.exit(0);
  });
}

if (process.argv.length > 2) {
  // Arguments supplied — one-shot command, exit when done (original behaviour)
  ui.init().then(() => program.parseAsync(process.argv));
} else {
  // No arguments — enter interactive REPL
  startRepl();
}
