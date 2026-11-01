import {
  applyScenarioEvent,
  validateScenarioEvent,
  type ScenarioEvent,
} from './events'
import {
  createInitializedWorld,
  type WorldInitialization,
} from './initialize'
import { stepWorld } from './step'
import type { WorldState } from './types'

interface OrderedScenarioEvent {
  declarationOrder: number
  event: ScenarioEvent
}

function cloneEvent(event: ScenarioEvent): ScenarioEvent {
  if (event.type === 'containment') {
    return { ...event, cellIds: [...event.cellIds] }
  }

  return { ...event }
}

export class Simulation {
  readonly initialization: WorldInitialization
  readonly events: readonly ScenarioEvent[]

  private eventIndex = 0
  private currentWorld: WorldState

  constructor(
    initialization: WorldInitialization,
    events: readonly ScenarioEvent[] = [],
  ) {
    this.initialization = { ...initialization }
    this.currentWorld = createInitializedWorld(this.initialization)

    const orderedEvents: OrderedScenarioEvent[] = events.map(
      (event, declarationOrder) => ({
        declarationOrder,
        event: cloneEvent(event),
      }),
    )
    orderedEvents.sort(
      (first, second) =>
        first.event.tick - second.event.tick ||
        first.declarationOrder - second.declarationOrder,
    )
    this.events = orderedEvents.map(({ event }) => event)

    for (const event of this.events) {
      validateScenarioEvent(this.currentWorld, event)
    }

    this.applyEventsAtCurrentTick()
  }

  get world(): WorldState {
    return this.currentWorld
  }

  step(): void {
    stepWorld(this.currentWorld)
    this.applyEventsAtCurrentTick()
  }

  advanceToTick(targetTick: number): void {
    if (!Number.isSafeInteger(targetTick) || targetTick < this.world.tick) {
      throw new RangeError(
        'targetTick must be a safe integer at or after the current tick',
      )
    }

    while (this.world.tick < targetTick) {
      this.step()
    }
  }

  reset(): void {
    this.currentWorld = createInitializedWorld(this.initialization)
    this.eventIndex = 0
    this.applyEventsAtCurrentTick()
  }

  private applyEventsAtCurrentTick(): void {
    while (
      this.eventIndex < this.events.length &&
      this.events[this.eventIndex].tick === this.world.tick
    ) {
      applyScenarioEvent(this.world, this.events[this.eventIndex])
      this.eventIndex += 1
    }
  }
}
