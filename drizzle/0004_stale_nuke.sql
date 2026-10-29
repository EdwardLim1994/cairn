ALTER TABLE `environment_variables` ADD `value_text` text NULL;

--> statement-breakpoint

UPDATE `environment_variables`
SET `value_text` = CASE
  WHEN JSON_TYPE(`value`) = 'STRING' THEN JSON_UNQUOTE(`value`)
  ELSE CAST(`value` AS CHAR)
END;

--> statement-breakpoint

ALTER TABLE `environment_variables`
  DROP COLUMN `value`,
  CHANGE COLUMN `value_text` `value` text NOT NULL;
