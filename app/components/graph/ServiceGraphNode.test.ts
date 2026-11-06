// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import { defineComponent, h } from "vue";
import ServiceGraphNode from "./ServiceGraphNode.vue";

const HandleStub = defineComponent({
  props: { id: String, type: String, connectable: Boolean, style: Object },
  setup(props) {
    return () =>
      h("div", {
        "data-handle": props.id,
        "data-connectable": String(props.connectable),
        style: props.style,
      });
  },
});

const data = {
  serviceId: "service-1",
  name: "Orders",
  apiType: "REST" as const,
  framework: "Spring Boot",
  online: true,
  endpoints: [{ id: "endpoint-1", name: "List orders", method: "GET", rpcMethod: null }],
  subscriptions: [],
  outboundCalls: [],
  hasMessagePublisher: false,
  endpointsCollapsed: false,
  hasError: false,
};

describe("ServiceGraphNode", () => {
  it("renders service status and its endpoint", () => {
    const wrapper = mount(ServiceGraphNode, {
      props: { data },
      global: { stubs: { Handle: true } },
    });

    expect(wrapper.text()).toContain("Orders");
    expect(wrapper.text()).toContain("REGISTERED ENDPOINTS");
    expect(wrapper.text()).toContain("List orders");
    expect(wrapper.get('[aria-label="Service online"]').element.tagName).toBe("OUTPUT");
  });

  it("uses the first two service-name characters for Other frameworks", () => {
    const wrapper = mount(ServiceGraphNode, {
      props: { data: { ...data, framework: "Other" } },
      global: { stubs: { Handle: true } },
    });
    expect(wrapper.get('[aria-label="Other framework"]').text()).toBe("Or");
  });

  it("emits endpoint and collapse actions", async () => {
    const wrapper = mount(ServiceGraphNode, {
      props: { data },
      global: { stubs: { Handle: true } },
    });

    await wrapper.get('[aria-label="Open endpoint List orders"]').trigger("click");
    await wrapper.get('[aria-label="Collapse service endpoints"]').trigger("click");

    expect(wrapper.emitted("openEndpoint")).toEqual([["endpoint-1"]]);
    expect(wrapper.emitted("toggleEndpoints")).toEqual([["service-1"]]);
  });

  it("shows the service error indicator when the graph reports a failure", () => {
    const wrapper = mount(ServiceGraphNode, {
      props: { data: { ...data, hasError: true } },
      global: { stubs: { Handle: true } },
    });

    expect(wrapper.text()).toContain("Error reported for this service");
  });

  it("renders a dedicated inbound handle for each message subscription", () => {
    const wrapper = mount(ServiceGraphNode, {
      props: {
        data: {
          ...data,
          subscriptions: [
            {
              id: "subscription-1",
              destinationName: "Orders",
              consumerGroup: "order-workers",
            },
          ],
        },
      },
      global: { stubs: { Handle: HandleStub } },
    });

    expect(wrapper.text()).toContain("Orders");
    expect(wrapper.text()).toContain("order-workers");
    expect(wrapper.find('[data-handle="subscriber-in:subscription-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-handle="consumer-out:subscription-1"]').exists()).toBe(true);
  });

  it("gives API calls and message publishes separate outbound dots on their source endpoint", () => {
    const outboundCalls = [
      { id: "endpoint-call-1", sourceEndpointId: "endpoint-1" },
      { id: "endpoint-call-2", sourceEndpointId: "endpoint-1" },
      { id: "publish-call", kind: "message", sourceEndpointId: "endpoint-1" },
      { id: "consumer-call-1", sourceSubscriptionId: "subscription-1" },
    ];
    const wrapper = mount(ServiceGraphNode, {
      props: {
        data: {
          ...data,
          outboundCalls,
          subscriptions: [{ id: "subscription-1", destinationName: "Orders" }],
        },
      },
      global: { stubs: { Handle: HandleStub } },
    });

    expect(wrapper.findAll('[data-handle^="outbound-call:"]')).toHaveLength(4);
    const endpointDotPositions = ["endpoint-call-1", "endpoint-call-2", "publish-call"].map((id) =>
      wrapper.get(`[data-handle="outbound-call:${id}"]`).attributes("style"),
    );
    expect(new Set(endpointDotPositions).size).toBe(3);
    expect(wrapper.get('[data-handle="outbound-call:publish-call"]').classes()).toContain(
      "app__endpoint-source--message",
    );
    expect(wrapper.find('[data-handle="out:endpoint-1"]').exists()).toBe(false);
    expect(wrapper.find('[data-handle="consumer-out:subscription-1"]').exists()).toBe(false);

    const collapsed = mount(ServiceGraphNode, {
      props: {
        data: {
          ...data,
          outboundCalls,
          endpointsCollapsed: true,
          subscriptions: [{ id: "subscription-1", destinationName: "Orders" }],
        },
      },
      global: { stubs: { Handle: HandleStub } },
    });
    expect(collapsed.findAll('[data-handle^="outbound-call:"]')).toHaveLength(4);
    expect(
      collapsed.findAll('[data-handle^="outbound-call:"][data-connectable="false"]'),
    ).toHaveLength(4);
    const collapsedDotPositions = collapsed
      .findAll('[data-handle^="outbound-call:"]')
      .map((handle) => handle.attributes("style"));
    expect(new Set(collapsedDotPositions).size).toBe(1);
    expect(
      collapsed
        .findAll('[data-handle^="outbound-call:"]')
        .every((handle) => handle.classes().includes("app__endpoint-source--collapsed")),
    ).toBe(true);
    expect(
      collapsed
        .findAll('[data-handle^="outbound-call:"]')
        .some((handle) => handle.classes().includes("app__endpoint-source--connected")),
    ).toBe(false);
  });

  it("bundles consumer rows when the service endpoints are collapsed", () => {
    const wrapper = mount(ServiceGraphNode, {
      props: {
        data: {
          ...data,
          endpointsCollapsed: true,
          subscriptions: [
            { id: "orders-sub", destinationName: "Orders", consumerGroup: "orders-workers" },
            { id: "invoices-sub", destinationName: "Invoices", consumerGroup: "invoice-workers" },
          ],
        },
      },
      global: { stubs: { Handle: HandleStub } },
    });

    expect(wrapper.text()).toContain("2 consumers · connections bundled");
    expect(wrapper.text()).not.toContain("orders-workers");
    expect(wrapper.text()).not.toContain("invoice-workers");
    expect(wrapper.findAll('[data-handle^="subscriber-in:"]')).toHaveLength(2);
    expect(
      wrapper.findAll('[data-handle^="subscriber-in:"][data-connectable="false"]'),
    ).toHaveLength(2);
    expect(
      wrapper.findAll('[data-handle^="consumer-out:"][data-connectable="false"]'),
    ).toHaveLength(2);
  });

  it("places the service-level publisher handle on its own row", () => {
    const wrapper = mount(ServiceGraphNode, {
      props: { data: { ...data, hasMessagePublisher: true } },
      global: { stubs: { Handle: HandleStub } },
    });

    expect(wrapper.text()).toContain("Message publisher");
    expect(wrapper.find('[data-handle="service-out"]').exists()).toBe(true);
  });

  it("does not render the publisher row when the service has no publisher", () => {
    const wrapper = mount(ServiceGraphNode, {
      props: { data },
      global: { stubs: { Handle: HandleStub } },
    });

    expect(wrapper.text()).not.toContain("Message publisher");
    expect(wrapper.find('[data-handle="service-out"]').exists()).toBe(false);
  });

  it("keeps endpoint handle identities at shared, non-connectable collapsed positions", () => {
    const wrapper = mount(ServiceGraphNode, {
      props: {
        data: {
          ...data,
          endpoints: [
            ...data.endpoints,
            { id: "endpoint-2", name: "Create order", method: "POST" },
          ],
          endpointsCollapsed: true,
        },
      },
      global: { stubs: { Handle: HandleStub } },
    });

    expect(
      wrapper.findAll("[data-handle]").map((handle) => handle.attributes("data-handle")),
    ).toEqual(["in:endpoint-1", "out:endpoint-1", "in:endpoint-2", "out:endpoint-2"]);
    expect(wrapper.findAll('[data-connectable="false"]')).toHaveLength(4);
  });
});
