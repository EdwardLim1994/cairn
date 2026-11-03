// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { defineComponent, h } from "vue";
import LoginPage from "./login.vue";

const components = {
  UCard: defineComponent({
    setup(_, { slots }) {
      return () => h("section", [slots.header?.(), slots.default?.()]);
    },
  }),
  UInput: defineComponent({
    inheritAttrs: false,
    props: { modelValue: String, type: String },
    emits: ["update:modelValue"],
    setup(props, { attrs, emit }) {
      return () =>
        h("input", {
          ...attrs,
          type: props.type ?? "text",
          value: props.modelValue,
          onInput: (event: Event) =>
            emit("update:modelValue", (event.target as HTMLInputElement).value),
        });
    },
  }),
  UButton: defineComponent({
    props: { loading: Boolean, type: String },
    setup(props, { slots }) {
      return () =>
        h("button", { type: props.type ?? "button", disabled: props.loading }, slots.default?.());
    },
  }),
};

afterEach(() => vi.unstubAllGlobals());

function mountPage(returnTo: unknown, fetch: ReturnType<typeof vi.fn>) {
  const navigateTo = vi.fn();
  vi.stubGlobal("useRoute", () => ({ query: { returnTo } }));
  vi.stubGlobal("navigateTo", navigateTo);
  vi.stubGlobal("$fetch", fetch);
  return {
    wrapper: mount(LoginPage, { global: { components } }),
    navigateTo,
  };
}

describe("login page", () => {
  it("signs in and returns to a safe local destination", async () => {
    const fetch = vi.fn().mockResolvedValue({ authenticated: true });
    const { wrapper, navigateTo } = mountPage("/services?tab=health", fetch);
    await wrapper.get('[aria-label="Username"]').setValue("operator");
    await wrapper.get('[aria-label="Password"]').setValue("password");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      body: { username: "operator", password: "password" },
    });
    expect(navigateTo).toHaveBeenCalledWith("/services?tab=health");
  });

  it("shows generic feedback and rejects external return destinations", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("internal credential detail"));
    const { wrapper, navigateTo } = mountPage("https://attacker.example", fetch);
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe("Username or password is incorrect.");
    expect(wrapper.text()).not.toContain("internal credential detail");
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it("falls back to the main page after login when return destination is external", async () => {
    const fetch = vi.fn().mockResolvedValue({ authenticated: true });
    const { wrapper, navigateTo } = mountPage("https://attacker.example", fetch);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(navigateTo).toHaveBeenCalledWith("/");
  });
});
