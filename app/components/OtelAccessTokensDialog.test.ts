// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { describe, expect, it, vi } from "vite-plus/test";
import { defineComponent, h } from "vue";
import OtelAccessTokensDialog from "./OtelAccessTokensDialog.vue";

const components = {
  USlideover: defineComponent({
    props: { open: Boolean, content: Object, ui: Object },
    setup(props, { slots }) {
      return () =>
        h("div", { ...props.content, class: props.ui?.overlay }, [
          h("section", { class: props.ui?.content }, [
            h("header", [
              ...(slots.title?.() ?? []),
              ...(slots.description?.() ?? []),
              ...(slots.actions?.() ?? []),
            ]),
            ...(slots.body?.() ?? []),
            ...(slots.footer?.() ?? []),
          ]),
        ]);
    },
  }),
  UInput: defineComponent({
    inheritAttrs: false,
    props: { modelValue: String },
    emits: ["update:modelValue"],
    setup(props, { attrs, emit }) {
      return () =>
        h("input", {
          ...attrs,
          value: props.modelValue,
          onInput: (event: Event) =>
            emit("update:modelValue", (event.target as HTMLInputElement).value),
        });
    },
  }),
  UButton: defineComponent({
    inheritAttrs: false,
    props: { type: String, disabled: Boolean },
    setup(props, { attrs, slots }) {
      return () =>
        h(
          "button",
          { ...attrs, type: props.type ?? "button", disabled: props.disabled },
          slots.default?.(),
        );
    },
  }),
};

const token = {
  id: "one",
  name: "collector",
  expiresAt: "2030-01-01T00:00:00.000Z",
  createdAt: "2029-01-01T00:00:00.000Z",
  expired: false,
};

function mountDialog() {
  const fetch = vi.fn(async (url: string, options?: { method?: string }) => {
    if (options?.method === "POST") return { ...token, token: "one-time-secret" };
    if (options?.method === "DELETE") return { deleted: true };
    return [token];
  });
  vi.stubGlobal("$fetch", fetch);
  const wrapper = mount(OtelAccessTokensDialog, {
    props: { open: true },
    global: { components },
  });
  return { wrapper, fetch };
}

describe("OtelAccessTokensDialog", () => {
  it("generates a token and reveals secret only in success state", async () => {
    const { wrapper, fetch } = mountDialog();
    await flushPromises();
    await wrapper.get('[aria-label="Token name"]').setValue("collector");
    await wrapper.get('[aria-label="Expiration date"]').setValue("2030-01-01");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(fetch).toHaveBeenCalledWith(
      "/api/access-tokens",
      expect.objectContaining({ method: "POST" }),
    );
    expect(wrapper.text()).toContain("one-time-secret");
    expect(wrapper.text()).toContain("collector");
    expect(wrapper.text()).toContain("Expires");
    expect(wrapper.text()).not.toContain("operator login");
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Copy token")!
      .trigger("click");
    expect(writeText).toHaveBeenCalledWith("one-time-secret");
  });

  it("keeps token on cancel and deletes only after confirmation", async () => {
    const { wrapper, fetch } = mountDialog();
    await flushPromises();
    const button = (label: string) =>
      wrapper.findAll("button").find((item) => item.text() === label)!;
    await button("Revoke").trigger("click");
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(true);
    await button("Cancel").trigger("click");
    expect(fetch).not.toHaveBeenCalledWith("/api/access-tokens/one", expect.anything());
    await button("Revoke").trigger("click");
    await button("Confirm revoke").trigger("click");
    await flushPromises();
    expect(fetch).toHaveBeenCalledWith("/api/access-tokens/one", { method: "DELETE" });
  });

  it("clears one-time secret when dialog closes", async () => {
    const { wrapper } = mountDialog();
    await flushPromises();
    await wrapper.get('[aria-label="Token name"]').setValue("collector");
    await wrapper.get('[aria-label="Expiration date"]').setValue("2030-01-01");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain("one-time-secret");
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.text()).not.toContain("one-time-secret");
  });
});
