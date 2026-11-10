// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import { defineComponent, h } from "vue";
import type { GraphService } from "../models/graph";
import type { CanvasGetResponse } from "#shared/api/canvas";
import ManageNodesPanel from "./ManageNodesPanel.vue";

const services = [{ id: "service-1", name: "Orders", framework: "Spring Boot" }] as GraphService[];
const destinations = [
  { id: "destination-1", name: "orders.created", broker: "kafka" },
] as unknown as CanvasGetResponse["messageDestinations"];

const components = {
  WorkspaceDrawer: defineComponent({
    props: { open: Boolean },
    setup(props, { slots }) {
      return () => (props.open ? h("aside", [slots.title?.(), slots.body?.()]) : null);
    },
  }),
  UButton: defineComponent({
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h("button", attrs, slots.default?.());
    },
  }),
};

describe("ManageNodesPanel", () => {
  it("lists individual items and emits edit and create actions", async () => {
    const wrapper = mount(ManageNodesPanel, {
      props: { open: true, services, destinations },
      global: {
        components: { UButton: components.UButton },
        stubs: { WorkspaceDrawer: components.WorkspaceDrawer, UIcon: true },
      },
    });

    expect(wrapper.text()).toContain("Orders");
    expect(wrapper.text()).toContain("orders.created");
    await wrapper.get('[aria-label="Services"] button').trigger("click");
    await wrapper.get('[aria-label="Edit Orders"]').trigger("click");
    await wrapper.get('[aria-label="Message queues"] button').trigger("click");
    await wrapper.get('[aria-label="Edit orders.created"]').trigger("click");

    expect(wrapper.emitted("add-service")).toEqual([[]]);
    expect(wrapper.emitted("edit-service")).toEqual([["service-1"]]);
    expect(wrapper.emitted("add-queue")).toEqual([[]]);
    expect(wrapper.emitted("edit-destination")).toEqual([["destination-1"]]);
  });
});
