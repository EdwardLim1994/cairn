import { createError, defineEventHandler, readBody } from "h3";
import { protoParseRequestSchema, protoParseResponseSchema } from "#shared/api/services";
import { parseGrpcProto } from "../../utils/grpc-proto";

export default defineEventHandler(async (event) => {
  const input = protoParseRequestSchema.safeParse(await readBody(event));
  if (!input.success) throw createError({ statusCode: 400, statusMessage: "Invalid proto file" });
  try {
    return protoParseResponseSchema.parse(await parseGrpcProto(input.data.content));
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : "Could not parse proto file",
    });
  }
});
