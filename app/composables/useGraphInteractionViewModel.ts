import type { Ref } from "vue";
import type { useGraphStore } from "../stores/graph";

type ContextMenuPosition = { x: number; y: number; flowX: number; flowY: number };
type GraphCanvas = {
  screenToFlowCoordinate: (position: {
    x: number;
    y: number;
  }) => { x: number; y: number } | undefined;
  fitView: (options: {
    nodes: string[];
    padding: number;
    duration: number;
  }) => Promise<void> | void;
};

export function useGraphInteractionViewModel(options: {
  store: ReturnType<typeof useGraphStore>;
  contextMenu: Ref<ContextMenuPosition | null>;
  graphCanvas: Ref<GraphCanvas | null>;
  syncNodes: () => void;
  openMockPanel: () => void;
  editService: (id: string) => void;
}) {
  function handleCanvasContextMenu(event: MouseEvent) {
    const point = options.graphCanvas.value?.screenToFlowCoordinate({
      x: event.clientX,
      y: event.clientY,
    });
    options.contextMenu.value = {
      x: event.clientX,
      y: event.clientY,
      flowX: point?.x ?? 160,
      flowY: point?.y ?? 120,
    };
  }

  function onNodeClick(nodeId: string) {
    options.store.setSelection(nodeId);
    options.syncNodes();
    void options.graphCanvas.value?.fitView({ nodes: [nodeId], padding: 0.45, duration: 300 });
    if (nodeId === "mock-apis") options.openMockPanel();
    else options.editService(nodeId);
  }

  return { handleCanvasContextMenu, onNodeClick };
}
