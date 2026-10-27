ALTER TABLE `mock_apis` ADD `request_json` json NULL;--> statement-breakpoint
UPDATE `mock_apis` AS m LEFT JOIN `service_endpoints` AS e ON e.`id` = m.`target_endpoint_id` SET m.`request_json` = COALESCE(e.`request_json`, JSON_OBJECT());--> statement-breakpoint
ALTER TABLE `mock_apis` MODIFY `request_json` json NOT NULL;--> statement-breakpoint
ALTER TABLE `service_endpoints` DROP COLUMN `request_json`;
