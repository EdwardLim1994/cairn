type GraphService = { id: string; name: string; endpoints: { id: string }[] };
type GraphMockApi = { id: string; targetEndpointId: string | null };

const serviceBaseHeight = 130;
const endpointHeight = 47;
const triggerWidth = 254;
const mockHeight = 88;
const layerWidth = 720;
const triggerGap = 72;
const rowGap = 88;

export function arrangeGraph(
  services: GraphService[],
  edges: { sourceServiceId: string; targetEndpointId: string }[],
  mockApis: GraphMockApi[],
) {
  const endpointOwners = new Map(
    services.flatMap((service) => service.endpoints.map((endpoint) => [endpoint.id, service.id])),
  );
  const adjacency = new Map(services.map(({ id }) => [id, new Set<string>()]));
  for (const edge of edges) {
    const target = endpointOwners.get(edge.targetEndpointId);
    if (target && target !== edge.sourceServiceId) adjacency.get(edge.sourceServiceId)?.add(target);
  }

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
    for (const target of [...(adjacency.get(id) ?? [])].sort()) {
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
        component.sort((left, right) => serviceKey(left).localeCompare(serviceKey(right))),
      );
    }
  }
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const serviceKey = (id: string) => `${serviceById.get(id)?.name ?? ""}\0${id}`;
  for (const { id } of [...services].sort((left, right) =>
    serviceKey(left.id).localeCompare(serviceKey(right.id)),
  ))
    if (!indices.has(id)) visit(id);

  const componentByService = new Map(
    components.flatMap((group, index) => group.map((id) => [id, index])),
  );
  const componentEdges = components.map(() => new Set<number>());
  const indegree = components.map(() => 0);
  for (const [source, targets] of adjacency) {
    const from = componentByService.get(source)!;
    for (const target of targets) {
      const to = componentByService.get(target)!;
      if (from !== to && !componentEdges[from]!.has(to)) {
        componentEdges[from]!.add(to);
        indegree[to]!++;
      }
    }
  }
  const componentKey = (index: number) => components[index]!.map(serviceKey).join("\0");
  const ranks = components.map(() => 0);
  const ready = components.map((_, index) => index).filter((index) => indegree[index] === 0);
  while (ready.length) {
    ready.sort((left, right) => componentKey(left).localeCompare(componentKey(right)));
    const index = ready.shift()!;
    for (const target of componentEdges[index]!) {
      ranks[target] = Math.max(ranks[target]!, ranks[index]! + 1);
      indegree[target]!--;
      if (indegree[target] === 0) ready.push(target);
    }
  }

  const mockByService = new Map<string, GraphMockApi[]>();
  for (const api of mockApis) {
    const serviceId = endpointOwners.get(api.targetEndpointId ?? "");
    if (api.id && serviceId)
      mockByService.set(serviceId, [...(mockByService.get(serviceId) ?? []), api]);
  }
  for (const apis of mockByService.values())
    apis.sort((left, right) => left.id!.localeCompare(right.id!));

  const positions = new Map<string, { x: number; y: number }>();
  const layerCount = Math.max(0, ...ranks) + 1;
  for (let rank = 0; rank < layerCount; rank++) {
    const layer = components
      .map((group, index) => ({ group, index }))
      .filter(({ index }) => ranks[index] === rank)
      .sort((left, right) => componentKey(left.index).localeCompare(componentKey(right.index)));
    let y = 0;
    for (const { group } of layer) {
      for (const id of group) {
        const service = serviceById.get(id)!;
        const apis = mockByService.get(id) ?? [];
        const serviceHeight = serviceBaseHeight + service.endpoints.length * endpointHeight;
        const rowHeight = Math.max(serviceHeight, apis.length * mockHeight);
        const serviceY = y + (rowHeight - serviceHeight) / 2;
        positions.set(id, { x: rank * layerWidth, y: serviceY });
        apis.forEach((api, index) =>
          positions.set(`mock-api-${api.id}`, {
            x: rank * layerWidth - triggerWidth - triggerGap,
            y: y + (rowHeight - apis.length * mockHeight) / 2 + index * mockHeight,
          }),
        );
        y += rowHeight + rowGap;
      }
    }
  }
  return positions;
}
