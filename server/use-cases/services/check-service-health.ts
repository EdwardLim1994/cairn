import type { ServiceHealthResponse } from "#shared/api/services";
import { getOutboundUrl } from "../../utils/outbound-url";

function healthPath(framework: string) {
  if (framework === "spring boot") return "/actuator/health";
  if (framework.includes(".net")) return "/health";
  return null;
}

export function createCheckServiceHealthUseCase(dependencies: {
  ensureProject: () => Promise<string>;
  listHealthTargets: (
    projectId: string,
  ) => Promise<Array<{ id: string; framework: string; baseUrl: string }>>;
  fetch: typeof globalThis.fetch;
}) {
  return async (): Promise<ServiceHealthResponse> => {
    const services = await dependencies.listHealthTargets(await dependencies.ensureProject());
    return Promise.all(
      services.map(async (service) => {
        const framework = service.framework.toLowerCase();
        const path = healthPath(framework);
        if (!path) return { id: service.id, online: false };
        try {
          const response = await dependencies.fetch(getOutboundUrl(path, service.baseUrl), {
            signal: AbortSignal.timeout(2000),
          });
          return { id: service.id, online: response.ok };
        } catch {
          return { id: service.id, online: false };
        }
      }),
    );
  };
}
