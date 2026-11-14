CREATE TABLE `ai_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`song_id` text NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`result_url` text,
	`result_key` text,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_active_ai_job` ON `ai_jobs` (`account_id`,`song_id`) WHERE "ai_jobs"."status" in ('pending','processing');