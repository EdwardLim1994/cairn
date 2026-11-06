ALTER TABLE `mock_apis` MODIFY COLUMN `api_type` varchar(32) NOT NULL DEFAULT 'HTTP';--> statement-breakpoint
UPDATE `mock_apis` SET `api_type` = 'HTTP' WHERE `api_type` = 'REST';
