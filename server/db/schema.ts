import {
  boolean,
  datetime,
  double,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const projects = mysqlTable("projects", {
  id: varchar("id", { length: 64 }).primaryKey(),
  viewportX: double("viewport_x").notNull().default(0),
  viewportY: double("viewport_y").notNull().default(0),
  viewportZoom: double("viewport_zoom").notNull().default(1),
  mockNodeX: double("mock_node_x").notNull().default(120),
  mockNodeY: double("mock_node_y").notNull().default(120),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const services = mysqlTable(
  "services",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: varchar("project_id", { length: 64 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    framework: varchar("framework", { length: 100 }).notNull(),
    baseUrl: text("base_url").notNull(),
    active: boolean("active").notNull().default(true),
    positionX: double("position_x").notNull().default(0),
    positionY: double("position_y").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("services_project_idx").on(table.projectId)],
);

export const serviceEndpoints = mysqlTable(
  "service_endpoints",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: varchar("project_id", { length: 64 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    serviceId: varchar("service_id", { length: 36 })
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    apiType: varchar("api_type", { length: 32 }).notNull().default("REST"),
    method: varchar("method", { length: 10 }).notNull(),
    url: text("url").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("endpoints_project_service_idx").on(table.projectId, table.serviceId)],
);

export const mockApis = mysqlTable(
  "mock_apis",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: varchar("project_id", { length: 64 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    targetEndpointId: varchar("target_endpoint_id", { length: 36 }).references(
      () => serviceEndpoints.id,
      { onDelete: "set null" },
    ),
    headerTemplateId: varchar("header_template_id", { length: 36 }).references(
      () => headerTemplates.id,
      { onDelete: "set null" },
    ),
    customHeaders: json("custom_headers")
      .$type<Array<{ name: string; value: string }>>()
      .notNull()
      .default([]),
    active: boolean("active").notNull().default(true),
    importMethod: varchar("import_method", { length: 10 }),
    importUrl: text("import_url"),
    matchUrl: text("match_url"),
    pathParameters: json("path_parameters").$type<Record<string, string>>().notNull().default({}),
    requestJson: json("request_json").$type<unknown>().notNull(),
    description: text("description").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("mock_apis_project_idx").on(table.projectId)],
);

export const headerTemplates = mysqlTable(
  "header_templates",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: varchar("project_id", { length: 64 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    headers: json("headers").$type<Array<{ name: string; value: string }>>().notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("header_templates_project_name_unique").on(table.projectId, table.name),
    index("header_templates_project_idx").on(table.projectId),
  ],
);

export const environmentVariables = mysqlTable(
  "environment_variables",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: varchar("project_id", { length: 64 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("environment_variables_project_name_unique").on(table.projectId, table.name),
    index("environment_variables_project_idx").on(table.projectId),
  ],
);

export const serviceEdges = mysqlTable(
  "service_edges",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: varchar("project_id", { length: 64 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sourceServiceId: varchar("source_service_id", { length: 36 })
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    targetEndpointId: varchar("target_endpoint_id", { length: 36 })
      .notNull()
      .references(() => serviceEndpoints.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("service_edges_project_source_target_unique").on(
      table.projectId,
      table.sourceServiceId,
      table.targetEndpointId,
    ),
    index("service_edges_project_idx").on(table.projectId),
  ],
);

export const runs = mysqlTable(
  "runs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: varchar("project_id", { length: 64 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    mockApiId: varchar("mock_api_id", { length: 36 }).references(() => mockApis.id, {
      onDelete: "set null",
    }),
    traceId: varchar("trace_id", { length: 32 }).notNull(),
    status: mysqlEnum("status", ["running", "completed", "failed"]).notNull().default("running"),
    responseStatus: int("response_status"),
    responseHeaders: json("response_headers").$type<Record<string, string>>(),
    responseBody: text("response_body"),
    error: text("error"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
    lastTelemetryAt: timestamp("last_telemetry_at"),
  },
  (table) => [
    index("runs_project_trace_idx").on(table.projectId, table.traceId),
    index("runs_project_started_idx").on(table.projectId, table.startedAt),
  ],
);

export const spans = mysqlTable(
  "spans",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: varchar("project_id", { length: 64 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    traceId: varchar("trace_id", { length: 32 }).notNull(),
    spanId: varchar("span_id", { length: 16 }).notNull(),
    parentSpanId: varchar("parent_span_id", { length: 16 }),
    serviceName: varchar("service_name", { length: 255 }).notNull(),
    operationName: varchar("operation_name", { length: 255 }).notNull(),
    startTime: datetime("start_time", { mode: "date", fsp: 3 }).notNull(),
    endTime: datetime("end_time", { mode: "date", fsp: 3 }).notNull(),
    statusCode: varchar("status_code", { length: 32 }).notNull().default("UNSET"),
    attributes: json("attributes").$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("spans_project_trace_span_unique").on(table.projectId, table.traceId, table.spanId),
    index("spans_project_trace_idx").on(table.projectId, table.traceId),
  ],
);

export const logs = mysqlTable(
  "logs",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: varchar("project_id", { length: 64 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    traceId: varchar("trace_id", { length: 32 }),
    serviceName: varchar("service_name", { length: 255 }).notNull(),
    severity: varchar("severity", { length: 20 }).notNull(),
    timestamp: datetime("timestamp", { mode: "date", fsp: 3 }).notNull(),
    message: text("message").notNull(),
    attributes: json("attributes").$type<Record<string, unknown>>().notNull(),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
  },
  (table) => [
    index("logs_project_service_time_idx").on(table.projectId, table.serviceName, table.timestamp),
    index("logs_project_trace_idx").on(table.projectId, table.traceId),
  ],
);
