// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import AppToastStack from "./AppToastStack.vue";

describe("AppToastStack", () => {
  it("renders and dismisses errors and import warnings", async () => {
    const wrapper = mount(AppToastStack, {
      props: {
        errorMessage: "Could not save",
        warnings: [{ id: 7, message: "No endpoint match" }],
      },
    });
    expect(wrapper.text()).toContain("Could not save");
    expect(wrapper.text()).toContain("No endpoint match");
    await wrapper.get('[aria-label="Dismiss error"]').trigger("click");
    await wrapper.get('[aria-label="Dismiss import warning"]').trigger("click");
    expect(wrapper.emitted("dismissError")).toEqual([[]]);
    expect(wrapper.emitted("dismissWarning")).toEqual([[7]]);
  });
});
