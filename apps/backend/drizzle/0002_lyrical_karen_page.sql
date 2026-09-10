CREATE SEQUENCE "public"."travel_request_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "estimated_cost" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "advance_requested" numeric(14, 2);