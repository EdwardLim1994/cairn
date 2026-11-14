import { describe, expect, it } from "vite-plus/test";
import { parseGrpcProto } from "../../../../utils/grpc-proto";

describe("parseGrpcProto", () => {
  it("extracts unary methods with fully qualified RPC paths", async () => {
    const result = await parseGrpcProto(`
      syntax = "proto3";
      package demo;
      message Request {}
      message Reply {}
      service Echo { rpc Get(Request) returns (Reply); }
    `);

    expect(result.methods).toEqual([{ name: "demo.Echo.Get", rpcMethod: "/demo.Echo/Get" }]);
    expect(result.streamingMethods).toEqual([]);
    expect(result.unresolvedImports).toEqual([]);
  });

  it("skips streaming methods", async () => {
    const result = await parseGrpcProto(`
      syntax = "proto3";
      package demo;
      message Request {}
      message Reply {}
      service Echo {
        rpc Upload(stream Request) returns (Reply);
        rpc Download(Request) returns (stream Reply);
      }
    `);

    expect(result.methods).toEqual([]);
    expect(result.streamingMethods).toEqual(["/demo.Echo/Upload", "/demo.Echo/Download"]);
    expect(result.unresolvedImports).toEqual([]);
  });

  it("reports unresolved imports", async () => {
    const result = await parseGrpcProto('syntax = "proto3"; import "common.proto";');

    expect(result.methods).toEqual([]);
    expect(result.streamingMethods).toEqual([]);
    expect(result.unresolvedImports).toEqual(["common.proto"]);
  });

  it("rejects invalid syntax", async () => {
    await expect(parseGrpcProto('syntax = "proto3"; service {')).rejects.toThrow();
  });
});
