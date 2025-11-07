CREATE TABLE `account` (
	`account_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`status` integer DEFAULT 0 NOT NULL,
	`latest_email_time` text,
	`create_time` text DEFAULT CURRENT_TIMESTAMP,
	`user_id` integer NOT NULL,
	`is_del` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `api_key` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`description` text,
	`key_prefix` text NOT NULL,
	`hashed_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`last_used_at` text
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`att_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`email_id` integer NOT NULL,
	`account_id` integer NOT NULL,
	`key` text NOT NULL,
	`filename` text,
	`mime_type` text,
	`size` integer,
	`status` text DEFAULT 0 NOT NULL,
	`type` integer DEFAULT 0 NOT NULL,
	`disposition` text,
	`related` text,
	`content_id` text,
	`encoding` text,
	`create_time` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email` (
	`email_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`send_email` text,
	`name` text,
	`account_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`subject` text,
	`text` text,
	`content` text,
	`cc` text DEFAULT '[]',
	`bcc` text DEFAULT '[]',
	`recipient` text,
	`to_email` text DEFAULT '' NOT NULL,
	`to_name` text DEFAULT '' NOT NULL,
	`in_reply_to` text DEFAULT '',
	`relation` text DEFAULT '',
	`message_id` text DEFAULT '',
	`type` integer DEFAULT 0 NOT NULL,
	`status` integer DEFAULT 0 NOT NULL,
	`resend_email_id` text,
	`message` text,
	`create_time` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`is_del` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `perm` (
	`perm_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`perm_key` text,
	`pid` integer DEFAULT 0 NOT NULL,
	`type` integer DEFAULT 2 NOT NULL,
	`sort` integer
);
--> statement-breakpoint
CREATE TABLE `reg_key` (
	`rege_key_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text DEFAULT '' NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`role_id` integer DEFAULT 0 NOT NULL,
	`user_id` integer DEFAULT 0 NOT NULL,
	`expire_time` text,
	`create_time` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `role_perm` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role_id` integer,
	`perm_id` integer
);
--> statement-breakpoint
CREATE TABLE `role` (
	`role_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`description` text,
	`ban_email` text DEFAULT '' NOT NULL,
	`ban_email_type` integer DEFAULT 0 NOT NULL,
	`avail_domain` text DEFAULT '',
	`sort` integer,
	`is_default` integer DEFAULT 0,
	`create_time` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`user_id` integer,
	`send_count` integer,
	`send_type` text DEFAULT 'count',
	`account_count` integer
);
--> statement-breakpoint
CREATE TABLE `setting` (
	`register` integer DEFAULT 0 NOT NULL,
	`receive` integer DEFAULT 0 NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`many_email` integer DEFAULT 0 NOT NULL,
	`add_email` integer DEFAULT 0 NOT NULL,
	`auto_refresh_time` integer DEFAULT 0 NOT NULL,
	`add_email_verify` integer DEFAULT 1 NOT NULL,
	`register_verify` integer DEFAULT 1 NOT NULL,
	`reg_verify_count` integer DEFAULT 1 NOT NULL,
	`add_verify_count` integer DEFAULT 1 NOT NULL,
	`send` integer DEFAULT 1 NOT NULL,
	`r2_domain` text,
	`secret_key` text,
	`site_key` text,
	`reg_key` integer DEFAULT 1 NOT NULL,
	`background` text,
	`tg_bot_token` text DEFAULT '' NOT NULL,
	`tg_chat_id` text DEFAULT '' NOT NULL,
	`tg_bot_status` integer DEFAULT 1 NOT NULL,
	`forward_email` text DEFAULT '' NOT NULL,
	`forward_status` integer DEFAULT 1 NOT NULL,
	`rule_email` text DEFAULT '' NOT NULL,
	`rule_type` integer DEFAULT 0 NOT NULL,
	`login_opacity` integer DEFAULT 0.88,
	`resend_tokens` text DEFAULT '{}' NOT NULL,
	`notice_title` text DEFAULT '' NOT NULL,
	`notice_content` text DEFAULT '' NOT NULL,
	`notice_type` text DEFAULT '' NOT NULL,
	`notice_duration` integer DEFAULT 0 NOT NULL,
	`notice_position` text DEFAULT '' NOT NULL,
	`notice_offset` integer DEFAULT 0 NOT NULL,
	`notice_width` integer DEFAULT 400 NOT NULL,
	`notice` integer DEFAULT 0 NOT NULL,
	`no_recipient` integer DEFAULT 1 NOT NULL,
	`login_domain` integer DEFAULT 0 NOT NULL,
	`bucket` text DEFAULT '' NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`endpoint` text DEFAULT '' NOT NULL,
	`s3_access_key` text DEFAULT '' NOT NULL,
	`s3_secret_key` text DEFAULT '' NOT NULL,
	`kv_storage` integer DEFAULT 1 NOT NULL,
	`force_path_style` integer DEFAULT 1 NOT NULL,
	`custom_domain` text DEFAULT '' NOT NULL,
	`tg_msg_from` text DEFAULT 'only-name' NOT NULL,
	`tg_msg_to` text DEFAULT 'show' NOT NULL,
	`tg_msg_text` text DEFAULT 'hide' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `star` (
	`star_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`email_id` integer NOT NULL,
	`create_time` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user` (
	`user_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`type` integer DEFAULT 1 NOT NULL,
	`password` text NOT NULL,
	`salt` text NOT NULL,
	`status` integer DEFAULT 0 NOT NULL,
	`create_time` text DEFAULT CURRENT_TIMESTAMP,
	`active_time` text,
	`create_ip` text,
	`active_ip` text,
	`os` text,
	`browser` text,
	`device` text,
	`sort` text DEFAULT 0,
	`send_count` text DEFAULT 0,
	`reg_key_id` integer DEFAULT 0 NOT NULL,
	`can_create_api_keys` integer DEFAULT 0 NOT NULL,
	`is_del` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verify_record` (
	`vr_id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ip` integer DEFAULT '' NOT NULL,
	`count` integer DEFAULT 1 NOT NULL,
	`type` integer DEFAULT 0 NOT NULL,
	`update_time` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
