import { describe, expect, it, vi } from "vite-plus/test";
import { nextTick, ref } from "vue";
import { useMockApiHistory } from "../model/useMockApiHistory";

describe("useMockApiHistory", () => {
  it("fetches history when opened and keeps it closed on initial load", async () => {
    const open = ref(false);
    const list = vi.fn(async () => []);
    const history = useMockApiHistory({
      open,
      apiClient: { listMockApiCallHistory: list } as never,
      replay: vi.fn(async () => {}),
      stopReplay: vi.fn(),
      clearObservations: vi.fn(),
      onError: vi.fn(),
    });
    expect(list).not.toHaveBeenCalled();
    open.value = true;
    await nextTick();
    expect(list).toHaveBeenCalledOnce();
    expect(history.entries.value).toEqual([]);
  });
});
