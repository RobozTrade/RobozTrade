-- Migration: store AI metadata for bot executions
ALTER TABLE bot_executions ADD COLUMN ai_thinking TEXT;
--> statement-breakpoint
ALTER TABLE bot_executions ADD COLUMN ai_runtime_ms INTEGER;
--> statement-breakpoint
ALTER TABLE bot_executions ADD COLUMN ai_invocations INTEGER;
--> statement-breakpoint
ALTER TABLE bot_executions ADD COLUMN account_balance REAL;
--> statement-breakpoint
ALTER TABLE bot_executions ADD COLUMN account_exposure REAL;
--> statement-breakpoint
