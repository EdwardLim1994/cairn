// @vitest-environment happy-dom
import { ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useGraphStore } from "../stores/graph";
import { useGraphInteractionViewModel } from "./useGraphInteractionViewModel";

describe("graph interaction view model", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("opens a positioned context menu only inside the graph and closes it on the next click", () => {
    const contextMenu = ref<{ x: number; y: number; flowX: number; flowY: number } | null>(null);
    const graphCanvas = ref({
      screenToFlowCoordinate: vi.fn().mockReturnValue({ x: 120, y: 80 }),
      fitView: vi.fn(),
    });
    const model = useGraphInteractionViewModel({
      store: useGraphStore(),
      contextMenu,
      graphCanvas,
      syncNodes: vi.fn(),
      openMockPanel: vi.fn(),
      editService: vi.fn(),
    });
    const graph = document.createElement("div");
    graph.className = "graph-flow";
    const child = document.createElement("div");
    graph.append(child);
    document.body.append(graph);
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 20,
      clientY: 30,
    });
    child.dispatchEvent(event);
    model.handleCanvasContextMenu(event);
    expect(event.defaultPrevented).toBe(true);
    expect(contextMenu.value).toEqual({ x: 20, y: 30, flowX: 120, flowY: 80 });

    const outside = new MouseEvent("contextmenu", { cancelable: true });
    model.handleCanvasContextMenu(outside);
    expect(contextMenu.value).toBeNull();
    document.body.removeChild(graph);
  });

  it("selects, synchronizes, and focuses the clicked node before opening its panel", () => {
    const store = useGraphStore();
    const syncNodes = vi.fn();
    const openMockPanel = vi.fn();
    const editService = vi.fn();
    const fitView = vi.fn();
    const model = useGraphInteractionViewModel({
      store,
      contextMenu: ref(null),
      graphCanvas: ref({ screenToFlowCoordinate: vi.fn(), fitView }),
      syncNodes,
      openMockPanel,
      editService,
    });
    model.onNodeClick("service-1");
    expect(store.selectedNodeId).toBe("service-1");
    expect(syncNodes).toHaveBeenCalledOnce();
    expect(fitView).toHaveBeenCalledWith({ nodes: ["service-1"], padding: 0.45, duration: 300 });
    expect(editService).toHaveBeenCalledWith("service-1");
    model.onNodeClick("mock-apis");
    expect(openMockPanel).toHaveBeenCalledOnce();
  });
});
