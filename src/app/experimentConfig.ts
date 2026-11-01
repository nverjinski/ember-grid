export const EXPERIMENT_CONFIG_SCHEMA_VERSION = 1 as const

export interface ExperimentConfig {
  schemaVersion: typeof EXPERIMENT_CONFIG_SCHEMA_VERSION
  scenario: {
    name: string
    seed: number
  }
  workload: {
    durationSeconds: number
    warmupSeconds: number
  }
  display: {
    targetHz: number
    viewport: {
      width: number
      height: number
      devicePixelRatio: number
    }
  }
  strategies: {
    ingress: string
    scheduling: string
    state: string
    renderer: string
  }
  instrumentation: {
    enabled: boolean
    latencySampleRate: number
  }
}

/**
 * Produces a stable, human-readable representation suitable for result files.
 * Explicit property ordering keeps equivalent configurations byte-identical.
 */
export function serializeExperimentConfig(config: ExperimentConfig): string {
  const canonicalConfig: ExperimentConfig = {
    schemaVersion: config.schemaVersion,
    scenario: {
      name: config.scenario.name,
      seed: config.scenario.seed,
    },
    workload: {
      durationSeconds: config.workload.durationSeconds,
      warmupSeconds: config.workload.warmupSeconds,
    },
    display: {
      targetHz: config.display.targetHz,
      viewport: {
        width: config.display.viewport.width,
        height: config.display.viewport.height,
        devicePixelRatio: config.display.viewport.devicePixelRatio,
      },
    },
    strategies: {
      ingress: config.strategies.ingress,
      scheduling: config.strategies.scheduling,
      state: config.strategies.state,
      renderer: config.strategies.renderer,
    },
    instrumentation: {
      enabled: config.instrumentation.enabled,
      latencySampleRate: config.instrumentation.latencySampleRate,
    },
  }

  return JSON.stringify(canonicalConfig, null, 2)
}
