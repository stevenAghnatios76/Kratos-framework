---
template: 'nfr-assessment'
version: 1.0.0
used_by: ['brownfield-onboarding']
---

# Non-Functional Requirements Assessment: {product_name}

> **Project:** {project_name}
> **Date:** {date}
> **Author:** {agent_name}
> **Mode:** Brownfield — baselines measured from codebase

## 1. Code Quality Baselines

| Metric | Current State | Tool/Source |
|--------|--------------|-------------|
| Linting | {ESLint / Pylint / etc. — config found / not found} | {config path} |
| Lint violations | {count or N/A} | {tool output} |
| Complexity hotspots | {list of files with high cyclomatic complexity} | {analysis} |
| Duplication | {estimated % or specific duplicated patterns} | {analysis} |
| Code style | {Prettier / Black / etc. — enforced / not enforced} | {config path} |

## 2. Security Posture

| Aspect | Current State | Risk Level |
|--------|--------------|------------|
| Dependency vulnerabilities | {X known CVEs / 0 / Not scanned} | {High / Medium / Low} |
| Secrets handling | {env vars / vault / hardcoded — details} | {High / Medium / Low} |
| Authentication quality | {mechanism and strength assessment} | {High / Medium / Low} |
| Authorization model | {RBAC / ABAC / none — details} | {High / Medium / Low} |
| Input validation | {consistent / partial / missing} | {High / Medium / Low} |
| HTTPS/TLS | {enforced / optional / missing} | {High / Medium / Low} |

## 3. Performance Baselines

| Metric | Current State | Notes |
|--------|--------------|-------|
| Bundle size (if frontend) | {size or N/A} | {tree-shaking, code splitting status} |
| Query patterns | {ORM usage, N+1 risks, raw queries} | {specific concerns} |
| Caching strategy | {what's cached, TTL, invalidation} | {gaps identified} |
| Response time indicators | {any benchmarks or load tests found} | {details} |
| Memory/resource patterns | {connection pooling, cleanup, leaks} | {details} |

## 4. Accessibility Status

| Aspect | Current State | Compliance Level |
|--------|--------------|-----------------|
| ARIA attributes | {present / partial / missing} | {WCAG A / AA / AAA / Non-compliant} |
| Semantic HTML | {used consistently / partially / not used} | {details} |
| Keyboard navigation | {supported / partial / not supported} | {details} |
| Screen reader support | {tested / untested} | {details} |
| Color contrast | {meets standards / unknown} | {details} |
| a11y testing tools | {configured / not configured} | {tool names} |

## 5. Test Coverage Baselines

| Metric | Current State | Notes |
|--------|--------------|-------|
| Test framework | {Jest / pytest / JUnit / etc.} | {config path} |
| Test count | {X unit / Y integration / Z e2e} | {details} |
| Coverage % | {line / branch / function coverage} | {coverage report path} |
| Untested areas | {list of modules/features with no tests} | {risk assessment} |
| Test quality patterns | {assertions per test, fixture usage, mocking approach} | {details} |
| CI test execution | {runs on PR / runs on push / not automated} | {CI config path} |

## 6. CI/CD Assessment

| Aspect | Current State | Notes |
|--------|--------------|-------|
| CI platform | {GitHub Actions / Jenkins / CircleCI / etc.} | {config path} |
| Build pipeline | {steps: lint, test, build, deploy} | {details} |
| Deploy strategy | {manual / CD / blue-green / canary} | {details} |
| Environment management | {dev / staging / prod — how managed} | {details} |
| Infrastructure as code | {Terraform / CloudFormation / Docker / none} | {details} |

## 7. NFR Baseline Summary

| Category | Current Baseline | Recommended Target | Gap Severity |
|----------|-----------------|-------------------|-------------|
| Code Quality | {summary} | {target} | {High / Medium / Low / None} |
| Security | {summary} | {target} | {High / Medium / Low / None} |
| Performance | {summary} | {target} | {High / Medium / Low / None} |
| Accessibility | {summary} | {target} | {High / Medium / Low / None} |
| Test Coverage | {summary} | {target} | {High / Medium / Low / None} |
| CI/CD | {summary} | {target} | {High / Medium / Low / None} |
