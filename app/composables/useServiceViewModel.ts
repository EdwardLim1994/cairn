import type { Ref } from "vue";
import type { createApiClient } from "../models/api-client";
import type { GraphService } from "../models/graph";
import { parseOpenApiEndpoints, type ServiceEndpointDraft } from "../utils/openapi-import";

type ApiClient = ReturnType<typeof createApiClient>;
type EndpointDraft = ServiceEndpointDraft & { requestJson?: unknown };
export type ServiceDraft = {
  name: string;
  apiType: "REST" | "GRPC" | "WEBSOCKET";
  framework: string;
  baseUrl: string;
  grpcTls: boolean;
  protoContent: string | null;
  protoFileName: string | null;
  clearProto: boolean;
  healthCheckUrl: string | null;
  healthCheckHeaderTemplateId: string | null;
  healthCheckCustomHeaders: Array<{ name: string; value: string }>;
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

function newServiceDraft(): ServiceDraft {
  return {
    name: "",
    apiType: "REST",
    framework: "",
    baseUrl: "http://localhost:3000",
    grpcTls: false,
    protoContent: null,
    protoFileName: null,
    clearProto: false,
    healthCheckUrl: null,
    healthCheckHeaderTemplateId: null,
    healthCheckCustomHeaders: [],
    active: true,
    endpoints: [{ name: "", method: "GET", url: "/" }],
  };
}

export function useServiceViewModel(options: ServiceViewModelOptions) {
  let initialNewServiceEndpoint: EndpointDraft | null = null;

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
      apiType: service.apiType,
      framework: options.frameworkLabel(service.framework),
      baseUrl: service.baseUrl,
      grpcTls: service.grpcTls,
      protoContent: null,
      protoFileName: service.protoFileName,
      clearProto: false,
      healthCheckUrl: service.healthCheckUrl,
      healthCheckHeaderTemplateId: service.healthCheckHeaderTemplateId,
      healthCheckCustomHeaders: service.healthCheckCustomHeaders.map((header) => ({ ...header })),
      active: service.active,
      endpoints: service.endpoints.map((endpoint) => ({
        ...endpoint,
        method: endpoint.method as EndpointDraft["method"],
        url: endpoint.url ?? undefined,
        rpcMethod: endpoint.rpcMethod ?? undefined,
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
    const apiType = options.draft.value.apiType;
    options.draft.value.endpoints.push(
      apiType === "GRPC"
        ? { name: "", rpcMethod: "" }
        : apiType === "WEBSOCKET"
          ? { name: "", url: options.draft.value.baseUrl }
          : { name: "", method: "GET", url: "/" },
    );
  }

  function removeEndpoint(index: number) {
    options.draft.value.endpoints.splice(index, 1);
  }

  async function importOpenApiFile(file: File) {
    if (options.draft.value.apiType !== "REST") return;
    try {
      const result = await parseOpenApiEndpoints(await file.text(), options.draft.value.endpoints);
      const starter = initialNewServiceEndpoint;
      if (
        result.endpoints.length &&
        starter &&
        options.draft.value.endpoints.includes(starter) &&
        !starter.id &&
        !starter.name.trim() &&
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

  async function importProtoFile(file: File) {
    if (options.draft.value.apiType !== "GRPC") return;
    try {
      const content = await file.text();
      const result = await options.apiClient.parseProto(content);
      if (result.unresolvedImports.length) {
        options.onError(`Proto imports are not supported: ${result.unresolvedImports.join(", ")}`);
        return undefined;
      }
      if (!result.methods.length) {
        options.onError("Proto file contains no unary methods");
        options.onImportWarnings(
          result.streamingMethods.map((method) => `Skipped streaming method ${method}.`),
        );
        return undefined;
      }
      const existing = new Set(
        options.draft.value.endpoints.flatMap((endpoint) =>
          endpoint.rpcMethod ? [endpoint.rpcMethod] : [],
        ),
      );
      const warnings = result.streamingMethods.map(
        (method) => `Skipped streaming method ${method}.`,
      );
      const imported = result.methods.filter((method) => {
        if (!existing.has(method.rpcMethod)) return true;
        warnings.push(
          `Skipped duplicate ${method.rpcMethod}: this endpoint is already registered.`,
        );
        return false;
      });
      const starter = initialNewServiceEndpoint;
      if (
        imported.length &&
        starter &&
        options.draft.value.endpoints.includes(starter) &&
        !starter.id &&
        !starter.name.trim() &&
        !starter.rpcMethod
      ) {
        options.draft.value.endpoints.splice(options.draft.value.endpoints.indexOf(starter), 1);
      }
      options.draft.value.endpoints.push(...imported);
      options.draft.value.protoContent = content;
      options.draft.value.protoFileName = file.name;
      options.draft.value.clearProto = false;
      initialNewServiceEndpoint = null;
      options.onError("");
      options.onImportWarnings(warnings);
      return result;
    } catch (cause) {
      options.onError(cause instanceof Error ? cause.message : "Could not import proto file");
      return undefined;
    }
  }

  function removeProtoFile() {
    options.draft.value.protoContent = null;
    options.draft.value.protoFileName = null;
    options.draft.value.clearProto = Boolean(options.editingServiceId.value);
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
    if (!confirmDelete()) return false;
    try {
      await options.saveCanvas();
      await options.apiClient.deleteService(id);
      await options.loadCanvas();
      await options.saveCanvas();
      return true;
    } catch (cause) {
      options.onError(cause instanceof Error ? cause.message : "Could not remove service");
      return false;
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
    importProtoFile,
    removeProtoFile,
    saveService,
    deleteService,
  };
}
