// @vitest-environment happy-dom
import { mount } from "@vue/test-utils";
import { Codemirror } from "vue-codemirror";
import { describe, expect, it } from "vite-plus/test";
import GraphqlRequestEditor from "./GraphqlRequestEditor.vue";

describe("GraphqlRequestEditor", () => {
  it("loads GraphQL CodeMirror support and edits query, variables, and operation name", async () => {
    const wrapper = mount(GraphqlRequestEditor, {
      props: {
        modelValue: JSON.stringify({
          query: "query GetOrder { order { id } }",
          variables: { id: "42" },
          operationName: "GetOrder",
        }),
        variables: [{ name: "ORDER_ID" }],
      },
    });
    const editors = wrapper.findAllComponents(Codemirror);
    expect(editors).toHaveLength(2);
    expect(editors[0]?.attributes("aria-label")).toBe("GraphQL query");
    expect(editors[0]?.props("extensions")).toBeTruthy();

    editors[0]?.vm.$emit("update:modelValue", "query GetOrder { order(id: $id) { id } }");
    await wrapper.get("input").setValue("Lookup");
    await wrapper.vm.$nextTick();

    expect(JSON.parse(wrapper.emitted("update:modelValue")?.at(-1)?.[0] as string)).toEqual({
      query: "query GetOrder { order(id: $id) { id } }",
      variables: { id: "42" },
      operationName: "Lookup",
    });

    editors[1]?.vm.$emit("update:modelValue", '{"id":"99"}');
    await wrapper.vm.$nextTick();
    expect(
      JSON.parse(wrapper.emitted("update:modelValue")?.at(-1)?.[0] as string).variables,
    ).toEqual({
      id: "99",
    });

    editors[1]?.vm.$emit("update:modelValue", "{");
    await wrapper.vm.$nextTick();
    expect(JSON.parse(wrapper.emitted("update:modelValue")?.at(-1)?.[0] as string).variables).toBe(
      "{",
    );
  });
});
