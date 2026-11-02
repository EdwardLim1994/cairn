CREATE TABLE `otel_access_tokens` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`digest` varchar(64) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `otel_access_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `otel_access_tokens_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `otel_access_tokens_digest_unique` ON `otel_access_tokens` (`digest`);
--> statement-breakpoint
CREATE INDEX `otel_access_tokens_project_idx` ON `otel_access_tokens` (`project_id`);
