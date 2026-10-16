CREATE TABLE `family_nudges` (
	`id` text PRIMARY KEY NOT NULL,
	`family` text NOT NULL,
	`reminder` text NOT NULL,
	`date` text NOT NULL,
	`sender_name` text NOT NULL,
	`sender_relation` text NOT NULL,
	`due` text NOT NULL,
	`created` text NOT NULL,
	`seen` text,
	FOREIGN KEY (`family`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reminder`) REFERENCES `reminders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `family_nudge_day` ON `family_nudges` (`reminder`,`date`);--> statement-breakpoint
CREATE INDEX `family_nudges_family_day` ON `family_nudges` (`family`,`date`);