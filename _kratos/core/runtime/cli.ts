#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';

const program = new Command();

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
  .version('2.1.0');

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
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const results = await mm.search(query, {
      agent_id: opts.agent,
      partition: opts.partition,
      limit: parseInt(opts.limit),
    });

    if (results.length === 0) {
      console.log('No results found.');
    } else {
      for (const entry of results) {
        console.log(`[${entry.partition}] ${entry.title} (score: ${entry.score}, agent: ${entry.agent_id})`);
        console.log(`  ${entry.content.split('\n')[0].substring(0, 120)}`);
        console.log('');
      }
    }

    await mm.close();
  });

memory
  .command('stats')
  .description('Show memory statistics')
  .action(async () => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();
    const stats = await mm.getStats();

    console.log('Memory Statistics:');
    console.log(`  Total entries: ${stats.total_entries}`);
    console.log(`  Stale: ${stats.stale_count}`);
    console.log(`  Expired: ${stats.expired_count}`);
    console.log('\nBy partition:');
    for (const [p, count] of Object.entries(stats.by_partition)) {
      console.log(`  ${p}: ${count}`);
    }
    console.log('\nBy agent:');
    for (const [a, count] of Object.entries(stats.by_agent)) {
      console.log(`  ${a}: ${count}`);
    }

    await mm.close();
  });

memory
  .command('export')
  .description('Export memory to markdown sidecars')
  .option('-a, --agent <id>', 'Export specific agent only')
  .option('-o, --output <dir>', 'Output directory', path.join(KRATOS_ROOT, '_memory'))
  .action(async (opts: { agent?: string; output: string }) => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    if (opts.agent) {
      const md = await mm.exportAgentSidecar(opts.agent);
      console.log(md);
    } else {
      await mm.exportAllSidecars(opts.output);
      console.log(`Sidecars exported to ${opts.output}`);
    }

    await mm.close();
  });

memory
  .command('migrate')
  .description('Import existing markdown sidecars into database')
  .action(async () => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager');
    const { SidecarMigration } = await import('../../intelligence/memory/migration');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const migration = new SidecarMigration(mm, path.join(KRATOS_ROOT, '_memory'));
    const result = await migration.migrate();

    console.log(`Migration complete:`);
    console.log(`  Agents migrated: ${result.agents_migrated}`);
    console.log(`  Entries imported: ${result.entries_imported}`);
    if (result.errors.length > 0) {
      console.log(`  Errors: ${result.errors.length}`);
      for (const err of result.errors) {
        console.error(`    ${err}`);
      }
    }

    await mm.close();
  });

memory
  .command('expire')
  .description('Remove expired entries')
  .action(async () => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();
    const count = await mm.expireStaleEntries();
    console.log(`Expired ${count} entries.`);
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
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager');
    const { PatternDistiller } = await import('../../intelligence/learning/pattern-distiller');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const distiller = new PatternDistiller(mm);
    const result = await distiller.runDistillationCycle();

    console.log('Distillation complete:');
    console.log(`  Patterns created: ${result.patterns_created}`);
    console.log(`  Anti-patterns created: ${result.anti_patterns_created}`);
    console.log(`  Trajectories analyzed: ${result.trajectories_analyzed}`);

    await mm.close();
  });

learn
  .command('patterns')
  .description('List learned patterns')
  .option('-a, --agent <id>', 'Filter by agent')
  .option('--anti', 'Show anti-patterns instead')
  .action(async (opts: { agent?: string; anti?: boolean }) => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager');
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
      console.log(`No ${partition} found.`);
    } else {
      for (const entry of entries) {
        console.log(`[${entry.score.toFixed(2)}] ${entry.title} (agent: ${entry.agent_id})`);
        console.log(`  ${entry.content.split('\n')[0].substring(0, 120)}`);
        console.log('');
      }
    }

    await mm.close();
  });

learn
  .command('protect')
  .description('Run forgetting shield protection cycle')
  .action(async () => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager');
    const { ForgettingShield } = await import('../../intelligence/learning/forgetting-shield');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();

    const shield = new ForgettingShield(mm);
    const result = await shield.runProtectionCycle();

    console.log('Protection cycle complete:');
    console.log(`  Newly protected: ${result.newly_protected}`);
    console.log(`  Unprotected: ${result.unprotected}`);
    console.log(`  Total protected: ${result.total_protected}`);

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
    const { DependencyGraph } = await import('./dependency-graph');
    const statusPath = opts.status || path.join(PROJECT_ROOT, 'docs', 'implementation-artifacts', 'sprint-status.yaml');

    if (!fs.existsSync(statusPath)) {
      console.error(`Sprint status file not found: ${statusPath}`);
      process.exit(1);
    }

    const graph = new DependencyGraph();
    await graph.buildFromSprint(statusPath);
    console.log(graph.toText());
  });

sprint
  .command('reviews <story_key>')
  .description('Run all 6 review gates in parallel for a story')
  .action(async (storyKey: string) => {
    const { ParallelExecutor } = await import('./parallel-executor');
    const executor = new ParallelExecutor({
      max_concurrent: 6,
      mode: 'parallel',
      conflict_detection: false,
      heartbeat_interval_sec: 60,
      stall_timeout_sec: 300,
      execution_mode: 'normal',
    });

    console.log(`Running all 6 reviews for ${storyKey}...`);
    const result = await executor.executeReviewsParallel(storyKey);

    for (const [review, status] of Object.entries(result.results)) {
      console.log(`  ${status === 'PASSED' ? 'PASS' : 'FAIL'} ${review}`);
    }
    console.log(`\nAll passed: ${result.all_passed} (${result.duration_sec.toFixed(1)}s)`);
  });

// ============================================================
// STATUS COMMAND
// ============================================================
program
  .command('status')
  .description('Show current sprint status + agent health')
  .action(async () => {
    const { MemoryManager } = await import('../../intelligence/memory/memory-manager');
    const mm = new MemoryManager(MEMORY_DB_PATH);
    await mm.init();
    const stats = await mm.getStats();

    console.log('Kratos Status:');
    console.log(`  Memory entries: ${stats.total_entries}`);
    console.log(`  Stale entries: ${stats.stale_count}`);

    const statusPath = path.join(PROJECT_ROOT, 'docs', 'implementation-artifacts', 'sprint-status.yaml');
    if (fs.existsSync(statusPath)) {
      console.log(`  Sprint status: ${statusPath}`);
    } else {
      console.log('  Sprint status: No active sprint');
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

    console.log('Kratos Health Check:\n');
    let allPassed = true;
    for (const check of checks) {
      const icon = check.passed ? 'PASS' : 'FAIL';
      console.log(`  [${icon}] ${check.name} — ${check.detail}`);
      if (!check.passed) allPassed = false;
    }
    console.log(`\n${allPassed ? 'All checks passed.' : 'Some checks failed.'}`);
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
      console.error('Dashboard directory not found.');
      process.exit(1);
    }
    console.log(`Launching dashboard on port ${opts.port}...`);
    const child = spawn('npm', ['start'], {
      cwd: dashboardDir,
      stdio: 'inherit',
      env: { ...process.env, PORT: opts.port },
    });
    child.on('error', (err: Error) => console.error('Failed to start dashboard:', err.message));
  });

// ============================================================
// HOOKS COMMANDS
// ============================================================
const hooks = program.command('hooks').description('Manage lifecycle hooks');

hooks
  .command('list')
  .description('List all configured hooks')
  .action(async () => {
    const { HookExecutor } = await import('./hook-executor');
    const hooksConfigPath = path.join(KRATOS_ROOT, '_config', 'hooks.yaml');
    const executor = new HookExecutor(hooksConfigPath);
    await executor.loadConfig();
    const allHooks = executor.listHooks();

    for (const [point, defs] of Object.entries(allHooks)) {
      const count = defs.length;
      console.log(`${point}: ${count === 0 ? '(none)' : `${count} hook(s)`}`);
      for (const def of defs) {
        console.log(`  → ${def.command} [on_fail: ${def.on_fail}]`);
      }
    }
  });

hooks
  .command('test <hookPoint>')
  .description('Test-fire a hook point with sample context')
  .action(async (hookPoint: string) => {
    const { HookExecutor } = await import('./hook-executor');
    const hooksConfigPath = path.join(KRATOS_ROOT, '_config', 'hooks.yaml');
    const executor = new HookExecutor(hooksConfigPath);
    await executor.loadConfig();

    console.log(`Testing hook point: ${hookPoint}`);
    const results = await executor.execute(hookPoint, {
      workflow_name: 'test',
      step_number: 1,
      story_key: 'TEST-001',
    });

    if (results.length === 0) {
      console.log('No hooks configured for this point.');
    } else {
      for (const r of results) {
        console.log(`  [${r.exit_code === 0 ? 'OK' : 'ERR'}] ${r.command} (${r.duration_ms}ms) → ${r.action_taken}`);
      }
    }
  });

program.parse();
