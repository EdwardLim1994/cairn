CREATE TABLE `header_templates` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`headers` json NOT NULL DEFAULT ('[]'),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `header_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `header_templates_project_name_unique` UNIQUE(`project_id`,`name`)
);
--> statement-breakpoint
ALTER TABLE `mock_apis` ADD `header_template_id` varchar(36);--> statement-breakpoint
ALTER TABLE `mock_apis` ADD `custom_headers` json DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `mock_apis` ADD `active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `mock_apis` ADD `import_method` varchar(10);--> statement-breakpoint
ALTER TABLE `mock_apis` ADD `import_url` text;--> statement-breakpoint
ALTER TABLE `mock_apis` ADD `match_url` text;--> statement-breakpoint
ALTER TABLE `header_templates` ADD CONSTRAINT `header_templates_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `header_templates_project_idx` ON `header_templates` (`project_id`);--> statement-breakpoint
ALTER TABLE `mock_apis` ADD CONSTRAINT `mock_apis_header_template_id_header_templates_id_fk` FOREIGN KEY (`header_template_id`) REFERENCES `header_templates`(`id`) ON DELETE set null ON UPDATE no action;