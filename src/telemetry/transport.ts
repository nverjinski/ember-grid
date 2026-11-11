export type TelemetryTransportState =
  | "idle"
  | "ready"
  | "running"
  | "paused"
  | "complete"
  | "stopped";

export type TelemetryTransportEvent =
  | {
      type: "telemetry";
      runId: number;
      json: string;
      receivedAtMilliseconds: number;
    }
  | {
      type: "state";
      runId: number;
      state: TelemetryTransportState;
    }
  | {
      type: "progress";
      runId: number;
      postedCount: number;
      totalCount: number;
    }
  | {
      type: "error";
      runId: number;
      message: string;
    };

export type TelemetryTransportEventType = TelemetryTransportEvent["type"];

export type TelemetryTransportEventOfType<
  T extends TelemetryTransportEventType,
> = Extract<TelemetryTransportEvent, { type: T }>;

export type TelemetryTransportListener<T extends TelemetryTransportEventType> =
  (event: TelemetryTransportEventOfType<T>) => void;

type StoredTelemetryTransportListener = (
  event: TelemetryTransportEvent,
) => void;

/**
 * Consumer-facing telemetry source. Lifecycle methods request transitions;
 * emitted events report what actually happened asynchronously.
 */
export interface TelemetryTransport {
  subscribe<T extends TelemetryTransportEventType>(
    type: T,
    listener: TelemetryTransportListener<T>,
  ): () => void;
  start(): void;
  pause(): void;
  reset(): void;
  stop(): void;
  dispose(): void;
}

/** Shared listener mechanics for worker replay and future transports. */
export class TelemetryEventChannel {
  private readonly listenersByType = new Map<
    TelemetryTransportEventType,
    Set<StoredTelemetryTransportListener>
  >();

  subscribe<T extends TelemetryTransportEventType>(
    type: T,
    listener: TelemetryTransportListener<T>,
  ): () => void {
    const currentListeners =
      this.listenersByType.get(type) ||
      new Set<StoredTelemetryTransportListener>();
    const storedListener = listener as StoredTelemetryTransportListener;
    this.listenersByType.set(type, currentListeners.add(storedListener));

    return () => {
      currentListeners.delete(storedListener);

      if (
        currentListeners.size === 0 &&
        this.listenersByType.get(type) === currentListeners
      ) {
        this.listenersByType.delete(type);
      }
    };
  }

  publish(event: TelemetryTransportEvent): void {
    const listeners = this.listenersByType.get(event.type);

    if (listeners === undefined) return;

    for (const listener of [...listeners]) {
      listener(event);
    }
  }

  clear(): void {
    this.listenersByType.clear();
  }
}
