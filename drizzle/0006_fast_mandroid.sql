ALTER TABLE `services` ADD `health_check_url` text;--> statement-breakpoint
ALTER TABLE `services` ADD `health_check_header_template_id` varchar(36);--> statement-breakpoint
ALTER TABLE `services` ADD `health_check_custom_headers` json DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_health_check_header_template_id_header_templates_id_fk` FOREIGN KEY (`health_check_header_template_id`) REFERENCES `header_templates`(`id`) ON DELETE set null ON UPDATE no action;