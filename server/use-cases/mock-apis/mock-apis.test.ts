import { describe, expect, it, vi } from "vite-plus/test";
import { MockApiEndpointError, MockApiNotFoundError } from "../../repositories/mock-apis/errors";
import { createCreateMockApiUseCase } from "./create-mock-api";
import { createDeleteMockApiUseCase } from "./delete-mock-api";
import { createListMockApisUseCase } from "./list-mock-apis";
import { createUpdateMockApiUseCase } from "./update-mock-api";

const mockInput = {
  name: "Get order",
  targetEndpointId: "endpoint-1",
  pathParameters: { orderId: "123" },
  requestJson: {},
  description: "",
};

describe("mock API endpoint use cases", () => {
  it("lists mock APIs for the current project", async () => {
    const listMockApis = vi.fn().mockResolvedValue([{ id: "mock-1" }]);
    const useCase = createListMockApisUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      listMockApis,
    });
    await expect(useCase()).resolves.toEqual([{ id: "mock-1" }]);
    expect(listMockApis).toHaveBeenCalledWith("project-1");
  });

  it("creates a mock API when its endpoint and path parameters match", async () => {
    const createMockApi = vi.fn().mockResolvedValue(undefined);
    const useCase = createCreateMockApiUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      findMockApiEndpoint: vi
        .fn()
        .mockResolvedValue({ id: "endpoint-1", url: "/orders/{orderId}" }),
      createMockApi,
      newId: () => "mock-1",
    });
    await expect(useCase(mockInput)).resolves.toEqual({ id: "mock-1" });
    expect(createMockApi).toHaveBeenCalledWith("mock-1", "project-1", mockInput);
  });

  it("rejects endpoints that do not belong to the project", async () => {
    const useCase = createCreateMockApiUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      findMockApiEndpoint: vi.fn().mockResolvedValue(undefined),
      createMockApi: vi.fn(),
    });
    await expect(useCase(mockInput)).rejects.toBeInstanceOf(MockApiEndpointError);
  });

  it("updates a mock API after checking its endpoint ownership", async () => {
    const updateMockApi = vi.fn().mockResolvedValue(undefined);
    const useCase = createUpdateMockApiUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      findMockApi: vi.fn().mockResolvedValue(true),
      findMockApiEndpoint: vi
        .fn()
        .mockResolvedValue({ id: "endpoint-1", url: "/orders/{orderId}" }),
      updateMockApi,
    });
    await expect(useCase("mock-1", mockInput)).resolves.toEqual({ id: "mock-1" });
    expect(updateMockApi).toHaveBeenCalledWith("mock-1", "project-1", mockInput);
  });

  it("rejects missing APIs and unknown endpoint path parameters", async () => {
    const missingUseCase = createUpdateMockApiUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      findMockApi: vi.fn().mockResolvedValue(false),
      findMockApiEndpoint: vi.fn(),
      updateMockApi: vi.fn(),
    });
    await expect(missingUseCase("missing", mockInput)).rejects.toBeInstanceOf(MockApiNotFoundError);
    const invalidPathUseCase = createCreateMockApiUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      findMockApiEndpoint: vi.fn().mockResolvedValue({ id: "endpoint-1", url: "/orders/{id}" }),
      createMockApi: vi.fn(),
    });
    await expect(invalidPathUseCase(mockInput)).rejects.toThrow("Unknown path parameter: orderId");
  });

  it("deletes a mock API and reports missing ids", async () => {
    const deleteMockApi = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const useCase = createDeleteMockApiUseCase({
      ensureProject: vi.fn().mockResolvedValue("project-1"),
      deleteMockApi,
    });
    await expect(useCase("mock-1")).resolves.toEqual({ id: "mock-1" });
    await expect(useCase("missing")).rejects.toBeInstanceOf(MockApiNotFoundError);
  });
});
