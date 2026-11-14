import ELK from "elkjs/lib/elk.bundled.js";

const elk = new ELK();
const node = (id, width, height, ports = []) => ({
  id,
  width,
  height,
  layoutOptions: { "org.eclipse.elk.portConstraints": "FIXED_ORDER" },
  ports: ports.map(([name, side]) => ({
    id: `${id}:${name}`,
    width: 1,
    height: 1,
    layoutOptions: { "org.eclipse.elk.port.side": side },
  })),
});
const edge = (id, source, sourcePort, target, targetPort) => ({
  id,
  sources: [`${source}:${sourcePort}`],
  targets: [`${target}:${targetPort}`],
});

const graph = {
  id: "root",
  layoutOptions: {
    "elk.algorithm": "layered",
    "elk.direction": "RIGHT",
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.layered.spacing.nodeNodeBetweenLayers": "120",
    "elk.spacing.nodeNode": "88",
    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
  },
  children: [
    node("publisher", 320, 470, [
      ["out", "EAST"],
      ["in", "WEST"],
    ]),
    node("orders", 288, 105, [
      ["in", "WEST"],
      ["out", "EAST"],
    ]),
    node("consumer", 320, 300, [
      ["in", "WEST"],
      ["out", "EAST"],
    ]),
    node("caller", 320, 190, [
      ["out", "EAST"],
      ["in", "WEST"],
    ]),
    node("target", 320, 300, [
      ["in", "WEST"],
      ["out", "EAST"],
    ]),
    node("trigger", 254, 176, [["out", "EAST"]]),
    node("isolated", 320, 246, [
      ["in", "WEST"],
      ["out", "EAST"],
    ]),
  ],
  edges: [
    edge("publish", "publisher", "out", "orders", "in"),
    edge("consume", "orders", "out", "consumer", "in"),
    edge("call", "caller", "out", "target", "in"),
    edge("trigger-call", "trigger", "out", "target", "in"),
    edge("cycle-forward", "consumer", "out", "caller", "in"),
    edge("cycle-back", "caller", "out", "consumer", "in"),
  ],
};

const start = performance.now();
const result = await elk.layout(graph);
const elapsedMs = performance.now() - start;
const nodes = result.children;
const edges = result.edges;
const rect = (n) => ({ left: n.x, top: n.y, right: n.x + n.width, bottom: n.y + n.height });
const hits = [];
for (const e of edges) {
  const sections = e.sections ?? [];
  for (const section of sections) {
    const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
    for (const obstacle of nodes.filter(
      (n) => n.id !== e.sources[0].split(":")[0] && n.id !== e.targets[0].split(":")[0],
    )) {
      const r = rect(obstacle);
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const intersects =
          a.x === b.x
            ? a.x > r.left &&
              a.x < r.right &&
              Math.max(a.y, b.y) > r.top &&
              Math.min(a.y, b.y) < r.bottom
            : a.y > r.top &&
              a.y < r.bottom &&
              Math.max(a.x, b.x) > r.left &&
              Math.min(a.x, b.x) < r.right;
        if (intersects) hits.push({ edge: e.id, obstacle: obstacle.id });
      }
    }
  }
}
console.log(
  JSON.stringify(
    {
      elapsedMs: Number(elapsedMs.toFixed(2)),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      obstacleIntersections: hits,
      nodes: nodes.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })),
      edges: edges.map(({ id, sections }) => ({ id, sections })),
    },
    null,
    2,
  ),
);
