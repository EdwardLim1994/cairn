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
  editService: (id: string) => void;
  editMessageDestination: (id: string) => void;
  editMessageQueue?: (queueId: string) => void;
  editMockApi?: (id: string) => void;
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
    if (nodeId.startsWith("mock-api-")) {
      options.editMockApi?.(nodeId.slice("mock-api-".length));
      return;
    }
    if (nodeId === "message-queue" || nodeId.startsWith("message-queue:")) {
      options.store.setSelection(nodeId);
      options.editMessageQueue?.(
        nodeId === "message-queue" ? "legacy-queue" : nodeId.slice("message-queue:".length),
      );
      return;
    }
    if (nodeId.startsWith("message-destination-")) {
      const id = nodeId.slice("message-destination-".length);
      options.store.setSelection(nodeId);
      options.editMessageDestination(id);
      return;
    }
    if (!options.store.services.some((service) => service.id === nodeId)) return;
    options.store.setSelection(nodeId);
    options.syncNodes();
    void options.graphCanvas.value?.fitView({ nodes: [nodeId], padding: 0.45, duration: 300 });
    options.editService(nodeId);
  }

  return { handleCanvasContextMenu, onNodeClick };
}
