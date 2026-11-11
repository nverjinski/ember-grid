import { describe, expect, it, vi } from "vitest";
import {
  TelemetryEventChannel,
  type TelemetryTransportEvent,
} from "./transport";

const EVENT: TelemetryTransportEvent = {
  type: "telemetry",
  runId: 7,
  json: '{"kind":"snapshot"}',
  receivedAtMilliseconds: 123.5,
};

describe("telemetry event channel", () => {
  it("publishes each event to every current listener in subscription order", () => {
    const channel = new TelemetryEventChannel();
    const calls: string[] = [];

    channel.subscribe("telemetry", () => calls.push("first"));
    channel.subscribe("telemetry", () => calls.push("second"));
    channel.publish(EVENT);

    expect(calls).toEqual(["first", "second"]);
  });

  it("returns an idempotent unsubscribe function", () => {
    const channel = new TelemetryEventChannel();
    const listener = vi.fn();
    const unsubscribe = channel.subscribe("telemetry", listener);

    channel.publish(EVENT);
    unsubscribe();
    unsubscribe();
    channel.publish(EVENT);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(EVENT);
  });

  it("uses a stable listener snapshot for each publication", () => {
    const channel = new TelemetryEventChannel();
    const calls: string[] = [];
    let subscribedLate = false;

    channel.subscribe("telemetry", () => {
      calls.push("first");
      if (!subscribedLate) {
        subscribedLate = true;
        channel.subscribe("telemetry", () => calls.push("late"));
      }
    });

    channel.publish(EVENT);
    expect(calls).toEqual(["first"]);

    channel.publish(EVENT);
    expect(calls).toEqual(["first", "first", "late"]);
  });

  it("clears every current listener", () => {
    const channel = new TelemetryEventChannel();
    const first = vi.fn();
    const second = vi.fn();
    channel.subscribe("telemetry", first);
    channel.subscribe("state", second);

    channel.clear();
    channel.publish(EVENT);

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });

  it("publishes only to listeners for the matching event type", () => {
    const channel = new TelemetryEventChannel();
    const telemetryListener = vi.fn();
    const stateListener = vi.fn();
    channel.subscribe("telemetry", telemetryListener);
    channel.subscribe("state", stateListener);

    channel.publish(EVENT);

    expect(telemetryListener).toHaveBeenCalledOnce();
    expect(stateListener).not.toHaveBeenCalled();
  });
});
