CREATE TABLE `account_bookmarks` (
	`account_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `account_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_username_unique` ON `accounts` (`username`);--> statement-breakpoint
CREATE TABLE `auth_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`bucket` integer NOT NULL,
	`attempts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `community_songs` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`genre` text NOT NULL,
	`rhythm` text NOT NULL,
	`key` text NOT NULL,
	`content` text NOT NULL,
	`published` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
