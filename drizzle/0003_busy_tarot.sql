CREATE TABLE `history_tracking` (
	`family` text PRIMARY KEY NOT NULL,
	`start_date` text NOT NULL,
	`started_at` text NOT NULL,
	FOREIGN KEY (`family`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reminder_revisions` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`family` text NOT NULL,
	`reminder` text NOT NULL,
	`effective` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`time` text NOT NULL,
	`frequency` text NOT NULL,
	`date` text NOT NULL,
	`weekday` integer NOT NULL,
	`note` text NOT NULL,
	`active` integer NOT NULL,
	FOREIGN KEY (`family`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reminder`) REFERENCES `reminders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `revision_family_time` ON `reminder_revisions` (`family`,`effective`);--> statement-breakpoint
CREATE INDEX `revision_reminder_time` ON `reminder_revisions` (`reminder`,`effective`);