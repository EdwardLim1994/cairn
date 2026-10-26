CREATE TABLE `logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` varchar(64) NOT NULL,
	`trace_id` varchar(32),
	`service_name` varchar(255) NOT NULL,
	`severity` varchar(20) NOT NULL,
	`timestamp` datetime(3) NOT NULL,
	`message` text NOT NULL,
	`attributes` json NOT NULL,
	`received_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mock_apis` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`method` varchar(10) NOT NULL DEFAULT 'GET',
	`url` text NOT NULL,
	`target_endpoint_id` varchar(36),
	`description` text NOT NULL DEFAULT (''),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mock_apis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` varchar(64) NOT NULL,
	`viewport_x` double NOT NULL DEFAULT 0,
	`viewport_y` double NOT NULL DEFAULT 0,
	`viewport_zoom` double NOT NULL DEFAULT 1,
	`mock_node_x` double NOT NULL DEFAULT 120,
	`mock_node_y` double NOT NULL DEFAULT 120,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(64) NOT NULL,
	`mock_api_id` varchar(36),
	`trace_id` varchar(32) NOT NULL,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`response_status` int,
	`response_headers` json,
	`response_body` text,
	`error` text,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`finished_at` timestamp,
	`last_telemetry_at` timestamp,
	CONSTRAINT `runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_edges` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(64) NOT NULL,
	`source_service_id` varchar(36) NOT NULL,
	`target_endpoint_id` varchar(36) NOT NULL,
	CONSTRAINT `service_edges_id` PRIMARY KEY(`id`),
	CONSTRAINT `service_edges_project_source_target_unique` UNIQUE(`project_id`,`source_service_id`,`target_endpoint_id`)
);
--> statement-breakpoint
CREATE TABLE `service_endpoints` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(64) NOT NULL,
	`service_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`api_type` varchar(32) NOT NULL DEFAULT 'REST',
	`method` varchar(10) NOT NULL,
	`url` text NOT NULL,
	`request_json` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `service_endpoints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`framework` varchar(100) NOT NULL,
	`base_url` text NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`position_x` double NOT NULL DEFAULT 0,
	`position_y` double NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `spans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`project_id` varchar(64) NOT NULL,
	`trace_id` varchar(32) NOT NULL,
	`span_id` varchar(16) NOT NULL,
	`parent_span_id` varchar(16),
	`service_name` varchar(255) NOT NULL,
	`operation_name` varchar(255) NOT NULL,
	`start_time` datetime(3) NOT NULL,
	`end_time` datetime(3) NOT NULL,
	`status_code` varchar(32) NOT NULL DEFAULT 'UNSET',
	`attributes` json NOT NULL,
	`received_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `spans_id` PRIMARY KEY(`id`),
	CONSTRAINT `spans_project_trace_span_unique` UNIQUE(`project_id`,`trace_id`,`span_id`)
);
--> statement-breakpoint
ALTER TABLE `logs` ADD CONSTRAINT `logs_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mock_apis` ADD CONSTRAINT `mock_apis_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mock_apis` ADD CONSTRAINT `mock_apis_target_endpoint_id_service_endpoints_id_fk` FOREIGN KEY (`target_endpoint_id`) REFERENCES `service_endpoints`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `runs` ADD CONSTRAINT `runs_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `runs` ADD CONSTRAINT `runs_mock_api_id_mock_apis_id_fk` FOREIGN KEY (`mock_api_id`) REFERENCES `mock_apis`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_edges` ADD CONSTRAINT `service_edges_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_edges` ADD CONSTRAINT `service_edges_source_service_id_services_id_fk` FOREIGN KEY (`source_service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_edges` ADD CONSTRAINT `service_edges_target_endpoint_id_service_endpoints_id_fk` FOREIGN KEY (`target_endpoint_id`) REFERENCES `service_endpoints`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_endpoints` ADD CONSTRAINT `service_endpoints_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_endpoints` ADD CONSTRAINT `service_endpoints_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `spans` ADD CONSTRAINT `spans_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `logs_project_service_time_idx` ON `logs` (`project_id`,`service_name`,`timestamp`);--> statement-breakpoint
CREATE INDEX `logs_project_trace_idx` ON `logs` (`project_id`,`trace_id`);--> statement-breakpoint
CREATE INDEX `mock_apis_project_idx` ON `mock_apis` (`project_id`);--> statement-breakpoint
CREATE INDEX `runs_project_trace_idx` ON `runs` (`project_id`,`trace_id`);--> statement-breakpoint
CREATE INDEX `runs_project_started_idx` ON `runs` (`project_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `service_edges_project_idx` ON `service_edges` (`project_id`);--> statement-breakpoint
CREATE INDEX `endpoints_project_service_idx` ON `service_endpoints` (`project_id`,`service_id`);--> statement-breakpoint
CREATE INDEX `services_project_idx` ON `services` (`project_id`);--> statement-breakpoint
CREATE INDEX `spans_project_trace_idx` ON `spans` (`project_id`,`trace_id`);