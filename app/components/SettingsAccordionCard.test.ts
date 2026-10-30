// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import SettingsAccordionCard from "./SettingsAccordionCard.vue";

describe("SettingsAccordionCard", () => {
  it("renders title, subtitle, and slotted content", () => {
    const wrapper = mount(SettingsAccordionCard, {
      props: { title: "API_KEY", subtitle: "Shared variable", deleteLabel: "Delete variable" },
      slots: { default: "Card content" },
    });

    expect(wrapper.text()).toContain("API_KEY");
    expect(wrapper.text()).toContain("Shared variable");
    expect(wrapper.text()).toContain("Card content");
  });

  it("emits delete when its delete action is clicked", async () => {
    const wrapper = mount(SettingsAccordionCard, {
      props: { title: "API_KEY", deleteLabel: "Delete variable" },
    });

    await wrapper.get('button[aria-label="Delete variable"]').trigger("click");

    expect(wrapper.emitted("delete")).toEqual([[]]);
  });

  it("emits the new open state when the details element toggles", () => {
    const wrapper = mount(SettingsAccordionCard, {
      props: { title: "API_KEY", deleteLabel: "Delete variable" },
    });
    const details = wrapper.get("details").element as HTMLDetailsElement;
    details.open = true;
    details.dispatchEvent(new Event("toggle"));

    expect(wrapper.emitted("toggle")).toContainEqual([true]);
  });
});
