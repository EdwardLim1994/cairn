import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { getDb } from "../db";
import {
  environmentVariables,
  headerTemplates,
  authorizationTemplates,
  mockApis,
  projects,
  serviceEndpoints,
  services,
} from "../db/schema";
import { saveMockApiSettings } from "./mock-api-settings";
import { listMockApis } from "./mock-apis/index";

const integrationEnabled = process.env.CAIRN_RUN_INTEGRATION;
const integration = describe.skipIf(!integrationEnabled);

integration("mock API settings save with SQLite", () => {
  const projectId = "mock-settings-project";
  let db: ReturnType<typeof getDb>;

  beforeAll(async () => {
    db = getDb();
  });

  beforeEach(async () => {
    await db.delete(projects).where(eq(projects.id, "other-auth-project"));
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
    await db.insert(services).values({
      id: "mock-settings-websocket-service",
      projectId,
      name: "Events",
      apiType: "WEBSOCKET",
      framework: "Other",
      baseUrl: "wss://example.test/events",
    });
    await db.insert(serviceEndpoints).values({
      id: "mock-settings-websocket-endpoint",
      projectId,
      serviceId: "mock-settings-websocket-service",
      name: "Event stream",
      url: "wss://example.test/events",
    });
  });

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
        authorizationTemplates: [],
        mockApis: [
          {
            id: "draft-api",
            apiType: "HTTP",
            name: "List orders",
            targetEndpointId: "mock-settings-endpoint",
            headerTemplateId: "draft-auth",
            customHeaders: [],
            active: true,
            description: "",
            requestJson: {},
            pathParameters: {},
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

  it("saves and reloads exact WebSocket message text on a matching endpoint", async () => {
    const message = '  subscribe {{channel}}\n{"limit": 2}  ';
    await saveMockApiSettings(
      projectId,
      {
        environmentVariables: [{ id: "draft-channel", name: "channel", value: "orders" }],
        headerTemplates: [],
        authorizationTemplates: [],
        mockApis: [
          {
            id: "draft-websocket-api",
            apiType: "WEBSOCKET",
            name: "Watch order events",
            targetEndpointId: "mock-settings-websocket-endpoint",
            headerTemplateId: null,
            customHeaders: [],
            active: true,
            description: "",
            requestJson: message,
            pathParameters: {},
          },
        ],
      },
      db,
    );

    const apis = await listMockApis(projectId, db);
    expect(apis).toMatchObject([
      {
        apiType: "WEBSOCKET",
        targetEndpointId: "mock-settings-websocket-endpoint",
        requestJson: message,
        status: "ready",
      },
    ]);
  });

  it("maps and persists authorization template drafts with API assignments", async () => {
    const result = await saveMockApiSettings(
      projectId,
      {
        environmentVariables: [],
        headerTemplates: [],
        authorizationTemplates: [
          { id: "draft-auth", name: "Bearer auth", type: "bearer", token: "{{TOKEN}}" },
        ],
        mockApis: [
          {
            id: "draft-auth-api",
            apiType: "HTTP",
            name: "Authenticated API",
            targetEndpointId: "mock-settings-endpoint",
            authorizationTemplateId: "draft-auth",
            headerTemplateId: null,
            customHeaders: [],
            active: true,
            description: "",
            requestJson: {},
            pathParameters: {},
          },
        ],
      },
      db,
    );
    const [template] = await db
      .select()
      .from(authorizationTemplates)
      .where(eq(authorizationTemplates.projectId, projectId));
    const [api] = await db.select().from(mockApis).where(eq(mockApis.projectId, projectId));
    expect(result.idMap.authorizationTemplates["draft-auth"]).toBe(template?.id);
    expect(result.idMap.mockApis["draft-auth-api"]).toBe(api?.id);
    expect(template).toMatchObject({ type: "bearer", config: { token: "{{TOKEN}}" } });
    expect(api?.authorizationTemplateId).toBe(template?.id);
  });

  it("rejects duplicate names and authorization templates owned by another project", async () => {
    await db.insert(projects).values({ id: "other-auth-project" });
    await db.insert(authorizationTemplates).values({
      id: "foreign-auth-template",
      projectId: "other-auth-project",
      name: "Foreign",
      type: "bearer",
      config: { token: "secret" },
    });
    const duplicate = {
      environmentVariables: [],
      headerTemplates: [],
      authorizationTemplates: [
        { id: "draft-auth-1", name: "Same", type: "bearer" as const, token: "one" },
        { id: "draft-auth-2", name: "same", type: "bearer" as const, token: "two" },
      ],
      mockApis: [],
    };
    await expect(saveMockApiSettings(projectId, duplicate, db)).rejects.toThrow(
      "Duplicate authorization template: same",
    );
    await expect(
      saveMockApiSettings(
        projectId,
        {
          environmentVariables: [],
          headerTemplates: [],
          authorizationTemplates: [],
          mockApis: [
            {
              id: "draft-foreign-assignment",
              apiType: "HTTP",
              name: "Invalid assignment",
              targetEndpointId: "mock-settings-endpoint",
              authorizationTemplateId: "foreign-auth-template",
              headerTemplateId: null,
              customHeaders: [],
              active: true,
              description: "",
              requestJson: {},
              pathParameters: {},
            },
          ],
        },
        db,
      ),
    ).rejects.toThrow("Selected authorization template is unavailable for Invalid assignment");
    expect(await db.select().from(mockApis).where(eq(mockApis.projectId, projectId))).toEqual([]);
    expect(
      await db
        .select()
        .from(authorizationTemplates)
        .where(eq(authorizationTemplates.projectId, projectId)),
    ).toEqual([]);
  });

  it("detaches APIs when a staged authorization template is deleted", async () => {
    const initial = await saveMockApiSettings(
      projectId,
      {
        environmentVariables: [],
        headerTemplates: [],
        authorizationTemplates: [
          { id: "draft-delete-auth", name: "Temporary", type: "bearer", token: "secret" },
        ],
        mockApis: [
          {
            id: "draft-delete-api",
            apiType: "HTTP",
            name: "Temporary API",
            targetEndpointId: "mock-settings-endpoint",
            authorizationTemplateId: "draft-delete-auth",
            headerTemplateId: null,
            customHeaders: [],
            active: true,
            description: "",
            requestJson: {},
            pathParameters: {},
          },
        ],
      },
      db,
    );
    const apiId = initial.idMap.mockApis["draft-delete-api"]!;
    await saveMockApiSettings(
      projectId,
      {
        environmentVariables: [],
        headerTemplates: [],
        authorizationTemplates: [],
        mockApis: [
          {
            id: apiId,
            apiType: "HTTP",
            name: "Temporary API",
            targetEndpointId: "mock-settings-endpoint",
            authorizationTemplateId: null,
            headerTemplateId: null,
            customHeaders: [],
            active: true,
            description: "",
            requestJson: {},
            pathParameters: {},
          },
        ],
      },
      db,
    );
    const [api] = await db.select().from(mockApis).where(eq(mockApis.id, apiId));
    expect(api?.authorizationTemplateId).toBeNull();
    expect(
      await db
        .select()
        .from(authorizationTemplates)
        .where(eq(authorizationTemplates.projectId, projectId)),
    ).toEqual([]);
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
    } as unknown as ReturnType<typeof getDb>;

    await expect(
      saveMockApiSettings(
        projectId,
        {
          environmentVariables: [],
          headerTemplates: [],
          authorizationTemplates: [],
          mockApis: [
            {
              id: "draft-invalid-api",
              apiType: "HTTP",
              name: "Invalid",
              targetEndpointId: null,
              headerTemplateId: null,
              customHeaders: [],
              active: true,
              description: "",
              requestJson: {},
              pathParameters: {},
            },
          ],
        },
        failingDb,
      ),
    ).rejects.toThrow("forced failure");
    expect(await db.select().from(mockApis).where(eq(mockApis.projectId, projectId))).toEqual([]);
  });

  it("persists an unmatched draft and returns generated ID mappings", async () => {
    const result = await saveMockApiSettings(
      projectId,
      {
        environmentVariables: [{ id: "draft-base", name: "base", value: "http://localhost:8080" }],
        headerTemplates: [],
        authorizationTemplates: [],
        mockApis: [
          {
            id: "draft-unmatched",
            apiType: "HTTP",
            name: "Manual draft",
            targetEndpointId: null,
            headerTemplateId: null,
            customHeaders: [],
            active: false,
            description: "",
            requestJson: {},
            pathParameters: {},
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
    });
  });
});
