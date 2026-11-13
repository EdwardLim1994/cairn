import type { CanvasGetResponse } from "#shared/api/canvas";

type Destination = CanvasGetResponse["messageDestinations"][number];
type Connections = CanvasGetResponse["messageConnections"];

export function useMessageDestinationMutations(options: {
  destinations: () => Destination[];
  connections: () => Connections;
  setDestinations: (value: Destination[]) => void;
  setConnections: (value: Connections) => void;
  syncNodes: () => void;
  saveCanvas: () => Promise<boolean>;
  loadCanvas: () => Promise<boolean>;
  onError: (message: string) => void;
  onSuccess: (action: "created" | "updated" | "deleted") => void;
}) {
  function restore(destinations: Destination[], connections?: Connections) {
    options.setDestinations(destinations);
    if (connections) options.setConnections(connections);
    options.syncNodes();
  }

  async function saveMessageQueue(destination: Destination) {
    const previous = [...options.destinations()];
    const updating = previous.some(({ id }) => id === destination.id);
    options.setDestinations(
      updating
        ? previous.map((item) => (item.id === destination.id ? destination : item))
        : [...previous, destination],
    );
    options.syncNodes();
    if (!(await options.saveCanvas())) {
      restore(previous);
      return false;
    }
    if (!(await options.loadCanvas())) {
      restore(previous);
      options.onError("Message queue saved, but workspace refresh failed");
      return false;
    }
    options.onSuccess(updating ? "updated" : "created");
    return true;
  }

  async function removeMessageQueue(destinationId: string) {
    const previous = [...options.destinations()];
    if (!previous.some(({ id }) => id === destinationId)) return false;
    const previousConnections = [...options.connections()];
    options.setDestinations(previous.filter(({ id }) => id !== destinationId));
    options.setConnections(
      previousConnections.filter((connection) => connection.destinationId !== destinationId),
    );
    options.syncNodes();
    if (!(await options.saveCanvas())) {
      restore(previous, previousConnections);
      return false;
    }
    if (!(await options.loadCanvas())) {
      restore(previous, previousConnections);
      options.onError("Message queue deleted, but workspace refresh failed");
      return false;
    }
    options.onSuccess("deleted");
    return true;
  }

  return { saveMessageQueue, removeMessageQueue };
}
