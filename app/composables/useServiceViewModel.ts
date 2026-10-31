import type { Ref } from "vue";
import type { createApiClient } from "../models/api-client";
import type { GraphService } from "../models/graph";
import { parseOpenApiEndpoints, type ServiceEndpointDraft } from "../utils/openapi-import";

type ApiClient = ReturnType<typeof createApiClient>;
type EndpointDraft = ServiceEndpointDraft & { requestJson?: unknown };
export type ServiceDraft = {
  name: string;
  framework: string;
  baseUrl: string;
  active: boolean;
  endpoints: EndpointDraft[];
};
type Position = { x: number; y: number };

type ServiceViewModelOptions = {
  apiClient: ApiClient;
  draft: Ref<ServiceDraft>;
  editingServiceId: Ref<string | null>;
  dialogOpen: Ref<boolean>;
  frameworkMenuOpen: Ref<boolean>;
  addPosition: Ref<Position>;
  services: () => GraphService[];
  saveCanvas: () => Promise<void>;
  loadCanvas: () => Promise<void>;
  closeSettings: () => void;
  frameworkLabel: (framework: string) => string;
  onError: (message: string) => void;
  onImportWarnings: (warnings: string[]) => void;
};

export function useServiceViewModel(options: ServiceViewModelOptions) {
  let initialNewServiceEndpoint: EndpointDraft | null = null;

  function newServiceDraft(): ServiceDraft {
    return {
      name: "",
      framework: "",
      baseUrl: "http://localhost:3000",
      active: true,
      endpoints: [{ name: "", apiType: "REST", method: "GET", url: "/" }],
    };
  }

  function beginAddService(position: Position) {
    const draft = newServiceDraft();
    options.draft.value = draft;
    initialNewServiceEndpoint = draft.endpoints[0] ?? null;
    options.frameworkMenuOpen.value = false;
    options.editingServiceId.value = null;
    options.addPosition.value = { ...position };
    options.dialogOpen.value = true;
  }

  function editService(id: string) {
    const service = options.services().find((item) => item.id === id);
    if (!service) return false;
    options.frameworkMenuOpen.value = false;
    initialNewServiceEndpoint = null;
    options.editingServiceId.value = id;
    options.draft.value = {
      name: service.name,
      framework: options.frameworkLabel(service.framework),
      baseUrl: service.baseUrl,
      active: service.active,
      endpoints: service.endpoints.map((endpoint) => ({
        ...endpoint,
        apiType: "REST",
        method: endpoint.method as EndpointDraft["method"],
      })),
    };
    options.dialogOpen.value = true;
    return true;
  }

  function openServiceEndpoint(endpointId: string) {
    return options
      .services()
      .find((service) => service.endpoints.some((endpoint) => endpoint.id === endpointId))?.id;
  }

  function addEndpoint() {
    options.draft.value.endpoints.push({ name: "", apiType: "REST", method: "GET", url: "/" });
  }

  function removeEndpoint(index: number) {
    options.draft.value.endpoints.splice(index, 1);
  }

  async function importOpenApiFile(file: File) {
    try {
      const result = await parseOpenApiEndpoints(await file.text(), options.draft.value.endpoints);
      const starter = initialNewServiceEndpoint;
      if (
        result.endpoints.length &&
        starter &&
        options.draft.value.endpoints.includes(starter) &&
        !starter.id &&
        !starter.name.trim() &&
        starter.apiType === "REST" &&
        starter.method === "GET" &&
        starter.url === "/"
      ) {
        options.draft.value.endpoints.splice(options.draft.value.endpoints.indexOf(starter), 1);
      }
      if (result.endpoints.length) initialNewServiceEndpoint = null;
      options.draft.value.endpoints.push(...result.endpoints);
      options.onImportWarnings(result.warnings);
      return result;
    } catch (cause) {
      options.onError(cause instanceof Error ? cause.message : "Could not import OpenAPI document");
      return undefined;
    }
  }

  async function saveService() {
    if (!options.draft.value.framework.trim()) {
      options.onError("Select a framework before saving the service");
      return;
    }

    options.onError("");
    try {
      await options.saveCanvas();
      const body = options.editingServiceId.value
        ? options.draft.value
        : {
            ...options.draft.value,
            positionX: options.addPosition.value.x,
            positionY: options.addPosition.value.y,
          };
      if (options.editingServiceId.value)
        await options.apiClient.updateService(options.editingServiceId.value, body);
      else await options.apiClient.createService(body);
      options.closeSettings();
      await options.loadCanvas();
      await options.saveCanvas();
    } catch (cause) {
      options.onError(cause instanceof Error ? cause.message : "Could not save service");
    }
  }

  async function deleteService(id: string, confirmDelete: () => boolean) {
    if (!confirmDelete()) return;
    try {
      await options.saveCanvas();
      await options.apiClient.deleteService(id);
      await options.loadCanvas();
      await options.saveCanvas();
    } catch (cause) {
      options.onError(cause instanceof Error ? cause.message : "Could not remove service");
    }
  }

  return {
    newServiceDraft,
    beginAddService,
    editService,
    openServiceEndpoint,
    addEndpoint,
    removeEndpoint,
    importOpenApiFile,
    saveService,
    deleteService,
  };
}
