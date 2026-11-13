CREATE TABLE `authorization_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`config` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "authorization_templates_type_check" CHECK("authorization_templates"."type" IN ('bearer','basic','api-key','oauth-client-credentials'))
);
--> statement-breakpoint
CREATE INDEX `authorization_templates_project_idx` ON `authorization_templates` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `authorization_templates_project_name_unique` ON `authorization_templates` (`project_id`,`name`);--> statement-breakpoint
CREATE TABLE `environment_variables` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`value` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `environment_variables_project_idx` ON `environment_variables` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `environment_variables_project_name_unique` ON `environment_variables` (`project_id`,`name`);--> statement-breakpoint
CREATE TABLE `graph_node_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`node_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`position_x` real NOT NULL,
	`position_y` real NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "graph_node_positions_node_type_check" CHECK("graph_node_positions"."node_type" IN ('service','mock_api','message_destination','message_queue'))
);
--> statement-breakpoint
CREATE INDEX `graph_node_positions_project_idx` ON `graph_node_positions` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `graph_node_positions_entity_unique` ON `graph_node_positions` (`project_id`,`node_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `header_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`headers` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `header_templates_project_idx` ON `header_templates` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `header_templates_project_name_unique` ON `header_templates` (`project_id`,`name`);--> statement-breakpoint
CREATE TABLE `message_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`destination_id` text NOT NULL,
	`type` text NOT NULL,
	`endpoint_id` text,
	`subscription_id` text,
	`service_id` text,
	`consumer_group` text,
	`routing_key` text,
	`binding_key` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`destination_id`) REFERENCES `message_destinations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`endpoint_id`) REFERENCES `service_endpoints`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subscription_id`) REFERENCES `message_connections`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "message_connections_type_check" CHECK("message_connections"."type" IN ('publish','subscribe'))
);
--> statement-breakpoint
CREATE INDEX `message_connections_project_idx` ON `message_connections` (`project_id`);--> statement-breakpoint
CREATE TABLE `message_destinations` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`queue_id` text DEFAULT 'legacy-queue' NOT NULL,
	`queue_name` text DEFAULT 'Message Queue' NOT NULL,
	`broker` text NOT NULL,
	`name` text NOT NULL,
	`connection` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "message_destinations_broker_check" CHECK("message_destinations"."broker" IN ('kafka','rabbitmq'))
);
--> statement-breakpoint
CREATE INDEX `message_destinations_project_idx` ON `message_destinations` (`project_id`);--> statement-breakpoint
CREATE TABLE `mock_api_call_history` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`run_id` text NOT NULL,
	`mock_api_id` text NOT NULL,
	`mock_api_name` text NOT NULL,
	`method` text NOT NULL,
	`url` text NOT NULL,
	`request_body` text,
	`trace_id` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`triggered_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "mock_api_call_history_status_check" CHECK("mock_api_call_history"."status" IN ('running','completed','failed'))
);
--> statement-breakpoint
CREATE INDEX `mock_api_call_history_project_triggered_idx` ON `mock_api_call_history` (`project_id`,`triggered_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `mock_api_call_history_run_unique` ON `mock_api_call_history` (`run_id`);--> statement-breakpoint
CREATE TABLE `mock_apis` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`api_type` text DEFAULT 'HTTP' NOT NULL,
	`target_endpoint_id` text,
	`header_template_id` text,
	`authorization_template_id` text,
	`custom_headers` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`path_parameters` text DEFAULT '{}' NOT NULL,
	`request_json` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_endpoint_id`) REFERENCES `service_endpoints`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`header_template_id`) REFERENCES `header_templates`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`authorization_template_id`) REFERENCES `authorization_templates`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "mock_apis_api_type_check" CHECK("mock_apis"."api_type" IN ('HTTP','GRPC','WEBSOCKET'))
);
--> statement-breakpoint
CREATE INDEX `mock_apis_project_idx` ON `mock_apis` (`project_id`);--> statement-breakpoint
CREATE TABLE `otel_access_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`digest` text NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `otel_access_tokens_project_idx` ON `otel_access_tokens` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `otel_access_tokens_digest_unique` ON `otel_access_tokens` (`digest`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`viewport_x` real DEFAULT 0 NOT NULL,
	`viewport_y` real DEFAULT 0 NOT NULL,
	`viewport_zoom` real DEFAULT 1 NOT NULL,
	`nodes_locked` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`mock_api_id` text,
	`trace_id` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`response_status` integer,
	`grpc_status` integer,
	`grpc_status_name` text,
	`response_headers` text,
	`response_body` text,
	`error` text,
	`started_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`finished_at` integer,
	`last_telemetry_at` integer,
	`first_telemetry_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mock_api_id`) REFERENCES `mock_apis`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "runs_status_check" CHECK("runs"."status" IN ('running','completed','failed'))
);
--> statement-breakpoint
CREATE INDEX `runs_project_started_idx` ON `runs` (`project_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `runs_project_trace_idx` ON `runs` (`project_id`,`trace_id`);--> statement-breakpoint
CREATE TABLE `service_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`source_service_id` text NOT NULL,
	`source_endpoint_id` text,
	`source_subscription_id` text,
	`target_endpoint_id` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_endpoint_id`) REFERENCES `service_endpoints`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_subscription_id`) REFERENCES `message_connections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_endpoint_id`) REFERENCES `service_endpoints`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `service_edges_project_idx` ON `service_edges` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `service_edges_project_source_endpoint_target_unique` ON `service_edges` (`project_id`,`source_endpoint_id`,`target_endpoint_id`);--> statement-breakpoint
CREATE TABLE `service_endpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`service_id` text NOT NULL,
	`name` text NOT NULL,
	`method` text,
	`url` text,
	`rpc_method` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `endpoints_service_idx` ON `service_endpoints` (`service_id`);--> statement-breakpoint
CREATE INDEX `endpoints_project_service_idx` ON `service_endpoints` (`project_id`,`service_id`);--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`api_type` text DEFAULT 'REST' NOT NULL,
	`framework` text NOT NULL,
	`base_url` text NOT NULL,
	`grpc_tls` integer DEFAULT false NOT NULL,
	`proto_storage_key` text,
	`proto_file_name` text,
	`health_check_url` text,
	`health_check_header_template_id` text,
	`health_check_custom_headers` text DEFAULT '[]' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`health_check_header_template_id`) REFERENCES `header_templates`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "services_api_type_check" CHECK("services"."api_type" IN ('REST','GRPC','WEBSOCKET'))
);
--> statement-breakpoint
CREATE INDEX `services_project_idx` ON `services` (`project_id`);