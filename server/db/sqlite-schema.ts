import {
  sqliteTable,
  check,
  text,
  real,
  integer,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const projects = sqliteTable("projects", {
  id: text().primaryKey(),
  viewportX: real("viewport_x").default(0).notNull(),
  viewportY: real("viewport_y").default(0).notNull(),
  viewportZoom: real("viewport_zoom").default(1).notNull(),
  nodesLocked: integer("nodes_locked", { mode: "boolean" }).default(false).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(unixepoch() * 1000)`)
    .notNull(),
});

export const headerTemplates = sqliteTable(
  "header_templates",
  {
    id: text().primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text().notNull(),
    headers: text("headers", { mode: "json" })
      .$type<Array<{ name: string; value: string }>>()
      .default([])
      .notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(unixepoch() * 1000)`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(unixepoch() * 1000)`)
      .notNull(),
  },
  (table) => [
    index("header_templates_project_idx").on(table.projectId),
    uniqueIndex("header_templates_project_name_unique").on(table.projectId, table.name),
  ],
);

export const authorizationTemplates = sqliteTable(
  "authorization_templates",
  {
    id: text().primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text().notNull(),
    type: text("type", {
      enum: ["bearer", "basic", "api-key", "oauth-client-credentials"],
    }).notNull(),
    config: text("config", { mode: "json" }).$type<Record<string, string>>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(unixepoch() * 1000)`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(unixepoch() * 1000)`)
      .notNull(),
  },
  (table) => [
    index("authorization_templates_project_idx").on(table.projectId),
    uniqueIndex("authorization_templates_project_name_unique").on(table.projectId, table.name),
    check(
      "authorization_templates_type_check",
      sql`${table.type} IN ('bearer','basic','api-key','oauth-client-credentials')`,
    ),
  ],
);

export const services = sqliteTable(
  "services",
  {
    id: text().primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text().notNull(),
    apiType: text("api_type", { enum: ["REST", "GRPC", "WEBSOCKET"] })
      .default("REST")
      .notNull(),
    framework: text().notNull(),
    baseUrl: text("base_url").notNull(),
    grpcTls: integer("grpc_tls", { mode: "boolean" }).default(false).notNull(),
    protoStorageKey: text("proto_storage_key"),
    protoFileName: text("proto_file_name"),
    healthCheckUrl: text("health_check_url"),
    healthCheckHeaderTemplateId: text("health_check_header_template_id").references(
      () => headerTemplates.id,
      { onDelete: "set null" },
    ),
    healthCheckCustomHeaders: text("health_check_custom_headers", { mode: "json" })
      .$type<Array<{ name: string; value: string }>>()
      .default([])
      .notNull(),
    active: integer({ mode: "boolean" }).default(true).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(unixepoch() * 1000)`)
      .notNull(),
  },
  (table) => [
    index("services_project_idx").on(table.projectId),
    check("services_api_type_check", sql`${table.apiType} IN ('REST','GRPC','WEBSOCKET')`),
  ],
);

export const serviceEndpoints = sqliteTable(
  "service_endpoints",
  {
    id: text().primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    name: text().notNull(),
    method: text(),
    url: text(),
    rpcMethod: text("rpc_method"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(unixepoch() * 1000)`)
      .notNull(),
  },
  (table) => [
    index("endpoints_service_idx").on(table.serviceId),
    index("endpoints_project_service_idx").on(table.projectId, table.serviceId),
  ],
);

export const mockApis = sqliteTable(
  "mock_apis",
  {
    id: text().primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text().notNull(),
    apiType: text("api_type", { enum: ["HTTP", "GRPC", "WEBSOCKET"] })
      .default("HTTP")
      .notNull(),
    targetEndpointId: text("target_endpoint_id").references(() => serviceEndpoints.id, {
      onDelete: "set null",
    }),
    headerTemplateId: text("header_template_id").references(() => headerTemplates.id, {
      onDelete: "set null",
    }),
    authorizationTemplateId: text("authorization_template_id").references(
      () => authorizationTemplates.id,
      { onDelete: "set null" },
    ),
    customHeaders: text("custom_headers", { mode: "json" })
      .$type<Array<{ name: string; value: string }>>()
      .default([])
      .notNull(),
    active: integer({ mode: "boolean" }).default(true).notNull(),
    pathParameters: text("path_parameters", { mode: "json" })
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    requestJson: text("request_json", { mode: "json" }).$type<unknown>().notNull(),
    description: text().default("").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(unixepoch() * 1000)`)
      .notNull(),
  },
  (table) => [
    index("mock_apis_project_idx").on(table.projectId),
    check("mock_apis_api_type_check", sql`${table.apiType} IN ('HTTP','GRPC','WEBSOCKET')`),
  ],
);

export const graphNodePositions = sqliteTable(
  "graph_node_positions",
  {
    id: text().primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    nodeType: text("node_type", {
      enum: ["service", "mock_api", "message_destination", "message_queue"],
    }).notNull(),
    entityId: text("entity_id").notNull(),
    positionX: real("position_x").notNull(),
    positionY: real("position_y").notNull(),
  },
  (table) => [
    index("graph_node_positions_project_idx").on(table.projectId),
    uniqueIndex("graph_node_positions_entity_unique").on(
      table.projectId,
      table.nodeType,
      table.entityId,
    ),
    check(
      "graph_node_positions_node_type_check",
      sql`${table.nodeType} IN ('service','mock_api','message_destination','message_queue')`,
    ),
  ],
);

export const messageDestinations = sqliteTable(
  "message_destinations",
  {
    id: text().primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    queueId: text("queue_id").default("legacy-queue").notNull(),
    queueName: text("queue_name").default("Message Queue").notNull(),
    broker: text("broker", { enum: ["kafka", "rabbitmq"] }).notNull(),
    name: text().notNull(),
    connection: text("connection", { mode: "json" })
      .$type<Record<string, string | boolean | undefined>>()
      .notNull(),
  },
  (table) => [
    index("message_destinations_project_idx").on(table.projectId),
    check("message_destinations_broker_check", sql`${table.broker} IN ('kafka','rabbitmq')`),
  ],
);

export const messageConnections = sqliteTable(
  "message_connections",
  {
    id: text().primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    destinationId: text("destination_id")
      .notNull()
      .references(() => messageDestinations.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["publish", "subscribe"] }).notNull(),
    endpointId: text("endpoint_id").references(() => serviceEndpoints.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id"),
    serviceId: text("service_id").references(() => services.id, { onDelete: "cascade" }),
    consumerGroup: text("consumer_group"),
    routingKey: text("routing_key"),
    bindingKey: text("binding_key"),
  },
  (table) => [
    index("message_connections_project_idx").on(table.projectId),
    check("message_connections_type_check", sql`${table.type} IN ('publish','subscribe')`),
    foreignKey(() => ({
      columns: [table.subscriptionId],
      foreignColumns: [table.id],
      name: "message_connections_subscription_id_message_connections_id_fk",
    })).onDelete("cascade"),
  ],
);

export const environmentVariables = sqliteTable(
  "environment_variables",
  {
    id: text().primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text().notNull(),
    value: text().notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(unixepoch() * 1000)`)
      .notNull(),
  },
  (table) => [
    index("environment_variables_project_idx").on(table.projectId),
    uniqueIndex("environment_variables_project_name_unique").on(table.projectId, table.name),
  ],
);

export const otelAccessTokens = sqliteTable(
  "otel_access_tokens",
  {
    id: text().primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text().notNull(),
    digest: text().notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(unixepoch() * 1000)`)
      .notNull(),
  },
  (table) => [
    index("otel_access_tokens_project_idx").on(table.projectId),
    uniqueIndex("otel_access_tokens_digest_unique").on(table.digest),
  ],
);

export const serviceEdges = sqliteTable(
  "service_edges",
  {
    id: text().primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sourceServiceId: text("source_service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    sourceEndpointId: text("source_endpoint_id").references(() => serviceEndpoints.id, {
      onDelete: "cascade",
    }),
    sourceSubscriptionId: text("source_subscription_id").references(() => messageConnections.id, {
      onDelete: "cascade",
    }),
    targetEndpointId: text("target_endpoint_id")
      .notNull()
      .references(() => serviceEndpoints.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("service_edges_project_idx").on(table.projectId),
    uniqueIndex("service_edges_project_source_endpoint_target_unique").on(
      table.projectId,
      table.sourceEndpointId,
      table.targetEndpointId,
    ),
  ],
);

export const runs = sqliteTable(
  "runs",
  {
    id: text().primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    mockApiId: text("mock_api_id").references(() => mockApis.id, { onDelete: "set null" }),
    traceId: text("trace_id").notNull(),
    status: text("status", { enum: ["running", "completed", "failed"] })
      .default("running")
      .notNull(),
    responseStatus: integer("response_status"),
    grpcStatus: integer("grpc_status"),
    grpcStatusName: text("grpc_status_name"),
    responseHeaders: text("response_headers", { mode: "json" }).$type<Record<string, string>>(),
    responseBody: text("response_body"),
    error: text(),
    startedAt: integer("started_at", { mode: "timestamp_ms" })
      .default(sql`(unixepoch() * 1000)`)
      .notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    lastTelemetryAt: integer("last_telemetry_at", { mode: "timestamp_ms" }),
    firstTelemetryAt: integer("first_telemetry_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("runs_project_started_idx").on(table.projectId, table.startedAt),
    index("runs_project_trace_idx").on(table.projectId, table.traceId),
    check("runs_status_check", sql`${table.status} IN ('running','completed','failed')`),
  ],
);

export const mockApiCallHistory = sqliteTable(
  "mock_api_call_history",
  {
    id: text().primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    mockApiId: text("mock_api_id").notNull(),
    mockApiName: text("mock_api_name").notNull(),
    method: text().notNull(),
    url: text().notNull(),
    requestBody: text("request_body", { mode: "json" }).$type<unknown>(),
    traceId: text("trace_id").notNull(),
    status: text("status", { enum: ["running", "completed", "failed"] })
      .default("running")
      .notNull(),
    triggeredAt: integer("triggered_at", { mode: "timestamp_ms" })
      .default(sql`(unixepoch() * 1000)`)
      .notNull(),
  },
  (table) => [
    index("mock_api_call_history_project_triggered_idx").on(table.projectId, table.triggeredAt),
    uniqueIndex("mock_api_call_history_run_unique").on(table.runId),
    check(
      "mock_api_call_history_status_check",
      sql`${table.status} IN ('running','completed','failed')`,
    ),
  ],
);
