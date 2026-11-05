import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

export async function invokeUnaryGrpc(input: {
  proto: string;
  rpcMethod: string;
  target: string;
  tls: boolean;
  request: unknown;
  traceparent: string;
  timeoutMs: number;
}) {
  const directory = await mkdtemp(join(tmpdir(), "cairn-grpc-"));
  try {
    const protoPath = join(directory, "service.proto");
    await writeFile(protoPath, input.proto, "utf8");
    const definition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const root = grpc.loadPackageDefinition(definition) as Record<string, unknown>;
    const parts = input.rpcMethod.replace(/^\//, "").split("/");
    const [serviceName, methodName] = parts;
    if (!serviceName || !methodName) throw new Error(`Invalid gRPC method: ${input.rpcMethod}`);
    let service: unknown = root;
    for (const part of serviceName.split("."))
      service = (service as Record<string, unknown>)?.[part];
    const Client = service as grpc.ServiceClientConstructor | undefined;
    if (!Client || !(methodName in Client.service))
      throw new Error(`gRPC method not found: ${input.rpcMethod}`);
    const client = new Client(
      input.target,
      input.tls ? grpc.credentials.createSsl() : grpc.credentials.createInsecure(),
    );
    try {
      const method = Client.service[methodName];
      if (!method) throw new Error(`gRPC method not found: ${input.rpcMethod}`);
      const invoke = (
        client as unknown as Record<string, ((...args: unknown[]) => void) | undefined>
      )[methodName];
      if (!invoke) throw new Error(`gRPC method not found: ${input.rpcMethod}`);
      const response = await new Promise<unknown>((resolve, reject) => {
        const metadata = new grpc.Metadata();
        metadata.set("traceparent", input.traceparent);
        const deadline = new Date(Date.now() + input.timeoutMs);
        invoke.call(
          client,
          input.request,
          metadata,
          { deadline },
          (error: grpc.ServiceError | null, value: unknown) =>
            error ? reject(error) : resolve(value),
        );
      });
      return response;
    } finally {
      client.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
