// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import { defineComponent, h } from "vue";
import MessageQueueSettingsPanel from "./MessageQueueSettingsPanel.vue";

const uiStubs = {
  USlideover: defineComponent({
    props: { open: Boolean, side: String, portal: Boolean, close: [Boolean, Object], ui: Object },
    emits: ["update:open"],
    setup(_, { slots }) {
      return () =>
        h("aside", [slots.title?.(), slots.description?.(), slots.body?.(), slots.footer?.()]);
    },
  }),
  UButton: defineComponent({
    setup(_, { attrs, slots }) {
      return () => h("button", attrs, slots.default?.());
    },
  }),
  UInput: defineComponent({
    inheritAttrs: true,
    props: { modelValue: String },
    setup(props, { attrs }) {
      return () => h("input", { ...attrs, value: props.modelValue });
    },
  }),
  USelect: defineComponent({
    setup(_, { attrs }) {
      return () => h("select", attrs);
    },
  }),
  SettingsAccordionCard: defineComponent({
    props: { title: String, subtitle: String },
    emits: ["toggle", "delete"],
    setup(props, { slots }) {
      return () =>
        h("article", [h("strong", props.title), h("span", props.subtitle), slots.default?.()]);
    },
  }),
  UAccordion: defineComponent({
    setup(_, { slots }) {
      return () => h("div", [slots.default?.(), slots.body?.()]);
    },
  }),
  UIcon: defineComponent({ template: "<span />" }),
};

describe("MessageQueueSettingsPanel", () => {
  it("shows shared broker settings and saves the topic list", async () => {
    const wrapper = mount(MessageQueueSettingsPanel, {
      props: {
        open: true,
        destinations: [
          {
            id: "orders-topic",
            projectId: "project-1",
            codeKey: "orders",
            broker: "kafka",
            name: "Orders",
            connection: { brokers: "localhost:9092", securityProtocol: "PLAINTEXT" },
            x: 200,
            y: 100,
            health: true,
          },
        ],
      },
      global: { components: uiStubs },
    });

    expect(wrapper.text()).toContain("Orders");
    expect(wrapper.findAll("output")).toHaveLength(0);
    expect(wrapper.find('[aria-label="Message queue type"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Message queue name"]').exists()).toBe(true);
    expect(
      (wrapper.get('[aria-label="Message queue URL"]').element as HTMLInputElement).value,
    ).toBe("localhost:9092");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Save")
      ?.trigger("click");
    expect(wrapper.emitted("save")?.[0]).toMatchObject([
      "legacy-queue",
      [{ id: "orders-topic", broker: "kafka", connection: { brokers: "localhost:9092" } }],
    ]);
  });

  it("adds a new topic card from the New button", async () => {
    const wrapper = mount(MessageQueueSettingsPanel, {
      props: { open: true, destinations: [] },
      global: { components: uiStubs },
    });

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "New")
      ?.trigger("click");
    expect(wrapper.text()).toContain("Topic 1");
    expect(wrapper.find('[aria-label="Topic 1 name"]').exists()).toBe(true);
  });
});
