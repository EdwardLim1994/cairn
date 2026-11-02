CREATE TABLE `mock_api_call_history` (
	`id` varchar(36) NOT NULL,
	`project_id` varchar(64) NOT NULL,
	`run_id` varchar(36) NOT NULL,
	`mock_api_id` varchar(36) NOT NULL,
	`mock_api_name` varchar(255) NOT NULL,
	`method` varchar(10) NOT NULL,
	`url` text NOT NULL,
	`request_body` json,
	`trace_id` varchar(32) NOT NULL,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`triggered_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mock_api_call_history_id` PRIMARY KEY(`id`),
	CONSTRAINT `mock_api_call_history_run_unique` UNIQUE(`run_id`)
);
--> statement-breakpoint
ALTER TABLE `mock_api_call_history` ADD CONSTRAINT `mock_api_call_history_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mock_api_call_history` ADD CONSTRAINT `mock_api_call_history_run_id_runs_id_fk` FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mock_api_call_history_project_triggered_idx` ON `mock_api_call_history` (`project_id`,`triggered_at`);
