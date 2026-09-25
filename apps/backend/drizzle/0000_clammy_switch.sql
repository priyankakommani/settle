CREATE TYPE "public"."approval_decision" AS ENUM('pending', 'approved', 'rejected', 'returned');--> statement-breakpoint
CREATE TYPE "public"."city_tier" AS ENUM('TIER_1', 'TIER_2', 'TIER_3');--> statement-breakpoint
CREATE TYPE "public"."claim_category" AS ENUM('lodging', 'conveyance', 'meal', 'business_entertainment', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_category" AS ENUM('travel_approval', 'advance', 'flight', 'hotel_booking', 'hotel_invoice', 'cab', 'meal', 'business_entertainment', 'noise', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."document_source" AS ENUM('eml', 'image', 'manual');--> statement-breakpoint
CREATE TYPE "public"."employee_role" AS ENUM('Employee', 'Reporting Manager', 'Head of Department', 'Head of Division', 'MD', 'Finance');--> statement-breakpoint
CREATE TYPE "public"."paid_by" AS ENUM('Employee', 'Company');--> statement-breakpoint
CREATE TYPE "public"."policy_verdict" AS ENUM('allowed', 'capped', 'disallowed', 'needs_info');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'RETURNED', 'REJECTED', 'PENDING_FINANCE', 'VERIFIED', 'PAID');--> statement-breakpoint
CREATE TABLE "employees" (
	"emp_code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"designation" text NOT NULL,
	"department" text NOT NULL,
	"cost_centre" text NOT NULL,
	"city" text NOT NULL,
	"city_tier" "city_tier",
	"reporting_manager_code" text,
	"role" "employee_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "policy_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"city_tier" "city_tier",
	"value" numeric(14, 2) NOT NULL,
	"unit" text,
	"note" text,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "policy_config_key_tier_uq" UNIQUE("key","city_tier")
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"travel_request_id" text NOT NULL,
	"employee_code" text NOT NULL,
	"purpose" text,
	"origin_city" text,
	"dest_city" text,
	"dest_tier" "city_tier",
	"is_international" text,
	"start_date" date,
	"end_date" date,
	"full_days" integer,
	"advance_ref" text,
	"advance_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" "trip_status" DEFAULT 'DRAFT' NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_travel_request_id_unique" UNIQUE("travel_request_id")
);
--> statement-breakpoint
CREATE TABLE "raw_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"source_type" "document_source" NOT NULL,
	"from_addr" text,
	"subject" text,
	"sent_at" timestamp with time zone,
	"message_id" text,
	"raw_blob_ref" text,
	"parsed_json" jsonb,
	"category" "document_category" DEFAULT 'unknown' NOT NULL,
	"category_confidence" numeric(4, 3),
	"is_noise" boolean DEFAULT false NOT NULL,
	"is_duplicate_of" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_document_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer,
	"blob_ref" text NOT NULL,
	"ocr_text" text,
	"ocr_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"source_document_id" uuid,
	"category" "claim_category" NOT NULL,
	"merchant" text,
	"description" text,
	"line_date" date,
	"currency" text DEFAULT 'INR' NOT NULL,
	"gross_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"paid_by" "paid_by" DEFAULT 'Employee' NOT NULL,
	"policy_verdict" "policy_verdict",
	"allowed_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"disallowed_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"reason_code" text,
	"reason_text" text,
	"policy_meta" jsonb,
	"proof_ref" text,
	"edited_by_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"total_employee_paid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_company_paid_memo" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_disallowed" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_reimbursable" numeric(14, 2) DEFAULT '0' NOT NULL,
	"advance_drawn" numeric(14, 2) DEFAULT '0' NOT NULL,
	"amount_payable" numeric(14, 2) DEFAULT '0' NOT NULL,
	"amount_recoverable" numeric(14, 2) DEFAULT '0' NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlements_trip_id_unique" UNIQUE("trip_id")
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"role" "employee_role" NOT NULL,
	"approver_code" text,
	"decision" "approval_decision" DEFAULT 'pending' NOT NULL,
	"remarks" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approvals_trip_level_uq" UNIQUE("trip_id","level")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid,
	"actor_code" text,
	"action" text NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"request_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_reporting_manager_code_employees_emp_code_fk" FOREIGN KEY ("reporting_manager_code") REFERENCES "public"."employees"("emp_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_employee_code_employees_emp_code_fk" FOREIGN KEY ("employee_code") REFERENCES "public"."employees"("emp_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_documents" ADD CONSTRAINT "raw_documents_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_documents" ADD CONSTRAINT "raw_documents_is_duplicate_of_raw_documents_id_fk" FOREIGN KEY ("is_duplicate_of") REFERENCES "public"."raw_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_raw_document_id_raw_documents_id_fk" FOREIGN KEY ("raw_document_id") REFERENCES "public"."raw_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_lines" ADD CONSTRAINT "claim_lines_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_lines" ADD CONSTRAINT "claim_lines_source_document_id_raw_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."raw_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_code_employees_emp_code_fk" FOREIGN KEY ("approver_code") REFERENCES "public"."employees"("emp_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employees_manager_idx" ON "employees" USING btree ("reporting_manager_code");--> statement-breakpoint
CREATE INDEX "employees_role_idx" ON "employees" USING btree ("role");--> statement-breakpoint
CREATE INDEX "trips_employee_idx" ON "trips" USING btree ("employee_code");--> statement-breakpoint
CREATE INDEX "trips_status_idx" ON "trips" USING btree ("status");--> statement-breakpoint
CREATE INDEX "raw_documents_trip_idx" ON "raw_documents" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "raw_documents_category_idx" ON "raw_documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "raw_documents_message_id_idx" ON "raw_documents" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "attachments_doc_idx" ON "attachments" USING btree ("raw_document_id");--> statement-breakpoint
CREATE INDEX "claim_lines_trip_idx" ON "claim_lines" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "claim_lines_category_idx" ON "claim_lines" USING btree ("category");--> statement-breakpoint
CREATE INDEX "claim_lines_verdict_idx" ON "claim_lines" USING btree ("policy_verdict");--> statement-breakpoint
CREATE INDEX "approvals_trip_idx" ON "approvals" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "approvals_approver_idx" ON "approvals" USING btree ("approver_code");--> statement-breakpoint
CREATE INDEX "audit_log_trip_idx" ON "audit_log" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");