// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vite-plus/test";
import { defineComponent, h, nextTick, ref } from "vue";
import { deferredPanel } from "../deferredPanel";

describe("deferredPanel", () => {
  it("loads the panel only on first open and shows a loading state", async () => {
    let resolve!: (value: { default: ReturnType<typeof defineComponent> }) => void;
    const loader = vi.fn(
      () =>
        new Promise<{ default: ReturnType<typeof defineComponent> }>((done) => {
          resolve = done;
        }),
    );
    const Panel = deferredPanel(loader);
    const open = ref(false);
    const wrapper = mount(
      defineComponent({
        setup: () => () => h("main", open.value ? [h(Panel)] : []),
      }),
    );

    expect(loader).not.toHaveBeenCalled();
    open.value = true;
    await nextTick();
    expect(loader).toHaveBeenCalledOnce();
    expect(wrapper.get('[role="status"]').text()).toBe("Loading panel...");

    resolve({ default: defineComponent({ setup: () => () => h("section", "Loaded panel") }) });
    await flushPromises();
    expect(wrapper.text()).toBe("Loaded panel");
  });
});
