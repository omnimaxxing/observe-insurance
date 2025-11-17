import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "knowledge_articles" DROP COLUMN "vector_state_chunk_ids";
  ALTER TABLE "knowledge_articles" DROP COLUMN "vector_state_last_synced_at";
  ALTER TABLE "knowledge_articles" DROP COLUMN "vector_state_sync_error";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "knowledge_articles" ADD COLUMN "vector_state_chunk_ids" jsonb;
  ALTER TABLE "knowledge_articles" ADD COLUMN "vector_state_last_synced_at" timestamp(3) with time zone;
  ALTER TABLE "knowledge_articles" ADD COLUMN "vector_state_sync_error" varchar;`)
}
