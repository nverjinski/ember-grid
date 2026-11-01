# Benchmark methodology

EmberGrid benchmarks measure the maximum sustainable telemetry update rate while the selected performance and correctness budgets remain satisfied. Frames per second is an important signal, but it is not the score by itself.

## Initial performance contract

The portable headline profile targets a 60 Hz display:

- p95 frame interval at or below 16.67 ms
- p95 telemetry-received-to-render-commit latency below 100 ms
- no unexplained main-thread task over 50 ms
- queue depth and oldest-update age do not trend upward during the measured run
- final state matches the authoritative state in lossless modes
- lossy modes report dropped, coalesced, expired, and divergent state explicitly

A 120 Hz profile may be captured separately on supported hardware. Its frame budget is 8.33 ms. Results from 60 Hz and 120 Hz runs are different benchmark profiles and must not be compared as if their budgets were equivalent. Record the observed display cadence because variable-refresh displays and browser scheduling can differ from the requested target.

## Workload identity

Every result must include enough information to replay the same logical work:

- scenario name and version
- simulation seed and network-emulation seed
- starting and ending simulation ticks
- trace or fixture identifier and protocol version
- messages per second and entity updates per second
- updates per message and total entity count
- latency, jitter, burst, duplication, loss, and reordering settings
- ingress, scheduling, state, renderer, and backpressure strategies
- instrumentation state and latency sampling rate

Message throughput and entity-update throughput must be reported separately because one message may contain many updates.

## Environment identity

Record these fields with every saved result:

- Git commit or an explicit `uncommitted` marker
- browser name and exact version
- operating system and device model
- logical CPU count and memory when available
- viewport width and height
- device pixel ratio
- requested and observed display refresh rate
- production or development build mode
- power source and relevant power-saving mode
- instrumentation settings

Results are comparable only when the environment, workload, build mode, and active strategies match. A faster developer laptop is useful for finding high-throughput limits, but it does not replace results from a representative 60 Hz environment.

## Run procedure

1. Use a production build unless the experiment specifically measures development behavior.
2. Close unrelated high-load applications and background browser tabs where practical.
3. Load the exact named scenario, trace, seeds, and strategy configuration.
4. Run a 10-second warm-up that is excluded from reported samples. Increase the warm-up only when documented evidence shows the workload has not stabilized.
5. Reset metrics without resetting the deterministic workload identity.
6. Measure for 60 seconds.
7. Allow queued work to drain before checking final-state correctness.
8. Export the experiment configuration, environment identity, aggregate metrics, and correctness result together.
9. Repeat a configuration at least three times before making a comparative claim. Report the median run and retain all raw result files.

Warm-up and measured intervals must use representative workload behavior. Do not warm up on an idle workload before measuring a dense one.

## Required metrics

At minimum, retain:

- delivered messages and entity updates per second
- applied, coalesced, expired, and dropped update counts
- p50, p95, and p99 frame intervals
- missed frame-budget count and ratio
- p50, p95, and p99 sampled update-to-render latency
- main-thread long-task count and duration where supported
- queue depth and oldest-update age over time
- final-state checksum or explicit divergence summary

Percentiles must be calculated outside the hottest loop or at a low reporting frequency. Sample buffers must be bounded so the benchmark does not introduce an ever-growing memory cost.

## Interpretation caveats

- Browser backgrounding, developer tools, screen recording, thermal throttling, and power-saving modes can materially change results.
- Browser garbage-collection and memory APIs are not uniformly available; treat them as diagnostics rather than cross-browser contract metrics.
- A stable frame rate can hide an ever-growing queue, stale visuals, or dropped state. Queue health, latency, and correctness must remain visible beside frame metrics.
- A renderer win in a dense workload may lose in a sparse workload. Preserve workload-specific results and avoid universal claims from a single scenario.
- Instrumentation changes the workload. Measure with instrumentation disabled periodically and report the observed overhead.
