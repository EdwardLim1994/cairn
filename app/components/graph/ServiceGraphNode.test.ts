// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import { defineComponent, h } from "vue";
import ServiceGraphNode from "./ServiceGraphNode.vue";

const HandleStub = defineComponent({
  props: { id: String, type: String, connectable: Boolean },
  setup(props) {
    return () =>
      h("div", { "data-handle": props.id, "data-connectable": String(props.connectable) });
  },
});

const data = {
  serviceId: "service-1",
  name: "Orders",
  framework: "Spring Boot",
  online: true,
  endpoints: [{ id: "endpoint-1", name: "List orders", method: "GET" }],
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
