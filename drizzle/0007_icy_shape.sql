CREATE TABLE `authorization_templates` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('bearer','basic','api-key','oauth-client-credentials') NOT NULL,
	`config` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `authorization_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `authorization_templates_project_name_unique` UNIQUE(`project_id`,`name`)
);
--> statement-breakpoint
ALTER TABLE `mock_apis` ADD `authorization_template_id` varchar(36);--> statement-breakpoint
ALTER TABLE `authorization_templates` ADD CONSTRAINT `authorization_templates_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `authorization_templates_project_idx` ON `authorization_templates` (`project_id`);--> statement-breakpoint
ALTER TABLE `mock_apis` ADD CONSTRAINT `mock_apis_auth_template_fk` FOREIGN KEY (`authorization_template_id`) REFERENCES `authorization_templates`(`id`) ON DELETE set null ON UPDATE no action;