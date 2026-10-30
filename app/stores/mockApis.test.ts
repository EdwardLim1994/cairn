import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { useMockApiStore } from "./mockApis";

describe("mock API store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("sets mock APIs, drafts, variables, and saved snapshots", () => {
    const store = useMockApiStore();
    const variable = { id: "variable-1", name: "TOKEN", value: "secret" };
    const draft = {
      name: "Fetch orders",
      targetEndpointId: "endpoint-1",
      description: "",
      requestJson: "{}",
      pathParameters: {},
    };
    store.setMockApis([]);
    store.setMockDraft([draft]);
    store.setEnvironmentVariables([variable]);
    store.setSavedEnvironmentVariableIds([variable.id]);
    store.setSavedEnvironmentVariableValues({
      [variable.id]: { name: variable.name, value: variable.value },
    });

    expect(store.mockApis).toEqual([]);
    expect(store.mockDraft).toEqual([draft]);
    expect(store.environmentVariables).toEqual([variable]);
    expect(store.savedEnvironmentVariableIds).toEqual([variable.id]);
    expect(store.savedEnvironmentVariableValues[variable.id]).toEqual({
      name: "TOKEN",
      value: "secret",
    });
  });

  it("adds and removes mock drafts and deletes variables by id", () => {
    const store = useMockApiStore();
    const draft = {
      name: "Fetch orders",
      targetEndpointId: "endpoint-1",
      description: "",
      requestJson: "{}",
      pathParameters: {},
    };
    store.addMockDraft(draft);
    store.addMockDraft({ ...draft, name: "Create order" });
    store.setEnvironmentVariables([
      { id: "keep", name: "KEEP", value: "1" },
      { id: "remove", name: "REMOVE", value: "2" },
    ]);
    store.removeMockDraft(0);
    store.deleteEnvironmentVariable("remove");
    store.setMockApis([]);

    expect(store.mockDraft.map(({ name }) => name)).toEqual(["Create order"]);
    expect(store.environmentVariables.map(({ id }) => id)).toEqual(["keep"]);
    expect(store.mockApis).toEqual([]);
  });

  it("tracks running API state and stores or clears run results", () => {
    const store = useMockApiStore();
    const result = {
      id: "run-1",
      traceId: "trace-1",
      status: "completed",
      responseStatus: 200,
      responseBody: "{}",
      error: null,
    };
    store.setRunningMockId("mock-1");
    store.setRunResult("mock-1", result);
    expect(store.runningMockId).toBe("mock-1");
    expect(store.runResults["mock-1"]).toEqual(result);
    store.setRunningMockId(null);
    store.clearRunResults();
    expect(store.runningMockId).toBeNull();
    expect(store.runResults).toEqual({});
  });
});
