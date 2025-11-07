ALTER TABLE `api_key` ADD `expires_at` integer;--> statement-breakpoint
ALTER TABLE `api_key` ADD `scopes` text NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `max_api_scopes` text;