CREATE TABLE `ai_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text,
	`task_type` text NOT NULL,
	`prompt_version` text NOT NULL,
	`model` text NOT NULL,
	`input_digest` text NOT NULL,
	`raw_response` text NOT NULL,
	`parsed_output` text,
	`validation_status` text NOT NULL,
	`error_code` text,
	`latency_ms` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ai_runs_case_created_at` ON `ai_runs` (`case_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `case_events` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_role` text NOT NULL,
	`actor_id` text NOT NULL,
	`before_state` text,
	`after_state` text,
	`metadata` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_case_events_case_created_at` ON `case_events` (`case_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_case_events_idempotency_key` ON `case_events` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `case_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`version` integer NOT NULL,
	`form_data` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_case_versions_case_version` ON `case_versions` (`case_id`,`version`);--> statement-breakpoint
CREATE TABLE `cases` (
	`id` text PRIMARY KEY NOT NULL,
	`case_type` text NOT NULL,
	`applicant_id` text NOT NULL,
	`applicant_name` text NOT NULL,
	`status` text NOT NULL,
	`current_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_cases_applicant_id` ON `cases` (`applicant_id`);--> statement-breakpoint
CREATE INDEX `idx_cases_status_updated_at` ON `cases` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `knowledge_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`source` text NOT NULL,
	`content` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rules` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`version` text NOT NULL,
	`source` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`capacity` integer NOT NULL,
	`equipment` text NOT NULL,
	`available_from` text NOT NULL,
	`available_to` text NOT NULL
);
