import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import type { CanvasGetResponse } from "#shared/api/canvas";
import { useMessageDestinationStore } from "../model/store";

describe("message destination entity store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("replaces the canonical destination snapshot on canvas refresh", () => {
    const store = useMessageDestinationStore();
    const before = [{ id: "queue-1", name: "Before" }] as CanvasGetResponse["messageDestinations"];
    const after = [{ id: "queue-1", name: "After" }] as CanvasGetResponse["messageDestinations"];
    store.setMessageDestinations(before);
    store.setMessageDestinations(after);
    expect(store.messageDestinations).toEqual(after);
  });
});
