CREATE TABLE `checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`family` text NOT NULL,
	`date` text NOT NULL,
	`mood` text NOT NULL,
	`updated` text NOT NULL,
	FOREIGN KEY (`family`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checkins_family_day` ON `checkins` (`family`,`date`);--> statement-breakpoint
CREATE TABLE `families` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`city` text NOT NULL,
	`share` integer DEFAULT 1 NOT NULL,
	`check_time` text DEFAULT '10:00' NOT NULL,
	`invite` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `families_owner` ON `families` (`owner`);--> statement-breakpoint
CREATE UNIQUE INDEX `families_invite` ON `families` (`invite`);--> statement-breakpoint
CREATE TABLE `members` (
	`user` text PRIMARY KEY NOT NULL,
	`family` text NOT NULL,
	`role` text NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`family`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`family` text NOT NULL,
	`reminder` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`snooze` text,
	`updated` text NOT NULL,
	FOREIGN KEY (`reminder`) REFERENCES `reminders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `occurrence_day` ON `occurrences` (`reminder`,`date`);--> statement-breakpoint
CREATE INDEX `occurrence_family_day` ON `occurrences` (`family`,`date`);--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`family` text NOT NULL,
	`date` text NOT NULL,
	`mood` text NOT NULL,
	`sleep` integer NOT NULL,
	`systolic` integer,
	`diastolic` integer,
	`note` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`family`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `records_family_day` ON `records` (`family`,`date`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`family` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`time` text NOT NULL,
	`frequency` text NOT NULL,
	`date` text NOT NULL,
	`weekday` integer NOT NULL,
	`note` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`family`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reminders_family` ON `reminders` (`family`);--> statement-breakpoint
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`family` text NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL,
	`seen` text,
	`resolved` text,
	FOREIGN KEY (`family`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `requests_family` ON `requests` (`family`);