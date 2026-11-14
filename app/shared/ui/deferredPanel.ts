import { defineAsyncComponent, defineComponent, h, type Component } from "vue";

const LoadingPanel = defineComponent({
  setup: () => () =>
    h(
      "div",
      {
        role: "status",
        class: "app__surface absolute left-3 top-[82px] z-50 rounded-lg px-3 py-2 text-xs",
      },
      "Loading panel...",
    ),
});

export function deferredPanel(loader: () => Promise<{ default: Component }>) {
  return defineAsyncComponent({
    loader: async () => (await loader()).default,
    loadingComponent: LoadingPanel,
    delay: 0,
  });
}
