import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import type { CanvasGetResponse } from "#shared/api/canvas";
import { useServiceStore } from "../model/store";

describe("service entity store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("replaces the canonical service snapshot on canvas refresh", () => {
    const store = useServiceStore();
    const before = [{ id: "service-1", name: "Before" }] as CanvasGetResponse["services"];
    const after = [{ id: "service-1", name: "After" }] as CanvasGetResponse["services"];
    store.setServices(before);
    store.setServices(after);
    expect(store.services).toEqual(after);
  });
});
