CREATE TABLE `message_connections` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(64) NOT NULL,
	`destination_id` varchar(36) NOT NULL,
	`type` enum('publish','subscribe') NOT NULL,
	`endpoint_id` varchar(36),
	`service_id` varchar(36),
	`consumer_group` varchar(255),
	`routing_key` varchar(255),
	`binding_key` varchar(255),
	CONSTRAINT `message_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `message_destinations` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(64) NOT NULL,
	`code_key` varchar(128) NOT NULL,
	`broker` enum('kafka','rabbitmq') NOT NULL,
	`name` varchar(255) NOT NULL,
	`connection` json NOT NULL,
	CONSTRAINT `message_destinations_id` PRIMARY KEY(`id`),
	CONSTRAINT `message_destinations_project_code_key_unique` UNIQUE(`project_id`,`code_key`)
);
--> statement-breakpoint
ALTER TABLE `graph_node_positions` MODIFY COLUMN `node_type` enum('service','mock_api','message_destination') NOT NULL;--> statement-breakpoint
ALTER TABLE `message_connections` ADD CONSTRAINT `message_connections_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_connections` ADD CONSTRAINT `message_connections_destination_id_message_destinations_id_fk` FOREIGN KEY (`destination_id`) REFERENCES `message_destinations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_connections` ADD CONSTRAINT `message_connections_endpoint_id_service_endpoints_id_fk` FOREIGN KEY (`endpoint_id`) REFERENCES `service_endpoints`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_connections` ADD CONSTRAINT `message_connections_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `message_destinations` ADD CONSTRAINT `message_destinations_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `message_connections_project_idx` ON `message_connections` (`project_id`);--> statement-breakpoint
CREATE INDEX `message_destinations_project_idx` ON `message_destinations` (`project_id`);