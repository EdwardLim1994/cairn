import { randomUUID } from "node:crypto";
import {
  type AnyMySqlColumn,
  boolean,
  datetime,
  double,
  foreignKey,
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
  nodesLocked: boolean("nodes_locked").notNull().default(false),
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
    codeKey: varchar("code_key", { length: 128 })
      .notNull()
      .$defaultFn(() => randomUUID()),
    name: varchar("name", { length: 255 }).notNull(),
    apiType: varchar("api_type", { length: 32 }).$type<"REST" | "GRPC">().notNull().default("REST"),
    framework: varchar("framework", { length: 100 }).notNull(),
    baseUrl: text("base_url").notNull(),
    grpcTls: boolean("grpc_tls").notNull().default(false),
    protoStorageKey: varchar("proto_storage_key", { length: 512 }),
    protoFileName: varchar("proto_file_name", { length: 255 }),
    healthCheckUrl: text("health_check_url"),
    healthCheckHeaderTemplateId: varchar("health_check_header_template_id", {
      length: 36,
    }).references(() => headerTemplates.id, { onDelete: "set null" }),
    healthCheckCustomHeaders: json("health_check_custom_headers")
      .$type<Array<{ name: string; value: string }>>()
      .notNull()
      .default([]),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("services_project_idx").on(table.projectId),
    uniqueIndex("services_project_code_key_unique").on(table.projectId, table.codeKey),
  ],
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
    codeKey: varchar("code_key", { length: 128 })
      .notNull()
      .$defaultFn(() => randomUUID()),
    name: varchar("name", { length: 255 }).notNull(),
    method: varchar("method", { length: 10 }),
    url: text("url"),
    rpcMethod: varchar("rpc_method", { length: 512 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("endpoints_project_service_idx").on(table.projectId, table.serviceId),
    uniqueIndex("endpoints_service_code_key_unique").on(table.serviceId, table.codeKey),
  ],
);

export const mockApis = mysqlTable(
  "mock_apis",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: varchar("project_id", { length: 64 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    apiType: varchar("api_type", { length: 32 }).$type<"HTTP" | "GRPC">().notNull().default("HTTP"),
    targetEndpointId: varchar("target_endpoint_id", { length: 36 }).references(
      () => serviceEndpoints.id,
      { onDelete: "set null" },
    ),
    headerTemplateId: varchar("header_template_id", { length: 36 }).references(
      () => headerTemplates.id,
      { onDelete: "set null" },
    ),
    authorizationTemplateId: varchar("authorization_template_id", { length: 36 }),
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
  (table) => [
    index("mock_apis_project_idx").on(table.projectId),
    foreignKey({
      columns: [table.authorizationTemplateId],
      foreignColumns: [authorizationTemplates.id],
      name: "mock_apis_auth_template_fk",
    }).onDelete("set null"),
  ],
);

export const graphNodePositions = mysqlTable(
  "graph_node_positions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: varchar("project_id", { length: 64 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    nodeType: mysqlEnum("node_type", [
      "service",
      "mock_api",
      "message_destination",
      "message_queue",
    ]).notNull(),
    entityId: varchar("entity_id", { length: 36 }).notNull(),
    positionX: double("position_x").notNull(),
    positionY: double("position_y").notNull(),
  },
  (table) => [
    uniqueIndex("graph_node_positions_entity_unique").on(
      table.projectId,
      table.nodeType,
      table.entityId,
    ),
    index("graph_node_positions_project_idx").on(table.projectId),
  ],
);

export const messageDestinations = mysqlTable(
  "message_destinations",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: varchar("project_id", { length: 64 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    queueId: varchar("queue_id", { length: 36 }).notNull().default("legacy-queue"),
    queueName: varchar("queue_name", { length: 255 }).notNull().default("Message Queue"),
    codeKey: varchar("code_key", { length: 128 }).notNull(),
    broker: mysqlEnum("broker", ["kafka", "rabbitmq"]).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    connection: json("connection").$type<Record<string, string | boolean | undefined>>().notNull(),
  },
  (table) => [
    uniqueIndex("message_destinations_project_code_key_unique").on(table.projectId, table.codeKey),
    index("message_destinations_project_idx").on(table.projectId),
  ],
);

export const messageConnections = mysqlTable(
  "message_connections",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: varchar("project_id", { length: 64 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    destinationId: varchar("destination_id", { length: 36 })
      .notNull()
      .references(() => messageDestinations.id, { onDelete: "cascade" }),
    type: mysqlEnum("type", ["publish", "subscribe"]).notNull(),
    endpointId: varchar("endpoint_id", { length: 36 }).references(() => serviceEndpoints.id, {
      onDelete: "cascade",
    }),
    subscriptionId: varchar("subscription_id", { length: 36 }).references(
      (): AnyMySqlColumn => messageConnections.id,
      { onDelete: "cascade" },
    ),
    serviceId: varchar("service_id", { length: 36 }).references(() => services.id, {
      onDelete: "cascade",
    }),
    consumerGroup: varchar("consumer_group", { length: 255 }),
    routingKey: varchar("routing_key", { length: 255 }),
    bindingKey: varchar("binding_key", { length: 255 }),
  },
  (table) => [index("message_connections_project_idx").on(table.projectId)],
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

export const authorizationTemplates = mysqlTable(
  "authorization_templates",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: varchar("project_id", { length: 64 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    type: mysqlEnum("type", ["bearer", "basic", "api-key", "oauth-client-credentials"]).notNull(),
    config: json("config").$type<Record<string, string>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("authorization_templates_project_name_unique").on(table.projectId, table.name),
    index("authorization_templates_project_idx").on(table.projectId),
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

export const otelAccessTokens = mysqlTable(
  "otel_access_tokens",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: varchar("project_id", { length: 64 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    digest: varchar("digest", { length: 64 }).notNull(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("otel_access_tokens_digest_unique").on(table.digest),
    index("otel_access_tokens_project_idx").on(table.projectId),
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
    sourceEndpointId: varchar("source_endpoint_id", { length: 36 }).references(
      () => serviceEndpoints.id,
      { onDelete: "cascade" },
    ),
    sourceSubscriptionId: varchar("source_subscription_id", { length: 36 }).references(
      () => messageConnections.id,
      { onDelete: "cascade" },
    ),
    targetEndpointId: varchar("target_endpoint_id", { length: 36 })
      .notNull()
      .references(() => serviceEndpoints.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("service_edges_project_source_endpoint_target_unique").on(
      table.projectId,
      table.sourceEndpointId,
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
    grpcStatus: int("grpc_status"),
    grpcStatusName: varchar("grpc_status_name", { length: 64 }),
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

export const mockApiCallHistory = mysqlTable(
  "mock_api_call_history",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    projectId: varchar("project_id", { length: 64 })
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    runId: varchar("run_id", { length: 36 })
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    mockApiId: varchar("mock_api_id", { length: 36 }).notNull(),
    mockApiName: varchar("mock_api_name", { length: 255 }).notNull(),
    method: varchar("method", { length: 10 }).notNull(),
    url: text("url").notNull(),
    requestBody: json("request_body").$type<unknown>(),
    traceId: varchar("trace_id", { length: 32 }).notNull(),
    status: mysqlEnum("status", ["running", "completed", "failed"]).notNull().default("running"),
    triggeredAt: timestamp("triggered_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("mock_api_call_history_run_unique").on(table.runId),
    index("mock_api_call_history_project_triggered_idx").on(table.projectId, table.triggeredAt),
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
