import mysql from "mysql2/promise";
import { eq, inArray } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import * as schema from "../../db/schema";
import {
  environmentVariables,
  headerTemplates,
  mockApis,
  projects,
  serviceEndpoints,
  services,
} from "../../db/schema";
import {
  createHeaderTemplate,
  deleteHeaderTemplate,
  findHeaderTemplate,
  listMockApis,
  updateHeaderTemplate,
} from ".";
import { deleteEnvironmentVariable, updateEnvironmentVariable } from "../environment-variables";
import { updateService } from "../services";

const connectionString = process.env.CAIRN_TEST_DATABASE_URL;
const integration = describe.skipIf(!connectionString);

integration("header template repository with MySQL", () => {
  const projectId = "header-template-project";
  const otherProjectId = "header-template-other-project";
  let pool: mysql.Pool;
  let db: MySql2Database<typeof schema>;

  beforeAll(async () => {
    pool = mysql.createPool(connectionString!);
    db = drizzle({ client: pool, schema, mode: "default" });
    await pool.query("SELECT 1");
  });

  beforeEach(async () => {
    await db.delete(projects).where(inArray(projects.id, [projectId, otherProjectId]));
  });

  afterAll(async () => pool?.end());

  it("keeps template lookup scoped to its project", async () => {
    await db.insert(projects).values([{ id: projectId }, { id: otherProjectId }]);
    await createHeaderTemplate(
      "header-template-1",
      projectId,
      {
        name: "Auth",
        headers: [{ name: "Authorization", value: "Bearer {{token}}" }],
      },
      db,
    );

    expect(await findHeaderTemplate(projectId, "header-template-1", db)).toBe(true);
    expect(await findHeaderTemplate(otherProjectId, "header-template-1", db)).toBe(false);
    await createHeaderTemplate(
      "foreign-health-template",
      otherProjectId,
      { name: "Foreign", headers: [] },
      db,
    );
    await db.insert(services).values({
      id: "health-template-owner-service",
      projectId,
      name: "Orders",
      framework: "Other",
      baseUrl: "http://localhost:8080",
    });
    await expect(
      updateService(
        projectId,
        "health-template-owner-service",
        {
          name: "Orders",
          framework: "Other",
          baseUrl: "http://localhost:8080",
          healthCheckUrl: "/health",
          healthCheckHeaderTemplateId: "foreign-health-template",
          healthCheckCustomHeaders: [],
          active: true,
          endpoints: [],
        },
        db,
      ),
    ).rejects.toThrow("Selected health-check header template is not in this project");
  });

  it("detaches referencing APIs and rolls back on delete failure", async () => {
    await db.insert(projects).values({ id: projectId });
    await createHeaderTemplate(
      "header-template-2",
      projectId,
      {
        name: "Tenant",
        headers: [{ name: "X-Tenant", value: "tenant-a" }],
      },
      db,
    );
    await db.insert(mockApis).values({
      id: "header-template-api",
      projectId,
      name: "Orders",
      requestJson: {},
      headerTemplateId: "header-template-2",
      customHeaders: [{ name: "X-Request", value: "kept" }],
      active: false,
    });
    await db.insert(services).values({
      id: "header-template-service",
      projectId,
      name: "Orders",
      framework: "Other",
      baseUrl: "http://localhost:8080",
      healthCheckHeaderTemplateId: "header-template-2",
      healthCheckCustomHeaders: [{ name: "X-Local", value: "kept" }],
    });

    const failingDb = {
      transaction: (run: (tx: unknown) => Promise<unknown>) =>
        db.transaction((tx) =>
          run(
            new Proxy(tx, {
              get(target, key) {
                if (key === "delete")
                  return () => ({ where: () => Promise.reject(new Error("forced failure")) });
                return Reflect.get(target, key);
              },
            }),
          ),
        ),
    } as unknown as MySql2Database<typeof schema>;

    await expect(deleteHeaderTemplate(projectId, "header-template-2", failingDb)).rejects.toThrow(
      "forced failure",
    );
    expect(await findHeaderTemplate(projectId, "header-template-2", db)).toBe(true);

    expect(await deleteHeaderTemplate(projectId, "header-template-2", db)).toBe(true);
    const [api] = await db.select().from(mockApis).where(eq(mockApis.id, "header-template-api"));
    expect(api?.headerTemplateId).toBeNull();
    expect(api?.customHeaders).toEqual([{ name: "X-Request", value: "kept" }]);
    const [service] = await db
      .select()
      .from(services)
      .where(eq(services.id, "header-template-service"));
    expect(service?.healthCheckHeaderTemplateId).toBeNull();
    expect(service?.healthCheckCustomHeaders).toEqual([{ name: "X-Local", value: "kept" }]);
    expect(
      await db.select().from(headerTemplates).where(eq(headerTemplates.projectId, projectId)),
    ).toEqual([]);
  });

  it("keeps valid legacy APIs active and persists deactivation for incomplete APIs", async () => {
    await db.insert(projects).values({ id: projectId });
    await db.insert(services).values({
      id: "readiness-service",
      projectId,
      name: "Orders",
      framework: "REST",
      baseUrl: "http://localhost:8080",
    });
    await db.insert(serviceEndpoints).values({
      id: "readiness-endpoint",
      projectId,
      serviceId: "readiness-service",
      name: "List",
      method: "GET",
      url: "/orders",
    });
    await db.insert(mockApis).values([
      {
        id: "readiness-valid",
        projectId,
        name: "Valid legacy API",
        targetEndpointId: "readiness-endpoint",
        requestJson: {},
      },
      {
        id: "readiness-incomplete",
        projectId,
        name: "Incomplete API",
        requestJson: {},
      },
    ]);

    const rows = await listMockApis(projectId, db);
    expect(rows.find(({ id }) => id === "readiness-valid")).toMatchObject({
      active: true,
      status: "ready",
    });
    expect(rows.find(({ id }) => id === "readiness-incomplete")).toMatchObject({
      active: false,
      status: "draft",
    });
    const [persisted] = await db
      .select()
      .from(mockApis)
      .where(eq(mockApis.id, "readiness-incomplete"));
    expect(persisted?.active).toBe(false);
  });

  it("deactivates APIs transactionally when variables or templates become invalid", async () => {
    await db.insert(projects).values({ id: projectId });
    await db.insert(services).values({
      id: "mutation-service",
      projectId,
      name: "Orders",
      framework: "REST",
      baseUrl: "http://localhost:8080",
    });
    await db.insert(serviceEndpoints).values({
      id: "mutation-endpoint",
      projectId,
      serviceId: "mutation-service",
      name: "List",
      method: "GET",
      url: "/orders",
    });
    await db.insert(environmentVariables).values({
      id: "mutation-variable",
      projectId,
      name: "token",
      value: "secret",
    });
    await createHeaderTemplate(
      "mutation-template",
      projectId,
      { name: "Auth", headers: [{ name: "Authorization", value: "Bearer {{token}}" }] },
      db,
    );
    await db.insert(mockApis).values([
      {
        id: "mutation-dependent",
        projectId,
        name: "Dependent",
        targetEndpointId: "mutation-endpoint",
        headerTemplateId: "mutation-template",
        requestJson: {},
      },
      {
        id: "mutation-unaffected",
        projectId,
        name: "Unaffected",
        targetEndpointId: "mutation-endpoint",
        requestJson: {},
      },
    ]);

    await updateEnvironmentVariable(
      "mutation-variable",
      projectId,
      { name: "renamed", value: "secret" },
      db,
    );
    let rows = await db.select().from(mockApis).where(eq(mockApis.projectId, projectId));
    expect(rows.find(({ id }) => id === "mutation-dependent")?.active).toBe(false);
    expect(rows.find(({ id }) => id === "mutation-unaffected")?.active).toBe(true);

    await updateEnvironmentVariable(
      "mutation-variable",
      projectId,
      { name: "token", value: "restored" },
      db,
    );
    rows = await db.select().from(mockApis).where(eq(mockApis.projectId, projectId));
    expect(rows.find(({ id }) => id === "mutation-dependent")?.active).toBe(false);

    await updateHeaderTemplate(
      projectId,
      "mutation-template",
      { name: "Auth", headers: [{ name: "Authorization", value: "Bearer {{missing}}" }] },
      db,
    );
    rows = await db.select().from(mockApis).where(eq(mockApis.projectId, projectId));
    expect(rows.find(({ id }) => id === "mutation-dependent")?.active).toBe(false);

    await updateHeaderTemplate(
      projectId,
      "mutation-template",
      { name: "Auth", headers: [{ name: "Authorization", value: "Bearer {{token}}" }] },
      db,
    );
    await updateService(
      projectId,
      "mutation-service",
      {
        name: "Orders",
        framework: "REST",
        baseUrl: "http://localhost:8080",
        healthCheckUrl: null,
        healthCheckHeaderTemplateId: null,
        healthCheckCustomHeaders: [],
        active: true,
        endpoints: [
          {
            id: "mutation-endpoint",
            name: "List",
            apiType: "REST",
            method: "GET",
            url: "/orders",
          },
        ],
      },
      db,
    );
    await db.update(mockApis).set({ active: true }).where(eq(mockApis.id, "mutation-dependent"));
    await updateService(
      projectId,
      "mutation-service",
      {
        name: "Orders",
        framework: "REST",
        baseUrl: "http://localhost:8080",
        healthCheckUrl: null,
        healthCheckHeaderTemplateId: null,
        healthCheckCustomHeaders: [],
        active: true,
        endpoints: [
          {
            id: "mutation-endpoint",
            name: "List",
            apiType: "REST",
            method: "GET",
            url: "/orders/{orderId}",
          },
        ],
      },
      db,
    );
    rows = await db.select().from(mockApis).where(eq(mockApis.projectId, projectId));
    expect(rows.find(({ id }) => id === "mutation-dependent")?.active).toBe(false);

    await db.update(mockApis).set({ active: true }).where(eq(mockApis.id, "mutation-dependent"));
    await deleteEnvironmentVariable(projectId, "mutation-variable", db);
    rows = await db.select().from(mockApis).where(eq(mockApis.projectId, projectId));
    expect(rows.find(({ id }) => id === "mutation-dependent")?.active).toBe(false);
  });
});
