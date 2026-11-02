import { useCallback, useEffect, useState, type FormEvent } from 'react'
import './App.css'
import { checksumWorld } from './simulation/checksum'
import { FUEL_BED_PROFILES } from './simulation/fuelBeds'
import { createWildfireResponseScenario } from './simulation/scenarios'
import { Simulation } from './simulation/simulation'
import { SIMULATION_TICK_MILLISECONDS } from './simulation/step'
import type { WorldState } from './simulation/types'

const DEMO_INITIALIZATION = {
  width: 32,
  height: 20,
  seed: 42,
  sensorCount: 16,
}

const JUMP_TICK_LIMIT = 2_000
const TERRAIN_GLYPHS = ['g', 't', 's', 'x'] as const
const DEMO_SCENARIO = createWildfireResponseScenario(DEMO_INITIALIZATION)

function createDemoSimulation(): Simulation {
  return new Simulation(DEMO_INITIALIZATION, DEMO_SCENARIO.events)
}

function renderTextGrid(world: WorldState): string {
  const sensorByCell = new Map(
    world.sensors.map((sensor) => [sensor.cellId, sensor.status]),
  )
  const rows: string[] = []

  for (let y = 0; y < world.dimensions.height; y += 1) {
    let row = ''
    for (let x = 0; x < world.dimensions.width; x += 1) {
      const cellId = y * world.dimensions.width + x
      const fire = world.current.fireIntensityIndex[cellId]
      const smoke = world.current.smokeDensityIndex[cellId]
      const sensorStatus = sensorByCell.get(cellId)

      if (fire >= 750) row += '@'
      else if (fire >= 300) row += '*'
      else if (fire > 0) row += '+'
      else if (sensorStatus === 'failed') row += '!'
      else if (sensorStatus === 'active') row += 'i'
      else if (smoke > 0) row += '~'
      else row += TERRAIN_GLYPHS[world.terrain.fuelBedCode[cellId]] ?? '?'
    }
    rows.push(row)
  }

  return rows.join('\n')
}

function summarizeWorld(world: WorldState) {
  let burningCells = 0
  let smokyCells = 0
  let totalTemperatureDeciCelsius = 0
  let totalSurfaceFuelLoad = 0

  for (let cellId = 0; cellId < world.cellCount; cellId += 1) {
    if (world.current.fireIntensityIndex[cellId] > 0) burningCells += 1
    if (world.current.smokeDensityIndex[cellId] > 0) smokyCells += 1
    totalTemperatureDeciCelsius +=
      world.current.temperatureDeciCelsius[cellId]
    totalSurfaceFuelLoad +=
      world.current.surfaceFuelLoadGramsPerSquareMeter[cellId]
  }

  return {
    burningCells,
    smokyCells,
    failedSensors: world.sensors.filter(({ status }) => status === 'failed')
      .length,
    averageTemperatureCelsius:
      totalTemperatureDeciCelsius / world.cellCount / 10,
    averageSurfaceFuelLoad: totalSurfaceFuelLoad / world.cellCount,
  }
}

function App() {
  const [simulation] = useState(createDemoSimulation)
  const [isPlaying, setIsPlaying] = useState(false)
  const [jumpTick, setJumpTick] = useState(50)
  const [world, setWorld] = useState<WorldState>(() => ({
    ...simulation.world,
  }))

  const refresh = useCallback(
    () => setWorld({ ...simulation.world }),
    [simulation],
  )

  useEffect(() => {
    if (!isPlaying) return undefined

    const intervalId = window.setInterval(() => {
      simulation.step()
      refresh()
    }, SIMULATION_TICK_MILLISECONDS)

    return () => window.clearInterval(intervalId)
  }, [isPlaying, simulation, refresh])

  const summary = summarizeWorld(world)
  const checksum = checksumWorld(world)
  const elapsedSeconds =
    (world.tick * SIMULATION_TICK_MILLISECONDS) / 1_000

  const step = () => {
    simulation.step()
    refresh()
  }

  const reset = () => {
    setIsPlaying(false)
    simulation.reset()
    refresh()
  }

  const jump = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsPlaying(false)
    const targetTick = Math.min(
      JUMP_TICK_LIMIT,
      Math.max(0, Math.floor(jumpTick)),
    )
    if (targetTick < simulation.world.tick) simulation.reset()
    simulation.advanceToTick(targetTick)
    setJumpTick(targetTick)
    refresh()
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Phase 1 · deterministic simulation</p>
          <h1>EmberGrid</h1>
          <p className="lede">
            A seeded wildfire-response world where every tick can be replayed
            and verified.
          </p>
        </div>
        <div className="run-state" data-playing={isPlaying}>
          <span className="run-state-dot" />
          {isPlaying ? 'Running at 10 ticks/s' : 'Simulation paused'}
        </div>
      </header>

      <section className="workspace" aria-label="Simulation workspace">
        <div className="world-card">
          <div className="card-heading">
            <div>
              <p className="section-label">Scenario</p>
              <h2>{DEMO_SCENARIO.name}</h2>
              <p>{DEMO_SCENARIO.description}</p>
            </div>
            <div className="tick-readout">
              <span>Tick</span>
              <strong>{world.tick.toLocaleString()}</strong>
              <small>{elapsedSeconds.toFixed(1)} simulated seconds</small>
            </div>
          </div>

          <div className="grid-frame">
            <pre aria-label="Text representation of the EmberGrid world">
              {renderTextGrid(world)}
            </pre>
          </div>

          <div className="legend" aria-label="Grid legend">
            <span><b>@ * +</b> fire</span>
            <span><b>~</b> smoke</span>
            <span><b>i / !</b> active / failed sensor</span>
            {FUEL_BED_PROFILES.map((profile) => (
              <span key={profile.code}>
                <b>{TERRAIN_GLYPHS[profile.code]}</b> {profile.name}
              </span>
            ))}
          </div>
        </div>

        <aside className="control-card">
          <div>
            <p className="section-label">Controls</p>
            <h2>Simulation clock</h2>
          </div>

          <div className="button-row">
            <button
              className="primary-button"
              type="button"
              onClick={() => setIsPlaying((playing) => !playing)}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button type="button" onClick={step} disabled={isPlaying}>
              Step
            </button>
            <button type="button" onClick={reset}>Reset</button>
          </div>

          <form className="jump-form" onSubmit={jump}>
            <label htmlFor="jump-tick">Jump to tick</label>
            <div>
              <input
                id="jump-tick"
                type="number"
                min="0"
                max={JUMP_TICK_LIMIT}
                step="1"
                value={jumpTick}
                onChange={(event) => setJumpTick(Number(event.target.value))}
              />
              <button type="submit">Jump</button>
            </div>
          </form>

          <dl className="metrics">
            <div><dt>Burning cells</dt><dd>{summary.burningCells}</dd></div>
            <div><dt>Smoke cells</dt><dd>{summary.smokyCells}</dd></div>
            <div><dt>Average temperature</dt><dd>{summary.averageTemperatureCelsius.toFixed(1)}°C</dd></div>
            <div><dt>Average surface fuel</dt><dd>{summary.averageSurfaceFuelLoad.toFixed(0)} g/m²</dd></div>
            <div><dt>Wind</dt><dd>{world.wind.direction}, {(world.wind.speedCentimetersPerSecond / 100).toFixed(1)} m/s</dd></div>
            <div><dt>Failed sensors</dt><dd>{summary.failedSensors} / {world.sensors.length}</dd></div>
          </dl>

          <div className="checksum">
            <span>Authoritative checksum</span>
            <code>{checksum}</code>
          </div>

          <ol className="timeline">
            {DEMO_SCENARIO.milestones.map((milestone) => (
              <li
                key={milestone.tick}
                data-reached={world.tick >= milestone.tick}
              >
                <span>{milestone.tick}</span>
                {milestone.label}
              </li>
            ))}
          </ol>
        </aside>
      </section>
    </main>
  )
}

export default App
