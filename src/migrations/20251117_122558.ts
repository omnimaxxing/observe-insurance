import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'ai-agent', 'human-agent');
  CREATE TYPE "public"."enum_claims_case_notes_source" AS ENUM('agent', 'system', 'customer');
  CREATE TYPE "public"."enum_claims_status" AS ENUM('pending', 'documentation', 'review', 'approved', 'denied', 'completed', 'cancelled');
  CREATE TYPE "public"."enum_claims_coverage_type" AS ENUM('property', 'liability', 'flood', 'fire', 'other');
  CREATE TYPE "public"."enum_conversations_transcript_speaker" AS ENUM('user', 'agent');
  CREATE TYPE "public"."enum_conversations_status" AS ENUM('in_progress', 'completed', 'failed', 'disconnected');
  CREATE TYPE "public"."enum_conversations_metadata_verification_method" AS ENUM('phone', 'email', 'name_dob', 'none');
  CREATE TYPE "public"."enum_conversations_metadata_intent" AS ENUM('claim_status', 'file_claim', 'upload_documents', 'general_inquiry', 'other');
  CREATE TYPE "public"."enum_conversations_metadata_sentiment" AS ENUM('positive', 'neutral', 'negative');
  CREATE TYPE "public"."enum_knowledge_articles_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE "public"."enum_knowledge_articles_content_source" AS ENUM('richText', 'plainText', 'document');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar,
  	"role" "enum_users_role" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"full_name" varchar,
  	"first_name" varchar NOT NULL,
  	"last_name" varchar NOT NULL,
  	"dob" timestamp(3) with time zone,
  	"email" varchar NOT NULL,
  	"phone" varchar,
  	"address_line1" varchar NOT NULL,
  	"address_line2" varchar,
  	"address_city" varchar NOT NULL,
  	"address_state" varchar NOT NULL,
  	"address_postal_code" varchar NOT NULL,
  	"policy_number" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "claims_attachments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"file_id" integer NOT NULL,
  	"description" varchar
  );
  
  CREATE TABLE "claims_case_notes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"source" "enum_claims_case_notes_source" DEFAULT 'agent' NOT NULL,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "claims" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"claim_number" varchar NOT NULL,
  	"customer_id" integer NOT NULL,
  	"status" "enum_claims_status" DEFAULT 'pending' NOT NULL,
  	"incident_date" timestamp(3) with time zone,
  	"amount" numeric,
  	"coverage_type" "enum_claims_coverage_type",
  	"loss_location_address_line1" varchar,
  	"loss_location_address_line2" varchar,
  	"loss_location_city" varchar,
  	"loss_location_state" varchar,
  	"loss_location_postal_code" varchar,
  	"description" varchar,
  	"additional_details" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "conversations_transcript" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"timestamp" timestamp(3) with time zone,
  	"speaker" "enum_conversations_transcript_speaker" NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "conversations_tools_called" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tool_name" varchar NOT NULL,
  	"timestamp" timestamp(3) with time zone,
  	"parameters" jsonb,
  	"result" jsonb
  );
  
  CREATE TABLE "conversations_metadata_claims_discussed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"claim_number" varchar
  );
  
  CREATE TABLE "conversations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"conversation_id" varchar NOT NULL,
  	"agent_id" varchar NOT NULL,
  	"customer_id" integer,
  	"customer_name" varchar,
  	"customer_phone" varchar,
  	"call_uuid" varchar,
  	"conversation_uuid" varchar,
  	"status" "enum_conversations_status" DEFAULT 'in_progress' NOT NULL,
  	"duration" numeric,
  	"start_time" timestamp(3) with time zone,
  	"end_time" timestamp(3) with time zone,
  	"summary" varchar,
  	"metadata_authenticated" boolean DEFAULT false,
  	"metadata_verification_method" "enum_conversations_metadata_verification_method",
  	"metadata_intent" "enum_conversations_metadata_intent",
  	"metadata_sentiment" "enum_conversations_metadata_sentiment",
  	"analytics_total_messages" numeric,
  	"analytics_user_messages" numeric,
  	"analytics_agent_messages" numeric,
  	"analytics_average_response_time" numeric,
  	"analytics_interruption_count" numeric,
  	"raw_data" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "knowledge_articles_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar
  );
  
  CREATE TABLE "knowledge_articles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" "enum_knowledge_articles_status" DEFAULT 'draft',
  	"summary" varchar,
  	"content_source" "enum_knowledge_articles_content_source" DEFAULT 'richText',
  	"content" jsonb,
  	"source_document_id" integer,
  	"plain_text_override" varchar,
  	"vector_state_chunk_ids" jsonb,
  	"vector_state_last_synced_at" timestamp(3) with time zone,
  	"vector_state_sync_error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "search" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"priority" numeric,
  	"excerpt" varchar,
  	"content" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "search_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"knowledge_articles_id" integer
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"customers_id" integer,
  	"claims_id" integer,
  	"conversations_id" integer,
  	"knowledge_articles_id" integer,
  	"media_id" integer,
  	"search_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "claims_attachments" ADD CONSTRAINT "claims_attachments_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "claims_attachments" ADD CONSTRAINT "claims_attachments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "claims_case_notes" ADD CONSTRAINT "claims_case_notes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "claims" ADD CONSTRAINT "claims_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "conversations_transcript" ADD CONSTRAINT "conversations_transcript_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "conversations_tools_called" ADD CONSTRAINT "conversations_tools_called_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "conversations_metadata_claims_discussed" ADD CONSTRAINT "conversations_metadata_claims_discussed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "knowledge_articles_tags" ADD CONSTRAINT "knowledge_articles_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."knowledge_articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_source_document_id_media_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "search_rels" ADD CONSTRAINT "search_rels_knowledge_articles_fk" FOREIGN KEY ("knowledge_articles_id") REFERENCES "public"."knowledge_articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_claims_fk" FOREIGN KEY ("claims_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_conversations_fk" FOREIGN KEY ("conversations_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_knowledge_articles_fk" FOREIGN KEY ("knowledge_articles_id") REFERENCES "public"."knowledge_articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_search_fk" FOREIGN KEY ("search_id") REFERENCES "public"."search"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "customers_email_idx" ON "customers" USING btree ("email");
  CREATE UNIQUE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");
  CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
  CREATE INDEX "claims_attachments_order_idx" ON "claims_attachments" USING btree ("_order");
  CREATE INDEX "claims_attachments_parent_id_idx" ON "claims_attachments" USING btree ("_parent_id");
  CREATE INDEX "claims_attachments_file_idx" ON "claims_attachments" USING btree ("file_id");
  CREATE INDEX "claims_case_notes_order_idx" ON "claims_case_notes" USING btree ("_order");
  CREATE INDEX "claims_case_notes_parent_id_idx" ON "claims_case_notes" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "claims_claim_number_idx" ON "claims" USING btree ("claim_number");
  CREATE INDEX "claims_customer_idx" ON "claims" USING btree ("customer_id");
  CREATE INDEX "claims_updated_at_idx" ON "claims" USING btree ("updated_at");
  CREATE INDEX "claims_created_at_idx" ON "claims" USING btree ("created_at");
  CREATE INDEX "conversations_transcript_order_idx" ON "conversations_transcript" USING btree ("_order");
  CREATE INDEX "conversations_transcript_parent_id_idx" ON "conversations_transcript" USING btree ("_parent_id");
  CREATE INDEX "conversations_tools_called_order_idx" ON "conversations_tools_called" USING btree ("_order");
  CREATE INDEX "conversations_tools_called_parent_id_idx" ON "conversations_tools_called" USING btree ("_parent_id");
  CREATE INDEX "conversations_metadata_claims_discussed_order_idx" ON "conversations_metadata_claims_discussed" USING btree ("_order");
  CREATE INDEX "conversations_metadata_claims_discussed_parent_id_idx" ON "conversations_metadata_claims_discussed" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "conversations_conversation_id_idx" ON "conversations" USING btree ("conversation_id");
  CREATE INDEX "conversations_customer_idx" ON "conversations" USING btree ("customer_id");
  CREATE INDEX "conversations_updated_at_idx" ON "conversations" USING btree ("updated_at");
  CREATE INDEX "conversations_created_at_idx" ON "conversations" USING btree ("created_at");
  CREATE INDEX "knowledge_articles_tags_order_idx" ON "knowledge_articles_tags" USING btree ("_order");
  CREATE INDEX "knowledge_articles_tags_parent_id_idx" ON "knowledge_articles_tags" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "knowledge_articles_slug_idx" ON "knowledge_articles" USING btree ("slug");
  CREATE INDEX "knowledge_articles_source_document_idx" ON "knowledge_articles" USING btree ("source_document_id");
  CREATE INDEX "knowledge_articles_updated_at_idx" ON "knowledge_articles" USING btree ("updated_at");
  CREATE INDEX "knowledge_articles_created_at_idx" ON "knowledge_articles" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "search_updated_at_idx" ON "search" USING btree ("updated_at");
  CREATE INDEX "search_created_at_idx" ON "search" USING btree ("created_at");
  CREATE INDEX "search_rels_order_idx" ON "search_rels" USING btree ("order");
  CREATE INDEX "search_rels_parent_idx" ON "search_rels" USING btree ("parent_id");
  CREATE INDEX "search_rels_path_idx" ON "search_rels" USING btree ("path");
  CREATE INDEX "search_rels_knowledge_articles_id_idx" ON "search_rels" USING btree ("knowledge_articles_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("customers_id");
  CREATE INDEX "payload_locked_documents_rels_claims_id_idx" ON "payload_locked_documents_rels" USING btree ("claims_id");
  CREATE INDEX "payload_locked_documents_rels_conversations_id_idx" ON "payload_locked_documents_rels" USING btree ("conversations_id");
  CREATE INDEX "payload_locked_documents_rels_knowledge_articles_id_idx" ON "payload_locked_documents_rels" USING btree ("knowledge_articles_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_search_id_idx" ON "payload_locked_documents_rels" USING btree ("search_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "customers" CASCADE;
  DROP TABLE "claims_attachments" CASCADE;
  DROP TABLE "claims_case_notes" CASCADE;
  DROP TABLE "claims" CASCADE;
  DROP TABLE "conversations_transcript" CASCADE;
  DROP TABLE "conversations_tools_called" CASCADE;
  DROP TABLE "conversations_metadata_claims_discussed" CASCADE;
  DROP TABLE "conversations" CASCADE;
  DROP TABLE "knowledge_articles_tags" CASCADE;
  DROP TABLE "knowledge_articles" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "search" CASCADE;
  DROP TABLE "search_rels" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_claims_case_notes_source";
  DROP TYPE "public"."enum_claims_status";
  DROP TYPE "public"."enum_claims_coverage_type";
  DROP TYPE "public"."enum_conversations_transcript_speaker";
  DROP TYPE "public"."enum_conversations_status";
  DROP TYPE "public"."enum_conversations_metadata_verification_method";
  DROP TYPE "public"."enum_conversations_metadata_intent";
  DROP TYPE "public"."enum_conversations_metadata_sentiment";
  DROP TYPE "public"."enum_knowledge_articles_status";
  DROP TYPE "public"."enum_knowledge_articles_content_source";`)
}
