import { describe, expect, it } from "vite-plus/test";
import { parsePostmanCollection } from "./postman-import";

describe("Postman path parameter import", () => {
  it("keeps concrete and unresolved path values for matching endpoints", () => {
    const collection = JSON.stringify({
      info: { name: "items" },
      item: [
        { name: "Concrete", request: { method: "GET", url: "http://localhost:8080/items/a%2Fb" } },
        {
          name: "Variable",
          request: { method: "GET", url: "http://localhost:8080/items/{{itemId}}" },
        },
      ],
    });
    const result = parsePostmanCollection(collection, [
      {
        baseUrl: "http://localhost:8080",
        endpoints: [{ id: "endpoint-1", apiType: "REST", method: "GET", url: "/items/{itemId}" }],
      },
    ]);
    expect(result.drafts).toHaveLength(2);
    expect(result.drafts[0]?.pathParameters).toEqual({ itemId: "a/b" });
    expect(result.drafts[1]?.pathParameters).toEqual({ itemId: "{{itemId}}" });
    expect(result.warnings).toEqual([]);
  });
});
