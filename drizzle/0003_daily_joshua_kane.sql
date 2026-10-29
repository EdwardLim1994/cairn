CREATE TABLE `environment_variables` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`value` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `environment_variables_id` PRIMARY KEY(`id`),
	CONSTRAINT `environment_variables_project_name_unique` UNIQUE(`project_id`,`name`)
);
--> statement-breakpoint
ALTER TABLE `mock_apis` ADD `path_parameters` json DEFAULT ('{}') NOT NULL;--> statement-breakpoint
ALTER TABLE `environment_variables` ADD CONSTRAINT `environment_variables_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `environment_variables_project_idx` ON `environment_variables` (`project_id`);