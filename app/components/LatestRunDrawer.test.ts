// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import { defineComponent, h } from "vue";
import LatestRunDrawer from "./LatestRunDrawer.vue";

const components = {
  UButton: defineComponent({
    inheritAttrs: false,
    props: { type: String },
    setup(props, { attrs, slots }) {
      return () => h("button", { ...attrs, type: props.type ?? "button" }, slots.default?.());
    },
  }),
};

describe("LatestRunDrawer", () => {
  it("shows response, failure details, trace flow, and close action", async () => {
    const wrapper = mount(LatestRunDrawer, {
      props: {
        running: false,
        result: {
          id: "run-1",
          status: "failed",
          responseStatus: 500,
          responseBody: '{"error":"out of stock"}',
          error: "Request failed",
          traceId: "trace-1",
          flow: { status: "complete", incomplete: false },
        },
      },
      global: { components },
    });
    expect(wrapper.text()).toContain('"error": "out of stock"');
    expect(wrapper.text()).toContain("Request failed");
    expect(wrapper.text()).toContain("trace-1");
    await wrapper.get('[aria-label="Close run details"]').trigger("click");
    expect(wrapper.emitted("close")).toEqual([[]]);
  });
});
