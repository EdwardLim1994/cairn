ALTER TABLE `mock_apis` ADD `api_type` varchar(32) DEFAULT 'REST' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `api_type` varchar(32) DEFAULT 'REST' NOT NULL;--> statement-breakpoint
UPDATE `services` s JOIN `service_endpoints` e ON e.`service_id` = s.`id` SET s.`api_type` = e.`api_type`;--> statement-breakpoint
ALTER TABLE `service_endpoints` DROP COLUMN `api_type`;
