import type { Edge, Node } from "@vue-flow/core";
import type { CanvasGetResponse, CanvasPutRequest } from "#shared/api/canvas";

export type GraphService = CanvasGetResponse["services"][number];
export type GraphEndpoint = GraphService["endpoints"][number];
export type GraphServiceEdge = CanvasGetResponse["edges"][number];
export type GraphMockApi = CanvasGetResponse["mockApis"][number];
export type GraphViewport = CanvasPutRequest["viewport"];
export type GraphPosition = { x: number; y: number };
export type ObservedServiceEdge = { sourceService: string; targetService: string };
export type GraphRunResult = { status: string };
export type GraphState = {
  nodes: Node[];
  edges: Edge[];
  services: GraphService[];
  serviceEdges: GraphServiceEdge[];
  collapsedServiceEndpoints: Record<string, boolean>;
  serviceHealth: Record<string, boolean | null>;
  viewport: GraphViewport;
  mockNodePosition: GraphPosition;
  observedErrorServices: string[];
  observedServices: string[];
  observedEdges: ObservedServiceEdge[];
  observedMockApiId: string | null;
  mockConnectionsCollapsed: boolean;
  selectedNodeId: string | null;
};
