import assert from "node:assert/strict";
import test from "node:test";
import type { DomainEvent } from "@hotel-os/shared";
import { onDomainEvent, publishDomainEvent } from "./event-bus.js";

test("domain event bus publishes subscribed events", () => {
  const received: DomainEvent[] = [];
  const unsubscribe = onDomainEvent((event) => received.push(event));

  publishDomainEvent({ type: "config.changed", scope: "rooms" });
  unsubscribe();

  assert.deepEqual(received, [{ type: "config.changed", scope: "rooms" }]);
});
