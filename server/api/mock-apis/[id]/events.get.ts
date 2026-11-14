import { getMockApiExecutionTarget } from "../../../modules/mock-apis";
import { ensureProject } from "../../../utils/project";
import { webSocketSessionRegistry } from "../../../utils/websocket-sessions";

export default defineEventHandler(async (event) => {
  const projectId = await ensureProject();
  const mockApiId = getRouterParam(event, "id")!;
  const target = await getMockApiExecutionTarget(projectId, mockApiId);
  if (!target) throw createError({ statusCode: 404, statusMessage: "Mock API not found" });
  if (!target.targetEndpointId)
    throw createError({ statusCode: 409, statusMessage: "WebSocket endpoint is unavailable" });
  const session = webSocketSessionRegistry.get(projectId, target.targetEndpointId);
  if (session?.mockApiId !== mockApiId)
    throw createError({ statusCode: 409, statusMessage: "WebSocket session is not connected" });

  const response = event.node.res;
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const write = (name: string, data: unknown) =>
    response.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const unsubscribe = webSocketSessionRegistry.subscribe(session, ({ type, data }) => {
    write(type, data);
    if (type === "state" && (data as { state?: string }).state === "disconnected") {
      unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
      response.end();
    }
  });
  // Subscribe before replaying buffered messages so messages arriving during setup are not lost.
  // The client deduplicates by message id because an event may be present in both the replay and live stream.
  for (const message of session.messages) write("message", message);
  write("state", { state: session.state });
  heartbeat = setInterval(() => response.write(": keep-alive\n\n"), 15_000);
  response.on("close", () => {
    unsubscribe();
    if (heartbeat) clearInterval(heartbeat);
    if (!response.writableEnded) response.end();
  });
});
