// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import { defineComponent, h } from "vue";
import WorkspaceDrawer from "../WorkspaceDrawer.vue";

const SlideoverStub = defineComponent({
  props: { open: Boolean, side: String, portal: Boolean, modal: Boolean, ui: Object },
  emits: ["update:open"],
  setup(props, { emit, slots }) {
    return () =>
      h("aside", { "data-side": props.side, "data-content-class": String(props.ui?.content) }, [
        slots.header?.(),
        slots.body?.(),
        slots.footer?.(),
        h("button", { "aria-label": "Dismiss overlay", onClick: () => emit("update:open", false) }),
      ]);
  },
});

const ButtonStub = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h("button", attrs, slots.default?.());
  },
});
const TextStub = defineComponent({
  setup(_, { slots }) {
    return () => h("span", slots.default?.());
  },
});

function mountDrawer() {
  return mount(WorkspaceDrawer, {
    props: { open: true },
    slots: {
      title: "Settings",
      description: "Edit settings",
      actions: "Save",
      body: "Form body",
      footer: "Discard",
    },
    global: {
      components: { USlideover: SlideoverStub, UButton: ButtonStub },
      stubs: { DialogTitle: TextStub, DialogDescription: TextStub, UIcon: true },
    },
  });
}

describe("WorkspaceDrawer", () => {
  it("keeps the right-side placement and slot order", () => {
    const wrapper = mountDrawer();
    const drawer = wrapper.get("aside");
    expect(drawer.attributes("data-side")).toBe("right");
    expect(drawer.attributes("data-content-class")).toContain("!top-[96px]");
    expect(drawer.attributes("data-content-class")).toContain("!h-[calc(100dvh-108px)]");
    expect(drawer.attributes("data-content-class")).toContain("max-[720px]:!top-[80px]");
    expect(drawer.attributes("data-content-class")).toContain("max-[720px]:!h-[calc(100dvh-88px)]");
    expect(drawer.text()).toMatch(/Settings.*Edit settings.*Save.*Form body.*Discard/);
  });

  it("emits dismissal from the close control and slideover", async () => {
    const wrapper = mountDrawer();
    await wrapper.get('[aria-label="Close panel"]').trigger("click");
    await wrapper.get('[aria-label="Dismiss overlay"]').trigger("click");
    expect(wrapper.emitted("update:open")).toEqual([[false], [false]]);
  });
});
