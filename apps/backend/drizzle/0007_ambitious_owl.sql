CREATE TABLE IF NOT EXISTS `bot_performance_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`bot_id` text NOT NULL,
	`total_balance` real NOT NULL,
	`snapshot_time` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`bot_id`) REFERENCES `trading_bots`(`id`) ON UPDATE no action ON DELETE cascade
);