ALTER TABLE `service_endpoints` ADD `code_key` varchar(128);--> statement-breakpoint
UPDATE `service_endpoints` SET `code_key` = UUID() WHERE `code_key` IS NULL;--> statement-breakpoint
ALTER TABLE `service_endpoints` MODIFY `code_key` varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `code_key` varchar(128);--> statement-breakpoint
UPDATE `services` SET `code_key` = UUID() WHERE `code_key` IS NULL;--> statement-breakpoint
ALTER TABLE `services` MODIFY `code_key` varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE `service_endpoints` ADD CONSTRAINT `endpoints_service_code_key_unique` UNIQUE(`service_id`,`code_key`);--> statement-breakpoint
ALTER TABLE `services` ADD CONSTRAINT `services_project_code_key_unique` UNIQUE(`project_id`,`code_key`);
