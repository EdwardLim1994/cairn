import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSync } from "@grpc/proto-loader";

export type ParsedGrpcMethod = {
  name: string;
  rpcMethod: string;
};

function parseMethods(definition: ReturnType<typeof loadSync>) {
  const methods: ParsedGrpcMethod[] = [];
  const streamingMethods: string[] = [];
  for (const [serviceName, service] of Object.entries(definition)) {
    if (!service || typeof service !== "object") continue;
    for (const [methodName, method] of Object.entries(service)) {
      if (!method || typeof method !== "object" || !("path" in method)) continue;
      const rpcMethod = String(method.path);
      if ("requestStream" in method && (method.requestStream || method.responseStream)) {
        streamingMethods.push(rpcMethod);
      } else {
        methods.push({ name: `${serviceName}.${methodName}`, rpcMethod });
      }
    }
  }
  return { methods, streamingMethods };
}

export async function parseGrpcProto(source: string) {
  if (!source.trim()) throw new Error("Proto file is empty");
  if (Buffer.byteLength(source, "utf8") > 1024 * 1024)
    throw new Error("Proto file must be 1 MB or smaller");

  const directory = await mkdtemp(join(tmpdir(), "cairn-proto-"));
  const file = join(directory, "service.proto");
  try {
    await writeFile(file, source, "utf8");
    const importSource = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const importedFiles = [
      ...importSource.matchAll(/\bimport\s+(?:(?:public|weak)\s+)?["']([^"']+)["']\s*;/g),
    ].map(([, path]) => path);
    const unresolvedImports = importedFiles;
    if (unresolvedImports.length) return { methods: [], streamingMethods: [], unresolvedImports };

    const definition = loadSync(file, { keepCase: true, longs: String, enums: String });
    const { methods, streamingMethods } = parseMethods(definition);
    if (!methods.length && !streamingMethods.length)
      throw new Error("Proto file contains no service methods");
    return { methods, streamingMethods, unresolvedImports: [] };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
