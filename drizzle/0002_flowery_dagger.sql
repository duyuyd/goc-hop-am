CREATE TABLE `google_identities` (
	`subject` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `google_nonces` (
	`hash` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `store_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`product_id` text NOT NULL,
	`title` text NOT NULL,
	`amount_vnd` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_ref` text DEFAULT '' NOT NULL,
	`buyer_note` text DEFAULT '' NOT NULL,
	`admin_note` text DEFAULT '' NOT NULL,
	`reviewed_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`reviewed_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `store_products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_open_order` ON `store_orders` (`account_id`,`product_id`) WHERE "store_orders"."status" in ('pending','review');--> statement-breakpoint
CREATE TABLE `store_products` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`kind` text DEFAULT 'sale' NOT NULL,
	`cover` text NOT NULL,
	`pages` integer NOT NULL,
	`bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`file_key` text NOT NULL,
	`price_vnd` integer DEFAULT 0 NOT NULL,
	`selling` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
