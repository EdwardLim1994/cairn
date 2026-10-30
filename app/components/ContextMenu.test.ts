// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import ContextMenu from "./ContextMenu.vue";

describe("ContextMenu", () => {
  it("positions the menu and emits add-service intent", async () => {
    const wrapper = mount(ContextMenu, { props: { position: { x: 120, y: 240 } } });
    expect(wrapper.attributes("style")).toContain("left: 120px");
    expect(wrapper.attributes("style")).toContain("top: 240px");
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("addService")).toEqual([[]]);
  });
});
