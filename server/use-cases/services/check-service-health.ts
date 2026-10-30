import type { ServiceHealthResponse } from "#shared/api/services";
import { getOutboundUrl } from "../../utils/outbound-url";

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
        const healthPath =
          framework === "spring boot"
            ? "/actuator/health"
            : framework.includes(".net")
              ? "/health"
              : null;
        if (!healthPath) return { id: service.id, online: false };
        try {
          const response = await dependencies.fetch(getOutboundUrl(healthPath, service.baseUrl), {
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
