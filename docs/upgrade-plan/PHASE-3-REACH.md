# Phase 3: Reach — The Range

**Version target:** 2.2.0 "Hermes"
**Depends on:** Phase 1 (memory DB), Phase 2 (CLI, hooks)
**Upgrades:** 7 (Multi-Provider LLM), 8 (Cost Router), 9 (Validator Agent)

---

## Pre-Phase Checklist

Before starting, verify:

- [ ] Phase 1 + 2 completed (checkpoints exist)
- [ ] `_kratos/intelligence/` fully functional (memory, learning, collective)
- [ ] `_kratos/core/runtime/` fully functional (CLI, parallel executor, hooks)
- [ ] `npx kratos doctor` passes
- [ ] TypeScript compiles cleanly (`npm run build`)

---

## Upgrade 7: Multi-Provider LLM Support

### Context

**Current state:** Kratos is hardcoded to Claude Code. Every agent, every workflow, every task runs on Anthropic models only. There's no fallback if Claude is down, no way to use cheaper models for simple tasks, and no support for air-gapped environments with local models.

**What we're building:** A provider abstraction layer that supports multiple LLM providers (Anthropic, OpenAI, Google, Ollama) with automatic failover. The existing workflow engine continues to work unchanged — the provider layer sits between the CLI/runtime and the LLM API calls.

**Important constraint:** Claude Code slash commands still use Claude. The multi-provider layer is used by the TypeScript runtime (CLI commands, parallel executor, learning system) for tasks that don't require Claude Code's tool-use capabilities.

### Architecture

```
_kratos/providers/
├── provider-registry.ts      # Central registry of all providers
├── provider-interface.ts      # Common interface all providers implement
├── adapters/
│   ├── anthropic.ts           # Claude adapter (primary)
│   ├── openai.ts              # GPT adapter
│   ├── google.ts              # Gemini adapter
│   └── ollama.ts              # Local model adapter
└── index.ts                   # Public API exports

_kratos/_config/
└── providers.yaml             # Provider configuration
```

### Step 7.1: Create the provider configuration

**File:** `_kratos/_config/providers.yaml`

```yaml
# Kratos Multi-Provider LLM Configuration
# Defines available LLM providers, models, and routing rules.

providers:
  anthropic:
    enabled: true
    api_key_env: "ANTHROPIC_API_KEY"     # Environment variable name
    models:
      opus:
        id: "claude-opus-4-6"
        tier: "deep-reasoning"
        cost_per_1k_input: 0.015
        cost_per_1k_output: 0.075
        max_tokens: 32000
      sonnet:
        id: "claude-sonnet-4-6"
        tier: "standard"
        cost_per_1k_input: 0.003
        cost_per_1k_output: 0.015
        max_tokens: 16000
      haiku:
        id: "claude-haiku-4-5"
        tier: "fast"
        cost_per_1k_input: 0.0008
        cost_per_1k_output: 0.004
        max_tokens: 8000

  openai:
    enabled: false
    api_key_env: "OPENAI_API_KEY"
    models:
      gpt4o:
        id: "gpt-4o"
        tier: "standard"
        cost_per_1k_input: 0.005
        cost_per_1k_output: 0.015
        max_tokens: 16000
      gpt4o-mini:
        id: "gpt-4o-mini"
        tier: "fast"
        cost_per_1k_input: 0.00015
        cost_per_1k_output: 0.0006
        max_tokens: 8000

  google:
    enabled: false
    api_key_env: "GOOGLE_API_KEY"
    models:
      gemini-pro:
        id: "gemini-2.0-pro"
        tier: "standard"
        cost_per_1k_input: 0.00125
        cost_per_1k_output: 0.005
        max_tokens: 16000
      gemini-flash:
        id: "gemini-2.0-flash"
        tier: "fast"
        cost_per_1k_input: 0.0001
        cost_per_1k_output: 0.0004
        max_tokens: 8000

  ollama:
    enabled: false
    base_url: "http://localhost:11434"
    models:
      llama3:
        id: "llama3.1"
        tier: "fast"
        cost_per_1k_input: 0.0             # Free (local)
        cost_per_1k_output: 0.0
        max_tokens: 8000
      codellama:
        id: "codellama"
        tier: "standard"
        cost_per_1k_input: 0.0
        cost_per_1k_output: 0.0
        max_tokens: 8000

# Default provider and failover order
defaults:
  primary_provider: "anthropic"
  failover_order: ["anthropic", "openai", "google", "ollama"]
  failover_enabled: true
  retry_attempts: 2
  retry_delay_ms: 1000

# Tier assignments (which model tier to use for each task category)
tier_assignments:
  deep-reasoning:                # Architecture, security analysis, complex refactoring
    provider: "anthropic"
    model: "opus"
  standard:                      # Code generation, reviews, test generation
    provider: "anthropic"
    model: "sonnet"
  fast:                          # Status updates, classification, simple transforms
    provider: "anthropic"
    model: "haiku"
  local:                         # Offline or air-gapped environments
    provider: "ollama"
    model: "llama3"
```

### Step 7.2: Define the provider interface

**File:** `_kratos/providers/provider-interface.ts`

```typescript
interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  cost_usd: number;              // Calculated from token counts and pricing
  latency_ms: number;
  finish_reason: string;
}

interface LLMProvider {
  name: string;
  enabled: boolean;

  // Initialize the provider (check API key, connectivity)
  init(): Promise<boolean>;

  // Send a completion request
  complete(messages: LLMMessage[], opts?: {
    max_tokens?: number;
    temperature?: number;
    system_prompt?: string;
  }): Promise<LLMResponse>;

  // Check if provider is available (API key set, service reachable)
  isAvailable(): Promise<boolean>;

  // Get cost estimate for a message
  estimateCost(inputTokens: number, outputTokens: number): number;
}
```

### Step 7.3: Implement the Anthropic adapter

**File:** `_kratos/providers/adapters/anthropic.ts`

```typescript
// Uses the Anthropic SDK (@anthropic-ai/sdk)
// This is the primary provider — Claude models

class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  enabled: boolean;
  private client: any;           // Anthropic SDK client
  private modelConfig: any;

  constructor(config: any)       // From providers.yaml anthropic section

  async init(): Promise<boolean>
  // 1. Check ANTHROPIC_API_KEY environment variable
  // 2. Initialize Anthropic client
  // 3. Return true if successful

  async complete(messages: LLMMessage[], opts?: any): Promise<LLMResponse>
  // 1. Map messages to Anthropic format
  // 2. Call client.messages.create()
  // 3. Calculate cost from token counts
  // 4. Return standardized LLMResponse

  async isAvailable(): Promise<boolean>
  // Check API key exists and is non-empty

  estimateCost(inputTokens: number, outputTokens: number): number
  // Use cost_per_1k_input and cost_per_1k_output from config
}
```

### Step 7.4: Implement the OpenAI adapter

**File:** `_kratos/providers/adapters/openai.ts`

```typescript
// Uses the OpenAI SDK (openai)
class OpenAIProvider implements LLMProvider {
  name = 'openai';
  // Same interface as Anthropic adapter
  // Maps messages to OpenAI chat.completions format
  // Handles response format differences
}
```

### Step 7.5: Implement the Google adapter

**File:** `_kratos/providers/adapters/google.ts`

```typescript
// Uses the Google Generative AI SDK (@google/generative-ai)
class GoogleProvider implements LLMProvider {
  name = 'google';
  // Same interface
  // Maps messages to Gemini format
}
```

### Step 7.6: Implement the Ollama adapter

**File:** `_kratos/providers/adapters/ollama.ts`

```typescript
// Uses HTTP API to local Ollama server (no SDK needed)
class OllamaProvider implements LLMProvider {
  name = 'ollama';
  private baseUrl: string;

  constructor(config: any)

  async init(): Promise<boolean>
  // 1. Check if Ollama is running: fetch(`${baseUrl}/api/tags`)
  // 2. Return true if response OK

  async complete(messages: LLMMessage[], opts?: any): Promise<LLMResponse>
  // POST to `${baseUrl}/api/chat` with model and messages
  // Parse streaming response or use non-streaming endpoint

  async isAvailable(): Promise<boolean>
  // Ping Ollama server

  estimateCost(): number { return 0; }  // Always free
}
```

### Step 7.7: Implement the Provider Registry

**File:** `_kratos/providers/provider-registry.ts`

```typescript
class ProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();
  private config: any;           // From providers.yaml

  constructor(configPath: string)

  // Initialize all enabled providers
  async init(): Promise<void>
  // 1. Read providers.yaml
  // 2. For each enabled provider: create adapter, call init()
  // 3. Log which providers are available

  // Get a specific provider
  getProvider(name: string): LLMProvider | undefined

  // Get the best available provider for a tier
  async getProviderForTier(tier: string): Promise<{
    provider: LLMProvider;
    model: string;
  }>
  // 1. Look up tier in tier_assignments
  // 2. Check if assigned provider is available
  // 3. If not: walk failover_order until one is available
  // 4. Return provider + model ID

  // Send a completion with automatic failover
  async complete(tier: string, messages: LLMMessage[], opts?: any): Promise<LLMResponse>
  // 1. Get provider for tier
  // 2. Try completion
  // 3. If fails and failover_enabled: try next provider in failover_order
  // 4. Retry up to retry_attempts with retry_delay_ms
  // 5. If all fail: throw error

  // Get cost estimate for a tier
  estimateCost(tier: string, inputTokens: number, outputTokens: number): number

  // List all available providers and their models
  listProviders(): {
    name: string;
    enabled: boolean;
    available: boolean;
    models: string[];
  }[]
}
```

### Step 7.8: Add CLI commands

Add to `cli.ts`:

```typescript
const providers = program.command('providers').description('LLM provider management');

providers
  .command('list')
  .description('List all configured providers and availability')
  .action(async () => {
    // Initialize ProviderRegistry, call listProviders(), display table
  });

providers
  .command('test <provider>')
  .description('Test a provider with a sample prompt')
  .action(async (provider) => {
    // Send "Hello, respond with your model name" to the provider
    // Display response, latency, cost
  });

providers
  .command('cost-estimate')
  .description('Estimate cost for current sprint')
  .action(async () => {
    // Count stories by complexity tier
    // Estimate tokens per tier
    // Calculate total cost
  });
```

### Verification — Upgrade 7

- [ ] `providers.yaml` exists with all 4 providers configured
- [ ] Anthropic adapter initializes and completes a request
- [ ] Failover works when primary provider is unavailable
- [ ] `npx kratos providers list` shows all providers
- [ ] `npx kratos providers test anthropic` sends test prompt
- [ ] Cost estimation returns accurate numbers
- [ ] Ollama adapter handles local model connection (when running)

### Files Created — Upgrade 7

| File | Action |
|------|--------|
| `_kratos/_config/providers.yaml` | Created |
| `_kratos/providers/provider-interface.ts` | Created |
| `_kratos/providers/provider-registry.ts` | Created |
| `_kratos/providers/adapters/anthropic.ts` | Created |
| `_kratos/providers/adapters/openai.ts` | Created |
| `_kratos/providers/adapters/google.ts` | Created |
| `_kratos/providers/adapters/ollama.ts` | Created |
| `_kratos/providers/index.ts` | Created |
| `_kratos/core/runtime/cli.ts` | Modified (added providers commands) |
| `_kratos/_config/global.yaml` | Modified (added providers section) |

---

## Upgrade 8: Intelligent Cost Router

### Context

**Current state:** Kratos statically assigns Opus (27 commands) or Sonnet (77 commands) in the workflow manifest. A simple sprint status update consumes the same model tier as a complex architecture review. No way to route based on actual task complexity.

**What we're building:** A cost intelligence router that scores task complexity (0-100), assigns the optimal model tier, tracks spending, and learns from outcomes which tier was sufficient for each task type.

**Depends on:** Upgrade 7 (provider registry), Upgrade 1 (memory DB for learning)

### Architecture

```
_kratos/providers/
├── cost-router.ts            # Complexity scoring + tier assignment
├── budget-tracker.ts         # Spending tracking + alerts
└── ... (other provider files)
```

### Step 8.1: Implement the Cost Router

**File:** `_kratos/providers/cost-router.ts`

```typescript
interface TaskProfile {
  workflow: string;
  story_key?: string;
  description?: string;
  files_affected?: number;
  dependency_depth?: number;
  keywords?: string[];           // From task description
  historical_complexity?: number; // From past trajectories
}

interface RoutingDecision {
  tier: 'deep-reasoning' | 'standard' | 'fast' | 'local' | 'no-llm';
  complexity_score: number;      // 0-100
  reasoning: string;             // Why this tier was chosen
  estimated_cost_usd: number;
  provider: string;
  model: string;
}

class CostRouter {
  constructor(
    private registry: ProviderRegistry,
    private db: MemoryManager
  )

  // Score task complexity and route to optimal tier
  async route(task: TaskProfile): Promise<RoutingDecision>
  // Algorithm:
  //
  // 1. BASE SCORE from workflow type (static mapping):
  //    Tier 0 (score 0-10): sprint-status, epic-status, changelog
  //    Tier 1 (score 11-30): validate-story, fix-story, quick-spec
  //    Tier 2 (score 31-70): dev-story, code-review, qa-tests, quick-dev
  //    Tier 3 (score 71-100): create-arch, threat-model, create-prd, adversarial
  //
  // 2. MODIFIERS (adjust base score):
  //    +10 if files_affected > 10
  //    +10 if dependency_depth > 3
  //    +15 if keywords contain: "security", "architecture", "migration", "refactor"
  //    -10 if keywords contain: "status", "update", "format", "fix typo"
  //    +/- from historical_complexity (learned from past trajectories)
  //
  // 3. TIER ASSIGNMENT:
  //    Score 0-10   → 'no-llm' (template-only, no API call needed)
  //    Score 11-30  → 'fast' (Haiku / GPT-4o-mini / Gemini Flash)
  //    Score 31-70  → 'standard' (Sonnet / GPT-4o / Gemini Pro)
  //    Score 71-100 → 'deep-reasoning' (Opus)
  //
  // 4. OVERRIDE: workflow manifest can force a tier
  //
  // 5. LEARNING: query memory DB for past routing decisions and outcomes
  //    If a workflow was previously routed to Tier 2 and consistently scored 0.9+,
  //    it can be downgraded to Tier 1 (cheaper model was sufficient)

  // Static workflow → base score mapping
  private static WORKFLOW_BASE_SCORES: Record<string, number> = {
    // Tier 0: No LLM needed
    'sprint-status': 5,
    'epic-status': 5,
    'changelog': 8,

    // Tier 1: Fast
    'validate-story': 15,
    'fix-story': 20,
    'validate-prd': 20,
    'quick-spec': 25,
    'build-configs': 5,

    // Tier 2: Standard
    'dev-story': 50,
    'code-review': 55,
    'qa-tests': 45,
    'security-review': 60,
    'test-automate': 45,
    'test-review': 40,
    'performance-review': 55,
    'quick-dev': 40,
    'create-story': 35,
    'sprint-plan': 35,

    // Tier 3: Deep reasoning
    'create-arch': 85,
    'create-prd': 80,
    'create-ux': 75,
    'threat-model': 90,
    'create-epics': 75,
    'readiness-check': 80,
    'infra-design': 80,
    'adversarial': 95,
    'edge-cases': 85,
    'brownfield': 80,
    'design-thinking': 70,
    'innovation': 75,
  };

  // Learn from routing outcomes
  async recordRoutingOutcome(decision: RoutingDecision, reviewScore: number): Promise<void>
  // Store in trajectories table:
  //   state_context: { workflow, complexity_score, tier }
  //   action_taken: { provider, model, estimated_cost }
  //   outcome: { review_score, actual_cost }
  // This feeds back into the learning loop (Upgrade 2)

  // Get cost savings report
  async getSavingsReport(): Promise<{
    total_tasks_routed: number;
    cost_if_all_opus: number;
    actual_cost: number;
    savings_usd: number;
    savings_pct: number;
    tier_distribution: Record<string, number>;
  }>
}
```

### Step 8.2: Implement the Budget Tracker

**File:** `_kratos/providers/budget-tracker.ts`

```typescript
class BudgetTracker {
  constructor(private db: MemoryManager)

  // Record a spend event
  async recordSpend(event: {
    provider: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    workflow: string;
    story_key?: string;
    agent_id?: string;
  }): Promise<void>
  // Stores in metrics table (from Phase 1 schema)

  // Get current daily spend
  async getDailySpend(): Promise<number>

  // Get spend by period
  async getSpend(opts: {
    period: 'today' | 'week' | 'month' | 'sprint';
    group_by?: 'provider' | 'model' | 'workflow' | 'agent' | 'story';
  }): Promise<{
    total_usd: number;
    breakdown: Record<string, number>;
  }>

  // Check if budget alert threshold is reached
  async checkBudget(dailyLimitUsd: number, alertThreshold: number): Promise<{
    within_budget: boolean;
    current_spend: number;
    limit: number;
    pct_used: number;
    alert: boolean;
  }>

  // Get cost per story
  async getCostPerStory(): Promise<Record<string, number>>

  // Get cost per agent
  async getCostPerAgent(): Promise<Record<string, number>>

  // Format budget report
  async formatReport(): Promise<string>
  // Output:
  //   ## Cost Report
  //   - Today: $12.34 / $50.00 (24.7%)
  //   - This sprint: $89.12
  //   - Avg cost per story: $4.23
  //
  //   ### By Model Tier
  //   - Opus: $45.00 (50.5%)
  //   - Sonnet: $35.12 (39.4%)
  //   - Haiku: $9.00 (10.1%)
  //
  //   ### Savings vs. All-Opus
  //   - Saved: $67.88 (43.2%)
}
```

### Step 8.3: Add CLI commands

Add to `cli.ts`:

```typescript
const cost = program.command('cost').description('Cost tracking and routing');

cost
  .command('report')
  .description('Show cost report')
  .option('-p, --period <p>', 'Period: today | week | month | sprint', 'sprint')
  .action(async (opts) => {
    // Display formatted cost report
  });

cost
  .command('route <workflow>')
  .description('Preview routing decision for a workflow')
  .action(async (workflow) => {
    // Create TaskProfile from workflow name
    // Run CostRouter.route()
    // Display: tier, score, estimated cost, reasoning
  });

cost
  .command('savings')
  .description('Show cost savings from intelligent routing')
  .action(async () => {
    // Display savings report
  });
```

### Step 8.4: Update global.yaml

```yaml
providers:
  config_path: "{config_path}/providers.yaml"
  default: "anthropic"
  cost_routing:
    enabled: true
    daily_budget_usd: 50.00
    alert_threshold: 0.8
    learning_enabled: true
```

### Verification — Upgrade 8

- [ ] Cost router scores workflows correctly (architecture = high, status = low)
- [ ] Tier assignment matches complexity score ranges
- [ ] Modifiers adjust base score (keywords, file count, etc.)
- [ ] Budget tracker records spend events
- [ ] Daily spend check works
- [ ] Budget alert fires at threshold
- [ ] `npx kratos cost report` shows formatted report
- [ ] `npx kratos cost route create-arch` shows Tier 3 / Opus
- [ ] `npx kratos cost route sprint-status` shows Tier 0 / no-llm
- [ ] `npx kratos cost savings` shows savings percentage

### Files Created — Upgrade 8

| File | Action |
|------|--------|
| `_kratos/providers/cost-router.ts` | Created |
| `_kratos/providers/budget-tracker.ts` | Created |
| `_kratos/core/runtime/cli.ts` | Modified (added cost commands) |
| `_kratos/_config/global.yaml` | Modified (added cost_routing section) |

---

## Upgrade 9: Validator Agent (Val)

### Context

**Current state:** Kratos has no automated artifact verification. When an agent generates a PRD, architecture doc, or story file, the only validation is human review at template-output checkpoints. Factual errors (wrong file paths, non-existent dependencies, mismatched requirement IDs) can slip through.

**What we're building:** A Validator agent (Val) that verifies factual claims in generated artifacts against filesystem reality and a ground-truth cache. Val can run at template-output checkpoints, post-story, and on-demand.

**Inspired by:** Gaia's Val agent with ground-truth verification.

### Architecture

```
_kratos/lifecycle/agents/
└── validator.md              # Val agent persona

_kratos/intelligence/validation/
├── validator.ts              # Validation engine
├── ground-truth.ts           # Filesystem fact cache
├── claim-extractor.ts        # Extract verifiable claims from artifacts
└── index.ts                  # Public API exports
```

### Step 9.1: Create the Validator agent persona

**File:** `_kratos/lifecycle/agents/validator.md`

```markdown
<agent id="validator" name="Val" role="Artifact Validator">

<persona>
Val is a meticulous fact-checker who verifies the accuracy of all generated artifacts.
Val is skeptical by default — every claim must be backed by evidence from the filesystem,
existing documents, or verified ground truth. Val never assumes; Val verifies.
</persona>

<communication-style>
- Direct and precise — states findings without hedging
- Uses evidence-based language: "Verified: X exists at Y" or "CONTRADICTION: X claims Y, but Z is true"
- Severity levels: CRITICAL (factual error), WARNING (unverifiable claim), INFO (suggestion)
- Never diplomatic about errors — accuracy is more important than feelings
</communication-style>

<responsibilities>
1. Verify file paths referenced in artifacts actually exist
2. Verify dependency names and versions against package.json/requirements.txt
3. Verify requirement IDs in stories match IDs in PRD
4. Verify architecture claims match actual code structure
5. Verify API endpoint descriptions match implementation
6. Maintain ground-truth cache of verified filesystem facts
7. Flag contradictions between artifacts
</responsibilities>

<rules>
- NEVER approve an artifact with CRITICAL findings
- WARNING findings can be noted but don't block
- INFO findings are suggestions only
- Ground truth older than 7 days: flag as potentially stale
- Always cite the exact file/line that contradicts a claim
- Never modify artifacts directly — report findings for the owning agent to fix
</rules>

<memory-sidecar>_kratos/_memory/validator-sidecar/</memory-sidecar>

</agent>
```

### Step 9.2: Implement the Ground Truth Cache

**File:** `_kratos/intelligence/validation/ground-truth.ts`

```typescript
interface GroundTruthFact {
  category: 'file' | 'dependency' | 'api' | 'requirement' | 'structure';
  key: string;                   // e.g., "src/auth/login.ts", "express@4.18"
  value: string;                 // e.g., "exists, 245 lines", "installed"
  verified_at: string;           // ISO 8601
  source: string;                // How it was verified
}

class GroundTruth {
  constructor(private db: MemoryManager)

  // Scan filesystem and populate ground truth
  async refresh(projectPath: string): Promise<{
    files_scanned: number;
    dependencies_checked: number;
    facts_stored: number;
  }>
  // Scans:
  //   1. All source files (name, path, size, line count)
  //   2. Package dependencies (from package.json, requirements.txt, etc.)
  //   3. Directory structure (top 3 levels)
  //   4. API routes (if detectable from framework conventions)
  //   5. Stores all as 'facts' partition in memory DB

  // Get a specific fact
  async getFact(key: string): Promise<GroundTruthFact | null>

  // Check if a file exists
  async fileExists(filePath: string): Promise<boolean>

  // Check if a dependency exists
  async dependencyExists(name: string, version?: string): Promise<boolean>

  // Check freshness
  async isFresh(maxAgeDays: number): Promise<boolean>

  // Get stale facts
  async getStaleFacts(maxAgeDays: number): Promise<GroundTruthFact[]>

  // Get all facts by category
  async getByCategory(category: string): Promise<GroundTruthFact[]>
}
```

### Step 9.3: Implement the Claim Extractor

**File:** `_kratos/intelligence/validation/claim-extractor.ts`

```typescript
interface Claim {
  type: 'file-reference' | 'dependency' | 'requirement-id' | 'api-endpoint' | 'architecture' | 'metric';
  text: string;                  // The original claim text
  value: string;                 // The specific value to verify
  line_number: number;           // Where in the artifact
  confidence: number;            // How confident we are this IS a verifiable claim (0-1)
}

class ClaimExtractor {
  // Extract verifiable claims from a markdown artifact
  async extract(filePath: string): Promise<Claim[]>
  // Extraction rules:
  //
  // file-reference:
  //   - Backticked paths: `src/auth/login.ts`
  //   - Code block paths: import from './auth/login'
  //   - Inline references: "the file src/auth/login.ts contains..."
  //   Pattern: backtick or quote containing path-like string with / and extension
  //
  // dependency:
  //   - "uses Express 4.18" → dependency: express@4.18
  //   - "requires React" → dependency: react
  //   Pattern: package-name-like words near "uses", "requires", "depends on"
  //
  // requirement-id:
  //   - "FR-001", "NFR-003", "AC-1"
  //   Pattern: uppercase letters + hyphen + numbers
  //
  // api-endpoint:
  //   - "POST /api/v1/users"
  //   - "GET /auth/login"
  //   Pattern: HTTP method + URL path
  //
  // architecture:
  //   - "monolithic architecture"
  //   - "3 microservices"
  //   Pattern: architecture-related keywords + structure claims
  //
  // metric:
  //   - "test coverage: 85%"
  //   - "response time < 200ms"
  //   Pattern: number + unit near quality-related keywords
}
```

### Step 9.4: Implement the Validation Engine

**File:** `_kratos/intelligence/validation/validator.ts`

```typescript
interface ValidationFinding {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  claim: Claim;
  status: 'verified' | 'contradicted' | 'unverifiable' | 'stale';
  evidence?: string;             // What we found
  expected?: string;             // What the claim said
  actual?: string;               // What reality shows
  suggestion?: string;           // How to fix
}

interface ValidationReport {
  artifact_path: string;
  total_claims: number;
  verified: number;
  contradicted: number;
  unverifiable: number;
  findings: ValidationFinding[];
  overall: 'PASSED' | 'FAILED';  // FAILED if any CRITICAL finding
  validated_at: string;
}

class Validator {
  constructor(
    private groundTruth: GroundTruth,
    private claimExtractor: ClaimExtractor
  )

  // Validate an artifact
  async validate(artifactPath: string): Promise<ValidationReport>
  // Algorithm:
  //   1. Extract claims from artifact
  //   2. For each claim:
  //      a. file-reference → check filesystem (groundTruth.fileExists)
  //      b. dependency → check package files (groundTruth.dependencyExists)
  //      c. requirement-id → search PRD and stories for matching ID
  //      d. api-endpoint → check route files or API docs
  //      e. architecture → cross-reference architecture.md
  //      f. metric → check test reports or CI outputs
  //   3. Generate findings for each claim
  //   4. Overall = FAILED if any CRITICAL findings
  //   5. Return report

  // Validate with auto-fix suggestions
  async validateWithFixes(artifactPath: string): Promise<{
    report: ValidationReport;
    fixes: { finding: ValidationFinding; fix: string }[];
  }>

  // Format report for display
  formatReport(report: ValidationReport): string
  // Output:
  //   ## Validation Report: architecture.md
  //
  //   **Result: FAILED** (2 critical, 1 warning, 3 verified)
  //
  //   ### CRITICAL
  //   - Line 45: References `src/auth/jwt-handler.ts` — FILE NOT FOUND
  //     Suggestion: Did you mean `src/auth/jwt.ts`?
  //   - Line 89: Claims dependency `express@5.0` — WRONG VERSION
  //     Actual: express@4.18.2 (from package.json)
  //
  //   ### WARNING
  //   - Line 120: Claims "test coverage: 92%" — UNVERIFIABLE
  //     No test coverage report found at expected location
  //
  //   ### VERIFIED (3)
  //   - Line 12: `src/index.ts` ✓
  //   - Line 23: `package.json` ✓
  //   - Line 56: FR-001 matches PRD ✓

  // Hook integration: validate at template-output
  async validateTemplateOutput(outputPath: string, haltOnCritical: boolean): Promise<boolean>
  // Returns true if validation passes (no CRITICAL findings)
  // If haltOnCritical and CRITICAL found: return false (workflow should halt)
}
```

### Step 9.5: Add CLI commands

Add to `cli.ts`:

```typescript
const validate = program.command('validate').description('Artifact validation');

validate
  .command('artifact <path>')
  .description('Validate an artifact against ground truth')
  .action(async (path) => {
    // Run Validator.validate(), display formatted report
  });

validate
  .command('refresh-ground-truth')
  .description('Refresh filesystem ground truth cache')
  .option('-p, --path <dir>', 'Project path to scan')
  .action(async (opts) => {
    // Run GroundTruth.refresh()
  });

validate
  .command('ground-truth')
  .description('Show current ground truth facts')
  .option('-c, --category <cat>', 'Filter by category')
  .action(async (opts) => {
    // Display ground truth facts
  });
```

### Step 9.6: Update global.yaml

```yaml
providers:
  # ... existing provider settings ...
  validator:
    enabled: true
    auto_validate: false          # true = validate every template-output
    halt_on_critical: true        # Halt workflow on CRITICAL finding
    ground_truth_refresh_days: 7  # Refresh if older than N days
    ground_truth_path: "{memory_path}/ground-truth"
```

### Step 9.7: Create validator memory sidecar directory

```bash
mkdir -p _kratos/_memory/validator-sidecar
```

### Step 9.8: Update agent manifest

Add Val to `_kratos/_config/agent-manifest.csv`:

```csv
validator,Val,Artifact Validator,lifecycle,validator.md,Opus,Verifies factual claims in artifacts
```

### Verification — Upgrade 9

- [ ] Val agent persona file exists and follows agent format
- [ ] Ground truth refresh scans filesystem correctly
- [ ] Claim extractor finds file references in markdown
- [ ] Claim extractor finds dependency references
- [ ] Claim extractor finds requirement IDs
- [ ] Validator correctly identifies non-existent files as CRITICAL
- [ ] Validator correctly verifies existing files
- [ ] Validation report format is clear and actionable
- [ ] `npx kratos validate artifact docs/planning-artifacts/architecture.md` works
- [ ] `npx kratos validate refresh-ground-truth` populates cache
- [ ] Agent manifest updated with Val

### Files Created — Upgrade 9

| File | Action |
|------|--------|
| `_kratos/lifecycle/agents/validator.md` | Created |
| `_kratos/intelligence/validation/validator.ts` | Created |
| `_kratos/intelligence/validation/ground-truth.ts` | Created |
| `_kratos/intelligence/validation/claim-extractor.ts` | Created |
| `_kratos/intelligence/validation/index.ts` | Created |
| `_kratos/_memory/validator-sidecar/` | Created (directory) |
| `_kratos/_config/agent-manifest.csv` | Modified (added Val) |
| `_kratos/core/runtime/cli.ts` | Modified (added validate commands) |
| `_kratos/_config/global.yaml` | Modified (added validator section) |

---

## Phase 3 Completion Checklist

- [ ] Multi-provider system with Anthropic, OpenAI, Google, Ollama adapters
- [ ] Provider registry with automatic failover
- [ ] Cost router with complexity scoring (0-100) and 4-tier assignment
- [ ] Budget tracker with daily limits and alerts
- [ ] Val agent with ground-truth cache and claim extraction
- [ ] Validation engine verifies file references, dependencies, requirement IDs
- [ ] All CLI commands work: providers, cost, validate
- [ ] TypeScript compiles cleanly
- [ ] `npx kratos doctor` passes

### Checkpoint

```yaml
# _kratos/_memory/checkpoints/upgrade-phase-3.yaml
upgrade: "Phase 3 - Reach"
version: "2.2.0-hermes"
status: "completed"
completed_at: "{ISO 8601}"
upgrades:
  - id: 7
    name: "Multi-Provider LLM"
    status: "completed"
    files_created: 8
  - id: 8
    name: "Cost Router"
    status: "completed"
    files_created: 2
  - id: 9
    name: "Validator Agent"
    status: "completed"
    files_created: 6
total_files_created: 16
dependencies_added: ["@anthropic-ai/sdk", "openai", "@google/generative-ai"]
config_changes: ["providers.yaml created", "global.yaml: added providers + validator sections"]
new_agents: ["validator (Val)"]
```

### Next Phase

```
Read docs/upgrade-plan/PHASE-4-OBSERVABILITY.md and implement Upgrade 10
```
