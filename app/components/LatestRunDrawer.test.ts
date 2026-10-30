// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vite-plus/test";
import LatestRunDrawer from "./LatestRunDrawer.vue";

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
    });
    expect(wrapper.text()).toContain('"error": "out of stock"');
    expect(wrapper.text()).toContain("Request failed");
    expect(wrapper.text()).toContain("trace-1");
    await wrapper.get('[aria-label="Close run details"]').trigger("click");
    expect(wrapper.emitted("close")).toEqual([[]]);
  });
});
