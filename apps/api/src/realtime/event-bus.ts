import { EventEmitter } from "node:events";
import type { DomainEvent } from "@hotel-os/shared";

const eventBus = new EventEmitter();
const domainEventName = "domain-event";

export function publishDomainEvent(event: DomainEvent) {
  eventBus.emit(domainEventName, event);
}

export function onDomainEvent(listener: (event: DomainEvent) => void) {
  eventBus.on(domainEventName, listener);
  return () => eventBus.off(domainEventName, listener);
}
