// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import MockApiSettingsPanel from "./MockApiSettingsPanel.vue";

const mockDraft = [
  {
    id: "mock-1",
    name: "Fetch orders",
    targetEndpointId: "endpoint-1",
    description: "List orders",
    requestJson: "{}",
    pathParameters: {},
  },
];

describe("MockApiSettingsPanel", () => {
  it("renders shared variables, mock APIs, and import controls", () => {
    const wrapper = mount(MockApiSettingsPanel, {
      props: {
        mockDraft: structuredClone(mockDraft),
        environmentVariables: [{ id: "var-1", name: "TOKEN", value: "secret" }],
        variablesOpen: true,
        apisOpen: true,
        variableDraft: { name: "", value: "" },
        environmentVariablesLoading: false,
        editingEnvironmentVariableId: "var-1",
        expandedEnvironmentVariableId: "var-1",
        servicesForSelect: [{ id: "endpoint-1", label: "Orders | List orders (GET)" }],
        endpointPathParameterNames: () => [],
      },
    });

    expect(wrapper.text()).toContain("Shared environment variables");
    expect(wrapper.text()).toContain("Registered mock APIs");
    expect(wrapper.text()).toContain("Fetch orders");
    expect(wrapper.text()).toContain("Import Postman");
    expect(wrapper.text()).toContain("New variable");
    expect(wrapper.find('[aria-label="Close"]').exists()).toBe(false);
  });

  it("emits variable, import, mock API, save, and discard interactions", async () => {
    const wrapper = mount(MockApiSettingsPanel, {
      props: {
        mockDraft: structuredClone(mockDraft),
        environmentVariables: [{ id: "var-1", name: "TOKEN", value: "secret" }],
        variablesOpen: true,
        apisOpen: true,
        variableDraft: { name: "TOKEN", value: "secret" },
        environmentVariablesLoading: false,
        editingEnvironmentVariableId: "var-1",
        expandedEnvironmentVariableId: "var-1",
        servicesForSelect: [{ id: "endpoint-1", label: "Orders | List orders (GET)" }],
        endpointPathParameterNames: () => [],
      },
    });
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Save")!
      .trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Discard")!
      .trigger("click");
    await wrapper
      .get(".app__environment-variable-header button.app__button--secondary")
      .trigger("click");
    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("+ New API"))!
      .trigger("click");
    const fileInput = wrapper.get('input[type="file"]');
    Object.defineProperty(fileInput.element, "files", {
      value: [new File(["{}"], "collection.json")],
    });
    await fileInput.trigger("change");

    expect(wrapper.emitted("save")).toEqual([[]]);
    expect(wrapper.emitted("discard")).toEqual([[]]);
    expect(wrapper.emitted("addVariable")).toEqual([[]]);
    expect(wrapper.emitted("addMockApi")).toEqual([[]]);
    expect(wrapper.emitted("importCollection")).toHaveLength(1);
  });
});
