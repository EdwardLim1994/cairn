ALTER TABLE `message_connections` ADD `subscription_id` varchar(36);--> statement-breakpoint
ALTER TABLE `service_edges` ADD `source_subscription_id` varchar(36);