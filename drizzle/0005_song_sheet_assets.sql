ALTER TABLE `songs` ADD `sheet_url` text;--> statement-breakpoint
ALTER TABLE `songs` ADD `sheet_mime` text;--> statement-breakpoint
ALTER TABLE `songs` ADD `sheet_license` text;--> statement-breakpoint
ALTER TABLE `songs` ADD `sheet_source_url` text;--> statement-breakpoint
ALTER TABLE `songs` ADD `sheet_credit` text;--> statement-breakpoint
CREATE INDEX `songs_sheet_url_idx` ON `songs` (`sheet_url`);