// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import { defineComponent, h, ref } from "vue";
import LogsPanel from "./LogsPanel.vue";

const nuxtUiStubs = {
  UButton: defineComponent({
    inheritAttrs: false,
    props: { type: String },
    setup(props, { attrs, slots }) {
      return () => h("button", { ...attrs, type: props.type ?? "button" }, slots.default?.());
    },
  }),
  UInput: defineComponent({
    inheritAttrs: false,
    props: { modelValue: String, placeholder: String, ui: Object },
    emits: ["update:modelValue"],
    setup(props, { attrs, emit }) {
      return () =>
        h("input", {
          ...attrs,
          class: props.ui?.base,
          value: props.modelValue,
          placeholder: props.placeholder,
          onInput: (event: Event) =>
            emit("update:modelValue", (event.target as HTMLInputElement).value),
        });
    },
  }),
  UDropdownMenu: defineComponent({
    inheritAttrs: false,
    props: { items: Array, ui: Object },
    setup(props, { slots }) {
      const menuOpen = ref(false);
      return () =>
        h(
          "div",
          {
            onClick: (event: Event) => {
              if (!(event.target instanceof Element) || !event.target.closest("[data-menu-item]")) {
                menuOpen.value = !menuOpen.value;
              }
            },
          },
          [
            slots.default?.(),
            ...(menuOpen.value
              ? [
                  h(
                    "div",
                    { class: props.ui?.content, role: "menu" },
                    (
                      (props.items?.flat() ?? []) as {
                        label: string;
                        class?: string;
                        onSelect?: (event: Event) => void;
                      }[]
                    ).map((item) =>
                      h(
                        "button",
                        {
                          "data-menu-item": "",
                          role: "menuitem",
                          class: ["app__filter-option", item.class],
                          "aria-pressed": String(item.class?.includes("selected")),
                          onClick: (event: Event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            item.onSelect?.(event);
                          },
                        },
                        item.label,
                      ),
                    ),
                  ),
                ]
              : []),
          ],
        );
    },
  }),
};

function mountPanel(props: Record<string, unknown>) {
  return mount(LogsPanel, { props, global: { components: nuxtUiStubs } });
}

const log = {
  id: 1,
  projectId: "project-1",
  traceId: "trace-1",
  serviceName: "Orders",
  severity: "ERROR",
  timestamp: "2025-01-01T00:00:00.000Z",
  message: "Rejected order",
  attributes: {},
  receivedAt: "2025-01-01T00:00:00.000Z",
};

describe("LogsPanel", () => {
  it("renders log rows and opens from its toolbar button", async () => {
    const wrapper = mountPanel({
      open: false,
      search: "",
      serviceFilter: [],
      severityFilter: [],
      logs: [log],
      services: [{ name: "Orders" }],
      height: 280,
      formatTime: () => "12:00:00",
    });
    await wrapper.get(".app__logs-toggle").trigger("click");
    expect(wrapper.emitted("update:open")).toEqual([[true]]);
    expect(wrapper.text()).toContain("Logs");
  });

  it("renders entries, filters, refresh, close, and adjustable resize controls", async () => {
    const wrapper = mountPanel({
      open: true,
      search: "",
      serviceFilter: [],
      severityFilter: [],
      logs: [log],
      services: [{ name: "Orders" }, { name: "Inventory" }],
      height: 320,
      formatTime: () => "12:00:00",
    });
    expect(wrapper.text()).toContain("Rejected order");
    await wrapper.get('[aria-label="Filter by service"]').trigger("click");
    await wrapper
      .get(".app__log-service-options--service [role=menuitem]:nth-child(3)")
      .trigger("click");
    await wrapper.get('[aria-label="Filter by severity"]').trigger("click");
    await wrapper
      .get(".app__log-service-options--severity [role=menuitem]:nth-child(2)")
      .trigger("click");
    await wrapper.get('[aria-label="Refresh logs"]').trigger("click");
    await wrapper.get('[aria-label="Resize logs panel"]').trigger("keydown", { key: "ArrowUp" });
    await wrapper.get('[aria-label="Close logs"]').trigger("click");

    expect(wrapper.emitted("update:serviceFilter")?.at(-1)?.[0]).toEqual(["Orders"]);
    expect(wrapper.emitted("update:severityFilter")?.at(-1)?.[0]).toEqual(["ERROR"]);
    expect(wrapper.emitted("refresh")).toEqual([[]]);
    expect(wrapper.emitted("adjustHeight")).toEqual([[24]]);
    expect(wrapper.emitted("update:open")?.at(-1)?.[0]).toBe(false);
  });

  it("keeps multi-select menus open and allows clearing the service filter", async () => {
    const wrapper = mountPanel({
      open: true,
      search: "",
      serviceFilter: ["Orders"],
      severityFilter: [],
      logs: [log],
      services: [{ name: "Orders" }, { name: "Inventory" }],
      height: 320,
      formatTime: () => "12:00:00",
    });

    await wrapper.get('[aria-label="Filter by service"]').trigger("click");
    await wrapper
      .get(".app__log-service-options--service [role=menuitem]:nth-child(1)")
      .trigger("click");

    expect(wrapper.emitted("update:serviceFilter")?.at(-1)?.[0]).toEqual([]);
    expect(wrapper.find(".app__log-service-options").exists()).toBe(true);
  });
});
