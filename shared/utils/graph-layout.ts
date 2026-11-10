type GraphService = {
  id: string;
  name: string;
  endpoints: { id: string }[];
};
type GraphMockApi = { id: string; targetEndpointId: string | null };
type GraphDestination = { id: string; name: string; queueId?: string };
type GraphMessageConnection =
  | { type: "publish"; destinationId: string; endpointId?: string; serviceId?: string }
  | { type: "subscribe"; destinationId: string; serviceId: string };

const serviceBaseHeight = 130;
const endpointHeight = 56;
const queueRowHeight = 47;
const messageQueueBaseHeight = 58;
const triggerWidth = 254;
const mockHeight = 88;
const layerWidth = 720;
const triggerGap = 72;
const rowGap = 88;

function connectedComponents(
  nodeIds: string[],
  adjacency: Map<string, Set<string>>,
  serviceKey: (id: string) => string,
) {
  let nextIndex = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  function visit(id: string) {
    indices.set(id, nextIndex);
    lowLinks.set(id, nextIndex++);
    stack.push(id);
    onStack.add(id);
    for (const target of [...(adjacency.get(id) ?? [])].sort((left, right) =>
      left.localeCompare(right),
    )) {
      if (!indices.has(target)) {
        visit(target);
        lowLinks.set(id, Math.min(lowLinks.get(id)!, lowLinks.get(target)!));
      } else if (onStack.has(target)) {
        lowLinks.set(id, Math.min(lowLinks.get(id)!, indices.get(target)!));
      }
    }
    if (lowLinks.get(id) === indices.get(id)) {
      const component: string[] = [];
      let member: string;
      do {
        member = stack.pop()!;
        onStack.delete(member);
        component.push(member);
      } while (member !== id);
      components.push(
        component.toSorted((left, right) => serviceKey(left).localeCompare(serviceKey(right))),
      );
    }
  }
  for (const id of nodeIds.toSorted((left, right) =>
    serviceKey(left).localeCompare(serviceKey(right)),
  ))
    if (!indices.has(id)) visit(id);
  return components;
}

function componentRanks(
  components: string[][],
  adjacency: Map<string, Set<string>>,
  serviceKey: (id: string) => string,
) {
  const componentByNode = new Map(
    components.flatMap((group, index) => group.map((id) => [id, index])),
  );
  const edges = components.map(() => new Set<number>());
  const indegree = components.map(() => 0);
  for (const [source, targets] of adjacency) {
    const from = componentByNode.get(source)!;
    for (const target of targets) {
      const to = componentByNode.get(target)!;
      if (from !== to && !edges[from]!.has(to)) {
        edges[from]!.add(to);
        indegree[to]!++;
      }
    }
  }
  const key = (index: number) => components[index]!.map(serviceKey).join("\0");
  const ranks = components.map(() => 0);
  const ready = components.map((_, index) => index).filter((index) => indegree[index] === 0);
  while (ready.length) {
    ready.sort((left, right) => key(left).localeCompare(key(right)));
    const index = ready.shift()!;
    for (const target of edges[index]!) {
      ranks[target] = Math.max(ranks[target]!, ranks[index]! + 1);
      indegree[target]!--;
      if (indegree[target] === 0) ready.push(target);
    }
  }
  return { componentByNode, ranks };
}

export function messageQueueNodeId(destinationId?: string) {
  return destinationId ? `message-queue:${destinationId}` : "message-queue";
}

function createNodeRanks(
  services: GraphService[],
  edges: { sourceServiceId: string; targetEndpointId: string }[],
  destinations: GraphDestination[],
) {
  const endpointOwners = new Map(
    services.flatMap((service) => service.endpoints.map((endpoint) => [endpoint.id, service.id])),
  );
  const destinationNodeIds = destinations.map((destination) => messageQueueNodeId(destination.id));
  const nodeIds = [...services.map(({ id }) => id), ...destinationNodeIds];
  const adjacency = new Map(nodeIds.map((id) => [id, new Set<string>()]));
  for (const edge of edges) {
    const target = endpointOwners.get(edge.targetEndpointId);
    if (target && target !== edge.sourceServiceId) adjacency.get(edge.sourceServiceId)?.add(target);
  }
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const destinationsByNode = new Map(
    destinations.map((destination) => [messageQueueNodeId(destination.id), destination]),
  );
  const nodeName = (id: string) =>
    serviceById.get(id)?.name ?? destinationsByNode.get(id)?.name ?? "Message Queue";
  const serviceKey = (id: string) => `${nodeName(id)}\0${id}`;
  const components = connectedComponents(nodeIds, adjacency, serviceKey);
  const { componentByNode, ranks } = componentRanks(components, adjacency, serviceKey);
  const serviceRank = (id: string) => ranks[componentByNode.get(id)!]!;
  const queueRank = services.length
    ? Math.max(...services.map(({ id }) => serviceRank(id))) + 1
    : 0;
  const nodeRank = (id: string) => (serviceById.has(id) ? serviceRank(id) : queueRank);
  return { endpointOwners, destinationNodeIds, nodeIds, serviceById, serviceKey, nodeRank };
}

function placeNodes(
  nodeIds: string[],
  nodeRank: (id: string) => number,
  serviceKey: (id: string) => string,
  serviceById: Map<string, GraphService>,
  mockByService: Map<string, GraphMockApi[]>,
  subscriptionsByService: Map<string, number>,
  destinations: GraphDestination[],
) {
  const positions = new Map<string, { x: number; y: number }>();
  const layerCount = Math.max(0, ...nodeIds.map(nodeRank)) + 1;
  for (let rank = 0; rank < layerCount; rank++) {
    const layer = nodeIds
      .filter((id) => nodeRank(id) === rank)
      .toSorted((a, b) => serviceKey(a).localeCompare(serviceKey(b)));
    let y = 0;
    for (const id of layer) {
      const service = serviceById.get(id);
      if (!service) {
        y = placeQueue(id, rank, y, destinations, positions);
        continue;
      }
      y = placeService(id, service, rank, y, {
        mockByService,
        subscriptionsByService,
        destinations,
        positions,
      });
    }
  }
  return positions;
}

function placeQueue(
  id: string,
  rank: number,
  y: number,
  destinations: GraphDestination[],
  positions: Map<string, { x: number; y: number }>,
) {
  const destinationId = id.slice("message-queue:".length);
  positions.set(id, { x: rank * layerWidth, y });
  return (
    y +
    messageQueueBaseHeight +
    (destinations.some(({ id }) => id === destinationId) ? queueRowHeight : 0) +
    rowGap
  );
}

function placeService(
  id: string,
  service: GraphService,
  rank: number,
  y: number,
  context: {
    mockByService: Map<string, GraphMockApi[]>;
    subscriptionsByService: Map<string, number>;
    destinations: GraphDestination[];
    positions: Map<string, { x: number; y: number }>;
  },
) {
  const { mockByService, subscriptionsByService, destinations, positions } = context;
  const apis = mockByService.get(id) ?? [];
  const serviceHeight =
    serviceBaseHeight +
    (service.endpoints.length + (subscriptionsByService.get(id) ?? 0)) * endpointHeight +
    (destinations.length ? queueRowHeight : 0);
  const rowHeight = Math.max(serviceHeight, apis.length * mockHeight);
  const serviceY = y + (rowHeight - serviceHeight) / 2;
  positions.set(id, { x: rank * layerWidth, y: serviceY });
  apis.forEach((api, index) =>
    positions.set(`mock-api-${api.id}`, {
      x: rank * layerWidth - triggerWidth - triggerGap,
      y: y + (rowHeight - apis.length * mockHeight) / 2 + index * mockHeight,
    }),
  );
  return y + rowHeight + rowGap;
}

export function arrangeGraph(
  services: GraphService[],
  edges: { sourceServiceId: string; targetEndpointId: string }[],
  mockApis: GraphMockApi[],
  destinations: GraphDestination[] = [],
  messageConnections: GraphMessageConnection[] = [],
) {
  const { endpointOwners, nodeIds, serviceById, serviceKey, nodeRank } = createNodeRanks(
    services,
    edges,
    destinations,
  );
  const subscriptionsByService = new Map<string, number>();
  for (const connection of messageConnections)
    if (connection.type === "subscribe")
      subscriptionsByService.set(
        connection.serviceId,
        (subscriptionsByService.get(connection.serviceId) ?? 0) + 1,
      );
  const mockByService = new Map<string, GraphMockApi[]>();
  for (const api of mockApis) {
    const serviceId = endpointOwners.get(api.targetEndpointId ?? "");
    if (api.id && serviceId)
      mockByService.set(serviceId, [...(mockByService.get(serviceId) ?? []), api]);
  }
  for (const apis of mockByService.values())
    apis.sort((left, right) => left.id!.localeCompare(right.id!));

  return placeNodes(
    nodeIds,
    nodeRank,
    serviceKey,
    serviceById,
    mockByService,
    subscriptionsByService,
    destinations,
  );
}
