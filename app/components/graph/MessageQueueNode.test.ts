// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import { defineComponent, h } from "vue";
import MessageQueueNode from "./MessageQueueNode.vue";

const HandleStub = defineComponent({
  props: { id: String, connectable: Boolean },
  setup(props) {
    return () => h("span", { "data-handle": props.id, "data-connectable": props.connectable });
  },
});

const data = {
  name: "Order Events",
  destinations: [
    { id: "orders", name: "Orders", broker: "kafka" as const },
    { id: "invoices", name: "Invoices", broker: "kafka" as const },
  ],
  online: true,
};

describe("MessageQueueNode", () => {
  it("bundles topics and their handles when service nodes are collapsed", () => {
    const wrapper = mount(MessageQueueNode, {
      props: { data: { ...data, topicsCollapsed: true } },
      global: { stubs: { Handle: HandleStub } },
    });

    expect(wrapper.text()).toContain("2 topics · connections bundled");
    expect(wrapper.text()).not.toContain("Orders");
    expect(wrapper.text()).not.toContain("Invoices");
    expect(wrapper.text()).toContain("Order Events");
    expect(wrapper.findAll("[data-handle]")).toHaveLength(4);
    expect(wrapper.findAll('[data-connectable="false"]')).toHaveLength(4);
  });

  it("shows each topic row when service nodes are expanded", () => {
    const wrapper = mount(MessageQueueNode, {
      props: { data: { ...data, topicsCollapsed: false } },
      global: { stubs: { Handle: HandleStub } },
    });

    expect(wrapper.text()).toContain("Orders");
    expect(wrapper.text()).toContain("Invoices");
    expect(wrapper.findAll("[data-handle]")).toHaveLength(4);
  });
});
