# EmberGrid

EmberGrid is a client-side telemetry and rendering laboratory built around a deterministic wildfire-response simulation. It is designed to answer a concrete performance question: how many updates per second can a browser ingest, reduce, and visualize while meeting explicit frame-time, latency, responsiveness, queue-health, and correctness budgets?

The project preserves each implementation strategy as a selectable comparison point. That makes optimization results reproducible and shows what each change buys rather than presenting only the final renderer.

## Project status

Phase 0 is complete and establishes the repository and benchmark contract. The simulation, telemetry pipeline, renderer comparisons, workers, and production deployment are deliberately deferred to later phases in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

Current foundation:

- Vite 8, React 19, and TypeScript 7 with React Compiler enabled
- strict TypeScript checking
- ESLint and Vitest quality gates
- canonical experiment-configuration serialization
- documented benchmark methodology and performance budgets

TypeScript 7 provides the native `tsc` build compiler. The TypeScript 6 compatibility package is installed alongside it so API-dependent tooling such as `typescript-eslint` can operate during the TypeScript 7 transition.

## Setup

Requirements:

- Node.js compatible with Vite 8
- pnpm

```sh
pnpm install
pnpm dev
```

The development server prints its local URL after startup.

## Quality commands

```sh
pnpm lint
pnpm test
pnpm build
```

Run all three before considering a phase complete.

## Benchmarking

Benchmark results are meaningful only when the workload, environment, and active implementation strategies are recorded together. The initial contract uses 60 Hz as the portable headline target and treats 120 Hz as a separate high-refresh profile.

See [docs/benchmark-methodology.md](./docs/benchmark-methodology.md) for the full contract, warm-up and measurement rules, workload identity fields, and interpretation caveats.
