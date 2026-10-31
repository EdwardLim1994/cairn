import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import * as schema from "../db/schema";
import {
  environmentVariables,
  headerTemplates,
  mockApis,
  projects,
  serviceEndpoints,
  services,
} from "../db/schema";
import { saveMockApiSettings } from "./mock-api-settings";

const connectionString = process.env.CAIRN_TEST_DATABASE_URL;
const integration = describe.skipIf(!connectionString);

integration("mock API settings save with MySQL", () => {
  const projectId = "mock-settings-project";
  let pool: mysql.Pool;
  let db: MySql2Database<typeof schema>;

  beforeAll(async () => {
    pool = mysql.createPool(connectionString!);
    db = drizzle({ client: pool, schema, mode: "default" });
    await pool.query("SELECT 1");
  });

  beforeEach(async () => {
    await db.delete(projects).where(eq(projects.id, projectId));
    await db.insert(projects).values({ id: projectId });
    await db.insert(services).values({
      id: "mock-settings-service",
      projectId,
      name: "Orders",
      framework: "REST",
      baseUrl: "http://localhost:8080",
    });
    await db.insert(serviceEndpoints).values({
      id: "mock-settings-endpoint",
      projectId,
      serviceId: "mock-settings-service",
      name: "List",
      method: "GET",
      url: "/orders",
    });
  });

  afterAll(async () => pool?.end());

  it("saves new variables, a template, and a referencing API in one transaction", async () => {
    await saveMockApiSettings(
      projectId,
      {
        environmentVariables: [{ id: "draft-token", name: "token", value: "secret" }],
        headerTemplates: [
          {
            id: "draft-auth",
            name: "Auth",
            headers: [{ name: "Authorization", value: "Bearer {{token}}" }],
          },
        ],
        mockApis: [
          {
            id: "draft-api",
            name: "List orders",
            targetEndpointId: "mock-settings-endpoint",
            headerTemplateId: "draft-auth",
            customHeaders: [],
            active: true,
            description: "",
            requestJson: {},
            pathParameters: {},
            importMethod: null,
            importUrl: null,
            matchUrl: null,
          },
        ],
      },
      db,
    );

    const [variable] = await db
      .select()
      .from(environmentVariables)
      .where(eq(environmentVariables.projectId, projectId));
    const [template] = await db
      .select()
      .from(headerTemplates)
      .where(eq(headerTemplates.projectId, projectId));
    const [api] = await db.select().from(mockApis).where(eq(mockApis.projectId, projectId));
    expect(variable?.value).toBe("secret");
    expect(api?.headerTemplateId).toBe(template?.id);
    expect(api?.active).toBe(true);
  });

  it("rolls back dependency writes when readiness persistence fails", async () => {
    const failingDb = {
      transaction: (run: (tx: unknown) => Promise<unknown>) =>
        db.transaction((tx) =>
          run(
            new Proxy(tx, {
              get(target, key) {
                if (key === "update")
                  return () => ({
                    set: () => ({ where: () => Promise.reject(new Error("forced failure")) }),
                  });
                return Reflect.get(target, key);
              },
            }),
          ),
        ),
    } as unknown as MySql2Database<typeof schema>;

    await expect(
      saveMockApiSettings(
        projectId,
        {
          environmentVariables: [],
          headerTemplates: [],
          mockApis: [
            {
              id: "draft-invalid-api",
              name: "Invalid",
              targetEndpointId: null,
              headerTemplateId: null,
              customHeaders: [],
              active: true,
              description: "",
              requestJson: {},
              pathParameters: {},
              importMethod: null,
              importUrl: null,
              matchUrl: null,
            },
          ],
        },
        failingDb,
      ),
    ).rejects.toThrow("forced failure");
    expect(await db.select().from(mockApis).where(eq(mockApis.projectId, projectId))).toEqual([]);
  });

  it("persists unmatched import metadata and returns generated draft ID mappings", async () => {
    const result = await saveMockApiSettings(
      projectId,
      {
        environmentVariables: [{ id: "draft-base", name: "base", value: "http://localhost:8080" }],
        headerTemplates: [],
        mockApis: [
          {
            id: "draft-unmatched",
            name: "Imported list",
            targetEndpointId: null,
            headerTemplateId: null,
            customHeaders: [],
            active: false,
            description: "",
            requestJson: {},
            pathParameters: {},
            importMethod: "GET",
            importUrl: "{{base}}/missing",
            matchUrl: "{{base}}/missing",
          },
        ],
      },
      db,
    );
    const [api] = await db.select().from(mockApis).where(eq(mockApis.projectId, projectId));
    expect(result.idMap.environmentVariables["draft-base"]).toBeTruthy();
    expect(result.idMap.mockApis["draft-unmatched"]).toBeTruthy();
    expect(api).toMatchObject({
      targetEndpointId: null,
      active: false,
      importMethod: "GET",
      importUrl: "{{base}}/missing",
      matchUrl: "{{base}}/missing",
    });
  });
});
