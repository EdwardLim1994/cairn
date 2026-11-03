CREATE TABLE `graph_node_positions` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(64) NOT NULL,
	`node_type` enum('service','mock_api') NOT NULL,
	`entity_id` varchar(36) NOT NULL,
	`position_x` double NOT NULL,
	`position_y` double NOT NULL,
	CONSTRAINT `graph_node_positions_id` PRIMARY KEY(`id`),
	CONSTRAINT `graph_node_positions_entity_unique` UNIQUE(`project_id`,`node_type`,`entity_id`)
);
--> statement-breakpoint
ALTER TABLE `graph_node_positions` ADD CONSTRAINT `graph_node_positions_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `graph_node_positions_project_idx` ON `graph_node_positions` (`project_id`);--> statement-breakpoint
ALTER TABLE `mock_apis` DROP COLUMN `position_x`;--> statement-breakpoint
ALTER TABLE `mock_apis` DROP COLUMN `position_y`;--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `mock_node_x`;--> statement-breakpoint
ALTER TABLE `projects` DROP COLUMN `mock_node_y`;--> statement-breakpoint
ALTER TABLE `services` DROP COLUMN `position_x`;--> statement-breakpoint
ALTER TABLE `services` DROP COLUMN `position_y`;