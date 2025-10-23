-- Migration: store AI prompts and responses for bot executions
ALTER TABLE bot_executions ADD COLUMN ai_prompt TEXT;
--> statement-breakpoint
ALTER TABLE bot_executions ADD COLUMN ai_response TEXT;
--> statement-breakpoint
