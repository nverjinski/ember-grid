import { describe, expect, it } from 'vitest'
import {
  EXPERIMENT_CONFIG_SCHEMA_VERSION,
  serializeExperimentConfig,
  type ExperimentConfig,
} from './experimentConfig'

const config: ExperimentConfig = {
  schemaVersion: EXPERIMENT_CONFIG_SCHEMA_VERSION,
  scenario: {
    name: 'sparse-steady',
    seed: 42,
  },
  workload: {
    durationSeconds: 60,
    warmupSeconds: 10,
  },
  display: {
    targetHz: 60,
    viewport: {
      width: 1440,
      height: 900,
      devicePixelRatio: 2,
    },
  },
  strategies: {
    ingress: 'immediate-json',
    scheduling: 'immediate',
    state: 'object-map',
    renderer: 'svg',
  },
  instrumentation: {
    enabled: true,
    latencySampleRate: 0.01,
  },
}

describe('serializeExperimentConfig', () => {
  it('round-trips every experiment identity field', () => {
    const serialized = serializeExperimentConfig(config)

    expect(JSON.parse(serialized)).toEqual(config)
  })

  it('uses a stable property order independent of input insertion order', () => {
    const reorderedConfig = {
      instrumentation: config.instrumentation,
      strategies: config.strategies,
      display: config.display,
      workload: config.workload,
      scenario: config.scenario,
      schemaVersion: config.schemaVersion,
    }

    expect(serializeExperimentConfig(reorderedConfig)).toBe(
      serializeExperimentConfig(config),
    )
  })
})
