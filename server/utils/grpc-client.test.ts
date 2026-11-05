import { afterEach, describe, expect, it } from "vite-plus/test";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { invokeUnaryGrpc } from "./grpc-client";

const proto = `syntax = "proto3";
package sample;
service Echo { rpc Send (EchoRequest) returns (EchoReply); }
message EchoRequest { string message = 1; }
message EchoReply { string message = 1; }`;

describe("gRPC client", () => {
  let server: grpc.Server | undefined;
  let address: string | undefined;
  let directory: string | undefined;

  afterEach(async () => {
    if (server) await new Promise<void>((resolve) => server!.tryShutdown(() => resolve()));
    if (directory) await rm(directory, { recursive: true, force: true });
    server = undefined;
    directory = undefined;
  });

  it("invokes unary RPCs, validates JSON through protobuf serialization, and sends traceparent", async () => {
    directory = await mkdtemp(join(tmpdir(), "cairn-grpc-test-"));
    const file = join(directory, "service.proto");
    await writeFile(file, proto);
    const root = grpc.loadPackageDefinition(protoLoader.loadSync(file)) as Record<string, any>;
    server = new grpc.Server();
    server.addService(root.sample.Echo.service, {
      send(
        call: grpc.ServerUnaryCall<{ message: string }, { message: string }>,
        callback: grpc.sendUnaryData<{ message: string }>,
      ) {
        expect(call.metadata.get("traceparent")).toEqual([
          "00-" + "a".repeat(32) + "-" + "b".repeat(16) + "-01",
        ]);
        callback(null, { message: call.request.message });
      },
    });
    address = await new Promise<string>((resolve, reject) => {
      server!.bindAsync("127.0.0.1:0", grpc.ServerCredentials.createInsecure(), (error, port) =>
        error ? reject(error) : resolve(`127.0.0.1:${port}`),
      );
    });
    await expect(
      invokeUnaryGrpc({
        proto,
        rpcMethod: "/sample.Echo/Send",
        target: address,
        tls: false,
        request: { message: "hello" },
        traceparent: `00-${"a".repeat(32)}-${"b".repeat(16)}-01`,
        timeoutMs: 1000,
      }),
    ).resolves.toMatchObject({ message: "hello" });
  });
});
