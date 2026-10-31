// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import { defineComponent, h } from "vue";
import ContextMenu from "./ContextMenu.vue";

const UContextMenuStub = defineComponent({
  props: { open: Boolean, items: Array, ui: Object },
  emits: ["update:open"],
  setup(props, { emit, slots }) {
    return () => {
      const menuItems = (props.items?.flat() ?? []) as {
        label: string;
        onSelect: () => void;
      }[];
      return h(
        "div",
        {
          onContextmenu: (event: Event) => {
            event.preventDefault();
            emit("update:open", true);
          },
          onKeydown: (event: KeyboardEvent) => {
            if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
              emit("update:open", true);
            }
          },
        },
        [
          slots.default?.(),
          ...(props.open
            ? [
                ...menuItems.map((item) =>
                  h("button", { role: "menuitem", onClick: item.onSelect }, item.label),
                ),
                h(
                  "button",
                  { "data-outside-close": "", onClick: () => emit("update:open", false) },
                  "Outside",
                ),
              ]
            : []),
        ],
      );
    };
  },
});

describe("ContextMenu", () => {
  it("opens on a context-menu gesture and emits add-service intent", async () => {
    const wrapper = mount(ContextMenu, {
      props: { open: false },
      global: { components: { UContextMenu: UContextMenuStub } },
      slots: { default: "Graph canvas" },
    });
    await wrapper.get("div").trigger("contextmenu");
    expect(wrapper.emitted("update:open")).toEqual([[true]]);
    await wrapper.get('[role="menuitem"]').trigger("click");
    expect(wrapper.emitted("addService")).toEqual([[]]);
  });

  it("forwards keyboard opening and outside dismissal", async () => {
    const keyboardWrapper = mount(ContextMenu, {
      props: { open: false },
      global: { components: { UContextMenu: UContextMenuStub } },
      slots: { default: "Graph canvas" },
    });
    await keyboardWrapper.get("div").trigger("keydown", { key: "F10", shiftKey: true });
    expect(keyboardWrapper.emitted("update:open")).toEqual([[true]]);

    const openWrapper = mount(ContextMenu, {
      props: { open: true },
      global: { components: { UContextMenu: UContextMenuStub } },
      slots: { default: "Graph canvas" },
    });
    await openWrapper.get("[data-outside-close]").trigger("click");
    expect(openWrapper.emitted("update:open")).toEqual([[false]]);
  });
});
