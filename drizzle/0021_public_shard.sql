ALTER TABLE `graph_node_positions` MODIFY COLUMN `node_type` enum('service','mock_api','message_destination','message_queue') NOT NULL;--> statement-breakpoint
ALTER TABLE `message_destinations` ADD `queue_id` varchar(36) DEFAULT 'legacy-queue' NOT NULL;
--> statement-breakpoint
INSERT INTO `graph_node_positions` (`id`, `project_id`, `node_type`, `entity_id`, `position_x`, `position_y`)
SELECT UUID(), `destination`.`project_id`, 'message_queue', `destination`.`queue_id`, COALESCE(AVG(`position`.`position_x`), 0), COALESCE(AVG(`position`.`position_y`), 0)
FROM `message_destinations` AS `destination`
LEFT JOIN `graph_node_positions` AS `position`
  ON `position`.`project_id` = `destination`.`project_id`
  AND `position`.`node_type` = 'message_destination'
  AND `position`.`entity_id` = `destination`.`id`
GROUP BY `destination`.`project_id`, `destination`.`queue_id`
ON DUPLICATE KEY UPDATE `position_x` = VALUES(`position_x`), `position_y` = VALUES(`position_y`);
