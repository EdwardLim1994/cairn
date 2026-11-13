import { describe, expect, it } from "vite-plus/test";
import type { CanvasGetResponse } from "#shared/api/canvas";
import { useMessageDestinationMutations } from "../model/useMessageDestinationMutations";

type Destination = CanvasGetResponse["messageDestinations"][number];
const destination = {
  id: "queue-1",
  projectId: "project-1",
  queueId: "queue-1",
  queueName: "Orders",
  broker: "kafka",
  name: "orders.created",
  connection: { brokers: "localhost:9092", securityProtocol: "PLAINTEXT" },
  x: 10,
  y: 20,
  health: null,
} satisfies Destination;

function setup(initial: Destination[] = [], persistSucceeds = true, refreshSucceeds = true) {
  let destinations = [...initial];
  let connections: CanvasGetResponse["messageConnections"] = [];
  const events: string[] = [];
  const errors: string[] = [];
  const successes: string[] = [];
  const mutations = useMessageDestinationMutations({
    destinations: () => destinations,
    connections: () => connections,
    setDestinations: (value) => (destinations = value),
    setConnections: (value) => (connections = value),
    syncNodes: () => events.push("project"),
    saveCanvas: async () => {
      events.push("persist");
      return persistSucceeds;
    },
    loadCanvas: async () => {
      events.push("refresh");
      return refreshSucceeds;
    },
    onError: (message) => errors.push(message),
    onSuccess: (action) => successes.push(action),
  });
  return {
    ...mutations,
    get destinations() {
      return destinations;
    },
    get connections() {
      return connections;
    },
    set connections(value: CanvasGetResponse["messageConnections"]) {
      connections = value;
    },
    events,
    errors,
    successes,
  };
}

describe("message destination mutations", () => {
  it("reports create and update only after canvas refresh", async () => {
    const context = setup();
    expect(await context.saveMessageQueue(destination)).toBe(true);
    expect(context.destinations).toEqual([destination]);
    expect(context.events).toEqual(["project", "persist", "refresh"]);
    expect(context.successes).toEqual(["created"]);

    expect(await context.saveMessageQueue({ ...destination, name: "orders.updated" })).toBe(true);
    expect(context.destinations[0]?.name).toBe("orders.updated");
    expect(context.successes).toEqual(["created", "updated"]);
  });

  it("removes one queue and its connections after persistence and refresh", async () => {
    const context = setup([destination]);
    context.connections = [
      {
        id: "connection-1",
        type: "subscribe",
        serviceId: "service-1",
        destinationId: destination.id,
      },
    ];
    expect(await context.removeMessageQueue(destination.id)).toBe(true);
    expect(context.destinations).toEqual([]);
    expect(context.connections).toEqual([]);
    expect(context.successes).toEqual(["deleted"]);
  });

  it("retains editor data and withholds success after a failed refresh", async () => {
    const context = setup([destination], true, false);
    expect(await context.saveMessageQueue({ ...destination, name: "changed" })).toBe(false);
    expect(context.destinations).toEqual([destination]);
    expect(context.errors.at(-1)).toContain("workspace refresh failed");
    expect(context.successes).toEqual([]);

    expect(await context.removeMessageQueue(destination.id)).toBe(false);
    expect(context.destinations).toEqual([destination]);
    expect(context.successes).toEqual([]);
  });

  it("restores the projection when persistence fails", async () => {
    const context = setup([destination], false);
    expect(await context.saveMessageQueue({ ...destination, name: "changed" })).toBe(false);
    expect(context.destinations).toEqual([destination]);
    expect(context.events).not.toContain("refresh");
    expect(context.successes).toEqual([]);
  });
});
