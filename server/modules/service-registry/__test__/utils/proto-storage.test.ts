import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createStorage } from "unstorage";
import fsDriver from "unstorage/drivers/fs";
import s3Driver from "unstorage/drivers/s3";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

describe("proto storage drivers", () => {
  it("writes and reads from filesystem storage", async () => {
    const base = await mkdtemp(join(tmpdir(), "cairn-proto-storage-"));
    cleanups.push(() => rm(base, { recursive: true, force: true }));
    const storage = createStorage({ driver: fsDriver({ base }) });

    await storage.setItem("service/schema.proto", 'syntax = "proto3";');
    const afterRestart = createStorage({ driver: fsDriver({ base }) });
    expect(await afterRestart.getItem("service/schema.proto")).toBe('syntax = "proto3";');
  });

  it("writes and reads an S3 object", async () => {
    const objects = new Map<string, string>();
    const server = createServer(async (request, response) => {
      const key = new URL(request.url ?? "/", "http://localhost").pathname
        .split("/")
        .slice(2)
        .join("/");
      if (request.method === "PUT") {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        objects.set(key, Buffer.concat(chunks).toString());
        response.writeHead(200).end();
      } else if (request.method === "GET" && objects.has(key)) {
        response.writeHead(200).end(objects.get(key));
      } else if (request.method === "DELETE") {
        objects.delete(key);
        response.writeHead(204).end();
      } else {
        response.writeHead(404).end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    cleanups.push(
      () =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        ),
    );
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("S3 test server did not start");
    const storage = createStorage({
      driver: s3Driver({
        endpoint: `http://127.0.0.1:${address.port}`,
        region: "us-east-1",
        bucket: "test",
        accessKeyId: "test-key",
        secretAccessKey: "test-secret",
        bulkDelete: false,
      }),
    });

    await storage.setItem("service/schema.proto", 'syntax = "proto3";');
    expect(await storage.getItem("service/schema.proto")).toBe('syntax = "proto3";');
  });
});
