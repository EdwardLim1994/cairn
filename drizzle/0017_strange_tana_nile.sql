-- Some databases already applied the earlier gRPC migration chain before it was
-- reconciled with the GraphQL migration history. Check each column so both
-- those databases and fresh installs converge on the same schema.
ALTER TABLE `service_endpoints` MODIFY COLUMN `method` varchar(10) NULL;--> statement-breakpoint
ALTER TABLE `service_endpoints` MODIFY COLUMN `url` text NULL;--> statement-breakpoint
SET @cairn_column_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'runs' AND column_name = 'grpc_status');--> statement-breakpoint
SET @cairn_migration_sql = IF(@cairn_column_exists = 0, 'ALTER TABLE `runs` ADD `grpc_status` int', 'SELECT 1');--> statement-breakpoint
PREPARE cairn_migration_stmt FROM @cairn_migration_sql;--> statement-breakpoint
EXECUTE cairn_migration_stmt;--> statement-breakpoint
DEALLOCATE PREPARE cairn_migration_stmt;--> statement-breakpoint
SET @cairn_column_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'runs' AND column_name = 'grpc_status_name');--> statement-breakpoint
SET @cairn_migration_sql = IF(@cairn_column_exists = 0, 'ALTER TABLE `runs` ADD `grpc_status_name` varchar(64)', 'SELECT 1');--> statement-breakpoint
PREPARE cairn_migration_stmt FROM @cairn_migration_sql;--> statement-breakpoint
EXECUTE cairn_migration_stmt;--> statement-breakpoint
DEALLOCATE PREPARE cairn_migration_stmt;--> statement-breakpoint
SET @cairn_column_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'service_endpoints' AND column_name = 'rpc_method');--> statement-breakpoint
SET @cairn_migration_sql = IF(@cairn_column_exists = 0, 'ALTER TABLE `service_endpoints` ADD `rpc_method` varchar(512)', 'SELECT 1');--> statement-breakpoint
PREPARE cairn_migration_stmt FROM @cairn_migration_sql;--> statement-breakpoint
EXECUTE cairn_migration_stmt;--> statement-breakpoint
DEALLOCATE PREPARE cairn_migration_stmt;--> statement-breakpoint
SET @cairn_column_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'services' AND column_name = 'grpc_tls');--> statement-breakpoint
SET @cairn_migration_sql = IF(@cairn_column_exists = 0, 'ALTER TABLE `services` ADD `grpc_tls` boolean DEFAULT false NOT NULL', 'SELECT 1');--> statement-breakpoint
PREPARE cairn_migration_stmt FROM @cairn_migration_sql;--> statement-breakpoint
EXECUTE cairn_migration_stmt;--> statement-breakpoint
DEALLOCATE PREPARE cairn_migration_stmt;--> statement-breakpoint
SET @cairn_column_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'services' AND column_name = 'proto_storage_key');--> statement-breakpoint
SET @cairn_migration_sql = IF(@cairn_column_exists = 0, 'ALTER TABLE `services` ADD `proto_storage_key` varchar(512)', 'SELECT 1');--> statement-breakpoint
PREPARE cairn_migration_stmt FROM @cairn_migration_sql;--> statement-breakpoint
EXECUTE cairn_migration_stmt;--> statement-breakpoint
DEALLOCATE PREPARE cairn_migration_stmt;--> statement-breakpoint
SET @cairn_column_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'services' AND column_name = 'proto_file_name');--> statement-breakpoint
SET @cairn_migration_sql = IF(@cairn_column_exists = 0, 'ALTER TABLE `services` ADD `proto_file_name` varchar(255)', 'SELECT 1');--> statement-breakpoint
PREPARE cairn_migration_stmt FROM @cairn_migration_sql;--> statement-breakpoint
EXECUTE cairn_migration_stmt;--> statement-breakpoint
DEALLOCATE PREPARE cairn_migration_stmt;--> statement-breakpoint
UPDATE `services` SET `proto_file_name` = 'Uploaded proto' WHERE `proto_file_name` IS NULL AND `proto_storage_key` IS NOT NULL;
