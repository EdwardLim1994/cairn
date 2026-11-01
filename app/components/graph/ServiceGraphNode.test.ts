// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import ServiceGraphNode from "./ServiceGraphNode.vue";

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
});
