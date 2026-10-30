import { asc, and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { mockApis, serviceEndpoints } from "../../db/schema";

export async function listMockApis(projectId: string) {
  const rows = await getDb()
    .select()
    .from(mockApis)
    .where(eq(mockApis.projectId, projectId))
    .orderBy(asc(mockApis.createdAt));
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function findMockApiEndpoint(projectId: string, endpointId: string) {
  const [endpoint] = await getDb()
    .select({ id: serviceEndpoints.id, url: serviceEndpoints.url })
    .from(serviceEndpoints)
    .where(and(eq(serviceEndpoints.id, endpointId), eq(serviceEndpoints.projectId, projectId)));
  return endpoint;
}

export async function findMockApi(projectId: string, id: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: mockApis.id })
    .from(mockApis)
    .where(and(eq(mockApis.id, id), eq(mockApis.projectId, projectId)));
  return Boolean(row);
}

export async function createMockApi(
  id: string,
  projectId: string,
  input: {
    name: string;
    targetEndpointId: string;
    pathParameters: Record<string, string>;
    requestJson: unknown;
    description: string;
  },
) {
  await getDb()
    .insert(mockApis)
    .values({ id, projectId, ...input });
}

export async function updateMockApi(
  id: string,
  projectId: string,
  input: {
    name: string;
    targetEndpointId: string;
    pathParameters: Record<string, string>;
    requestJson: unknown;
    description: string;
  },
): Promise<void> {
  await getDb()
    .update(mockApis)
    .set(input)
    .where(and(eq(mockApis.id, id), eq(mockApis.projectId, projectId)));
}

export async function deleteMockApi(projectId: string, id: string): Promise<boolean> {
  const result = await getDb()
    .delete(mockApis)
    .where(and(eq(mockApis.id, id), eq(mockApis.projectId, projectId)));
  return Boolean(result[0]?.affectedRows);
}
