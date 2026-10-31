// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vite-plus/test";
import ServiceSettingsPanel from "./ServiceSettingsPanel.vue";

const draft = {
  name: "Orders",
  framework: "Spring Boot",
  baseUrl: "http://localhost:8080",
  active: true,
  endpoints: [
    {
      id: "endpoint-1",
      name: "List orders",
      apiType: "REST" as const,
      method: "GET" as const,
      url: "/orders",
    },
  ],
};

describe("ServiceSettingsPanel", () => {
  it("renders service fields and endpoint details and supports framework editing", async () => {
    const wrapper = mount(ServiceSettingsPanel, {
      props: {
        draft: structuredClone(draft),
        frameworkMenuOpen: false,
        editingServiceId: "service-1",
      },
    });

    expect(wrapper.find('[aria-label="Service settings"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("List orders");
    await wrapper.get('[role="combobox"]').trigger("click");
    expect(wrapper.emitted("update:frameworkMenuOpen")).toEqual([[true]]);
    const menuWrapper = mount(ServiceSettingsPanel, {
      props: { draft: structuredClone(draft), frameworkMenuOpen: true, editingServiceId: null },
    });
    expect(menuWrapper.find('[role="listbox"]').exists()).toBe(true);
    await menuWrapper.get('[role="option"]:last-child').trigger("click");
    expect(menuWrapper.emitted("update:frameworkMenuOpen")).toEqual([[false]]);
  });

  it("emits save, discard, endpoint edit intents, and service deletion", async () => {
    const wrapper = mount(ServiceSettingsPanel, {
      props: {
        draft: structuredClone(draft),
        frameworkMenuOpen: false,
        editingServiceId: "service-1",
      },
    });
    await wrapper.get("button.app__button--primary").trigger("click");
    await wrapper.get("footer button.app__button--secondary").trigger("click");
    await wrapper.get(".app__endpoint-actions button:last-child").trigger("click");
    await wrapper.get('[aria-label="Remove List orders"]').trigger("click");
    await wrapper.get('[aria-label="Remove service"]').trigger("click");

    expect(wrapper.emitted("save")).toEqual([[]]);
    expect(wrapper.emitted("discard")).toEqual([[]]);
    expect(wrapper.emitted("addEndpoint")).toEqual([[]]);
    expect(wrapper.emitted("removeEndpoint")).toEqual([[0]]);
    expect(wrapper.emitted("removeService")).toEqual([["service-1"]]);
  });

  it("opens the JSON/YAML file picker and emits the selected OpenAPI file", async () => {
    const wrapper = mount(ServiceSettingsPanel, {
      props: {
        draft: structuredClone(draft),
        frameworkMenuOpen: false,
        editingServiceId: "service-1",
      },
    });
    const input = wrapper.get('[aria-label="Upload OpenAPI schema"]');
    const click = vi.spyOn(input.element as HTMLInputElement, "click");
    const file = new File(["openapi: 3.1.0"], "service.yaml", { type: "text/yaml" });

    await wrapper.get("button.app__button--small").trigger("click");
    expect(click).toHaveBeenCalledOnce();
    expect((input.element as HTMLInputElement).accept).toContain(".json");
    expect((input.element as HTMLInputElement).accept).toContain(".yaml");

    Object.defineProperty(input.element, "files", { configurable: true, value: [file] });
    await input.trigger("change");
    expect(wrapper.emitted("importOpenApi")).toEqual([[file]]);
  });
});
