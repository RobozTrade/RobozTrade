CREATE TABLE `bot_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bot_id` text,
	`tx_hash` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'USDT' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`block_number` integer,
	`created_at` integer DEFAULT (unixepoch()),
	`confirmed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bot_id`) REFERENCES `trading_bots`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bot_payments_tx_hash_unique` ON `bot_payments` (`tx_hash`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_trading_bots` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`api_key_id` text,
	`aster_api_key` text,
	`aster_api_secret` text,
	`openrouter_api_key` text,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`strategy_type` text NOT NULL,
	`trading_pair` text NOT NULL,
	`config` text,
	`risk_config` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_trading_bots`("id", "user_id", "api_key_id", "aster_api_key", "aster_api_secret", "openrouter_api_key", "name", "status", "strategy_type", "trading_pair", "config", "risk_config", "created_at", "updated_at") SELECT "id", "user_id", "api_key_id", "aster_api_key", "aster_api_secret", "openrouter_api_key", "name", "status", "strategy_type", "trading_pair", "config", "risk_config", "created_at", "updated_at" FROM `trading_bots`;--> statement-breakpoint
DROP TABLE `trading_bots`;--> statement-breakpoint
ALTER TABLE `__new_trading_bots` RENAME TO `trading_bots`;--> statement-breakpoint
PRAGMA foreign_keys=ON;