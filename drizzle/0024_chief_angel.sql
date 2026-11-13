CREATE INDEX `endpoints_service_idx` ON `service_endpoints` (`service_id`);--> statement-breakpoint
ALTER TABLE `message_destinations` DROP INDEX `message_destinations_project_code_key_unique`;--> statement-breakpoint
ALTER TABLE `service_endpoints` DROP INDEX `endpoints_service_code_key_unique`;--> statement-breakpoint
ALTER TABLE `services` DROP INDEX `services_project_code_key_unique`;--> statement-breakpoint
ALTER TABLE `message_destinations` DROP COLUMN `code_key`;--> statement-breakpoint
ALTER TABLE `mock_apis` DROP COLUMN `import_method`;--> statement-breakpoint
ALTER TABLE `mock_apis` DROP COLUMN `import_url`;--> statement-breakpoint
ALTER TABLE `mock_apis` DROP COLUMN `match_url`;--> statement-breakpoint
ALTER TABLE `service_endpoints` DROP COLUMN `code_key`;--> statement-breakpoint
ALTER TABLE `services` DROP COLUMN `code_key`;
