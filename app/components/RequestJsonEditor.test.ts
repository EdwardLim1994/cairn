// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { Codemirror } from "vue-codemirror";
import { describe, expect, it } from "vite-plus/test";
import RequestJsonEditor from "./RequestJsonEditor.vue";

describe("RequestJsonEditor", () => {
  it("passes request text and variables into the JSON editor and emits edits", async () => {
    const wrapper = mount(RequestJsonEditor, {
      props: { modelValue: '{"id":1}', variables: [{ name: "TOKEN" }] },
    });
    const editor = wrapper.findComponent(Codemirror);
    expect(editor.exists()).toBe(true);
    expect(wrapper.get("[role='textbox']").attributes("aria-placeholder")).toBe("{}");
    editor.vm.$emit("update:modelValue", '{"id":2}');
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual(['{"id":2}']);
  });
});
