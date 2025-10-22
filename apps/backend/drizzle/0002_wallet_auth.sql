-- Add wallet authentication support
-- Migration: 0002_wallet_auth

-- Create nonces table for replay attack prevention
CREATE TABLE `nonces` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_address` text NOT NULL,
	`nonce` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nonces_nonce_unique` ON `nonces` (`nonce`);
--> statement-breakpoint

-- Modify users table to support wallet-only authentication
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_address` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `__new_users_wallet_address_unique` ON `__new_users` (`wallet_address`);
--> statement-breakpoint
-- Note: This migration will fail if there are existing users without wallet addresses
-- For existing users, you may need to manually migrate or clear the database
INSERT INTO `__new_users`("id", "wallet_address", "display_name", "created_at")
SELECT "id", COALESCE("wallet_address", "email"), "display_name", "created_at" FROM `users` WHERE "wallet_address" IS NOT NULL OR "email" IS NOT NULL;
--> statement-breakpoint
DROP TABLE `users`;
--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;

