ALTER TABLE `service_edges` DROP INDEX `service_edges_project_source_target_unique`;--> statement-breakpoint
ALTER TABLE `service_edges` ADD `source_endpoint_id` varchar(36);--> statement-breakpoint
ALTER TABLE `service_edges` ADD CONSTRAINT `service_edges_project_source_endpoint_target_unique` UNIQUE(`project_id`,`source_endpoint_id`,`target_endpoint_id`);--> statement-breakpoint
ALTER TABLE `service_edges` ADD CONSTRAINT `service_edges_source_endpoint_id_service_endpoints_id_fk` FOREIGN KEY (`source_endpoint_id`) REFERENCES `service_endpoints`(`id`) ON DELETE cascade ON UPDATE no action;