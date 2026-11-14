// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import { defineComponent, h } from "vue";
import MessageQueueNode from "../ui/MessageQueueNode.vue";

const HandleStub = defineComponent({
  props: { id: String, connectable: Boolean },
  setup(props) {
    return () => h("span", { "data-handle": props.id, "data-connectable": props.connectable });
  },
});

const data = {
  destinationId: "destination-1",
  name: "Order Events",
  destinations: [{ id: "orders", name: "Orders", broker: "kafka" as const }],
  online: true,
};

describe("MessageQueueNode", () => {
  it("keeps the destination's handles when its node is collapsed", () => {
    const wrapper = mount(MessageQueueNode, {
      props: { data: { ...data, topicsCollapsed: true } },
      global: { stubs: { Handle: HandleStub } },
    });

    expect(wrapper.text()).toContain("Queue connections bundled");
    expect(wrapper.text()).not.toContain("Orders");
    expect(wrapper.text()).toContain("Order Events");
    expect(wrapper.text()).toContain("Kafka topic");
    expect(wrapper.findAll("[data-handle]")).toHaveLength(2);
    expect(wrapper.findAll('[data-connectable="false"]')).toHaveLength(2);
  });

  it("shows the individual destination row when expanded", () => {
    const wrapper = mount(MessageQueueNode, {
      props: { data: { ...data, topicsCollapsed: false } },
      global: { stubs: { Handle: HandleStub } },
    });

    expect(wrapper.text()).toContain("Orders");
    expect(wrapper.findAll("[data-handle]")).toHaveLength(2);
  });

  it("emits the queue identity from its edit action", async () => {
    const wrapper = mount(MessageQueueNode, {
      props: { data: { ...data, topicsCollapsed: false } },
      global: { stubs: { Handle: HandleStub, UIcon: true } },
    });

    await wrapper.get('[aria-label="Edit Order Events"]').trigger("click");

    expect(wrapper.emitted("edit")).toEqual([["destination-1"]]);
  });
});
