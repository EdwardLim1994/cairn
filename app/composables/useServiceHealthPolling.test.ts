// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { defineComponent, h } from "vue";
import {
  SERVICE_HEALTH_POLL_INTERVAL_MS,
  useServiceHealthPolling,
} from "./useServiceHealthPolling";

describe("useServiceHealthPolling", () => {
  afterEach(() => vi.useRealTimers());

  it("polls every 60 seconds and stops when its owner unmounts", () => {
    vi.useFakeTimers();
    const checkHealth = vi.fn();
    let start = () => {};
    const wrapper = mount(
      defineComponent({
        setup() {
          start = useServiceHealthPolling(checkHealth).start;
          return () => h("div");
        },
      }),
    );

    expect(SERVICE_HEALTH_POLL_INTERVAL_MS).toBe(60_000);
    start();
    vi.advanceTimersByTime(59_999);
    expect(checkHealth).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(checkHealth).toHaveBeenCalledTimes(1);

    wrapper.unmount();
    vi.advanceTimersByTime(120_000);
    expect(checkHealth).toHaveBeenCalledTimes(1);
  });
});
