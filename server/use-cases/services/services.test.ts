import { describe, expect, it, vi } from "vite-plus/test";
import { createCheckServiceHealthUseCase } from "./check-service-health";
import { createCreateServiceUseCase } from "./create-service";
import { createDeleteServiceUseCase } from "./delete-service";
import { createListServicesUseCase } from "./list-services";
import { createUpdateServiceUseCase } from "./update-service";

const serviceInput = {
  name: "Orders",
  framework: "Spring Boot",
  baseUrl: "http://localhost:8081",
  active: true,
  endpoints: [],
};

describe("service endpoint use cases", () => {
  it("lists services for the current project", async () => {
    const listServices = vi.fn().mockResolvedValue([{ id: "service-1" }]);
    const useCase = createListServicesUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      listServices,
    });
    await expect(useCase()).resolves.toEqual([{ id: "service-1" }]);
    expect(listServices).toHaveBeenCalledWith("project-1");
  });

  it("creates a service using an injectable identifier", async () => {
    const createService = vi.fn().mockResolvedValue(undefined);
    const useCase = createCreateServiceUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      createService,
      newId: () => "service-1",
    });
    await expect(useCase(serviceInput)).resolves.toEqual({ id: "service-1" });
    expect(createService).toHaveBeenCalledWith("project-1", "service-1", serviceInput);
  });

  it("updates a service and returns the repository result", async () => {
    const updateService = vi.fn().mockResolvedValue("updated");
    const useCase = createUpdateServiceUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      updateService,
    });
    await expect(useCase("service-1", serviceInput)).resolves.toBe("updated");
    expect(updateService).toHaveBeenCalledWith("project-1", "service-1", serviceInput);
  });

  it("deletes a service and reports a missing service", async () => {
    const deleteService = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const useCase = createDeleteServiceUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      deleteService,
    });
    await expect(useCase("service-1")).resolves.toEqual({ id: "service-1" });
    await expect(useCase("missing")).resolves.toBeNull();
  });

  it("checks supported frameworks and treats failures as offline", async () => {
    const listHealthTargets = vi.fn().mockResolvedValue([
      { id: "spring", framework: "Spring Boot", baseUrl: "http://localhost:8081" },
      { id: "dotnet", framework: ".NET", baseUrl: "http://localhost:8082" },
      { id: "unknown", framework: "Unknown", baseUrl: "http://localhost:8083" },
    ]);
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error("unavailable"));
    const useCase = createCheckServiceHealthUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      listHealthTargets,
      fetch,
    });
    await expect(useCase()).resolves.toEqual([
      { id: "spring", online: true },
      { id: "dotnet", online: false },
      { id: "unknown", online: false },
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
