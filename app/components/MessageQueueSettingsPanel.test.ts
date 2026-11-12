// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import { defineComponent, h } from "vue";
import type { CanvasGetResponse } from "#shared/api/canvas";
import MessageQueueSettingsPanel from "./MessageQueueSettingsPanel.vue";

type Destination = CanvasGetResponse["messageDestinations"][number];
const destination = {
  id: "destination-1",
  projectId: "project-1",
  queueId: "old-shared-queue",
  queueName: "Legacy Queue",
  codeKey: "orders-created",
  broker: "rabbitmq" as const,
  name: "orders.created",
  connection: { host: "rabbit.local", port: 5671, virtualHost: "/events", tls: true },
  x: 300,
  y: 220,
  health: true,
} satisfies Destination;

const components = {
  USlideover: defineComponent({
    props: { ui: Object },
    setup(props, { slots }) {
      return () =>
        h("aside", { class: props.ui?.content }, [
          h("header", [...(slots.header?.() ?? [])]),
          ...(slots.body?.() ?? []),
          ...(slots.footer?.() ?? []),
        ]);
    },
  }),
  UButton: defineComponent({
    inheritAttrs: false,
    props: { type: String, disabled: Boolean },
    setup(props, { attrs, slots }) {
      return () =>
        h(
          "button",
          { ...attrs, type: props.type ?? "button", disabled: props.disabled },
          slots.default?.(),
        );
    },
  }),
  UInput: defineComponent({
    inheritAttrs: false,
    props: { modelValue: String },
    emits: ["update:modelValue"],
    setup(props, { attrs, emit }) {
      return () =>
        h("input", {
          ...attrs,
          value: props.modelValue,
          onInput: (event: Event) =>
            emit("update:modelValue", (event.target as HTMLInputElement).value),
        });
    },
  }),
  USelect: defineComponent({
    inheritAttrs: false,
    props: { modelValue: String, items: Array },
    emits: ["update:modelValue"],
    setup(props, { attrs, emit }) {
      return () =>
        h(
          "select",
          {
            ...attrs,
            value: props.modelValue,
            onChange: (event: Event) =>
              emit("update:modelValue", (event.target as HTMLSelectElement).value),
          },
          props.items?.map((item) => {
            const option = item as { label: string; value: string };
            return h("option", { value: option.value }, option.label);
          }),
        );
    },
  }),
  UIcon: defineComponent({ setup: () => () => h("span", { "aria-hidden": "true" }) }),
};

function mountPanel(overrides: Partial<{ destination: Destination | null; open: boolean }> = {}) {
  return mount(MessageQueueSettingsPanel, {
    props: {
      open: true,
      destination: null,
      position: { x: 160, y: 120 },
      projectId: "project-1",
      ...overrides,
    },
    global: { components, stubs: { DialogTitle: true, DialogDescription: true } },
  });
}

describe("MessageQueueSettingsPanel", () => {
  it("creates one destination with its own broker connection and canvas position", async () => {
    const wrapper = mountPanel();
    await wrapper.get('[aria-label="Topic or exchange name"]').setValue("orders.created");
    await wrapper.get('[aria-label="Stable code key"]').setValue("orders-created");
    await wrapper.get('[aria-label="Connection URL"]').setValue("localhost:9092");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Create")!
      .trigger("click");

    expect(wrapper.emitted("save")?.[0]?.[0]).toMatchObject({
      projectId: "project-1",
      queueId: expect.any(String),
      codeKey: "orders-created",
      broker: "kafka",
      name: "orders.created",
      connection: { brokers: "localhost:9092" },
      x: 160,
      y: 120,
    });
    expect(wrapper.text()).not.toContain("Topics");
  });

  it("edits one existing destination and retains its RabbitMQ connection values", async () => {
    const wrapper = mountPanel({ destination });

    expect(wrapper.get('[aria-label="Connection URL"]').element).toHaveProperty(
      "value",
      "amqps://rabbit.local:5671/events",
    );
    await wrapper.get('[aria-label="Topic or exchange name"]').setValue("orders.updated");
    await wrapper.get('[aria-label="Stable code key"]').setValue("orders-updated");
    await wrapper.get("button[aria-label='Remove message queue']").trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Save")!
      .trigger("click");

    expect(wrapper.emitted("remove")).toEqual([["destination-1"]]);
    expect(wrapper.emitted("save")?.[0]?.[0]).toMatchObject({
      id: "destination-1",
      queueId: "destination-1",
      name: "orders.updated",
      broker: "rabbitmq",
      connection: {
        host: "rabbit.local",
        port: 5671,
        virtualHost: "/events",
        tls: true,
      },
      x: 300,
      y: 220,
    });
  });

  it("discards without emitting a destination to save", async () => {
    const wrapper = mountPanel({ open: true });
    await wrapper.get('[aria-label="Topic or exchange name"]').setValue("discarded");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Discard")!
      .trigger("click");

    expect(wrapper.emitted("save")).toBeUndefined();
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });
});
