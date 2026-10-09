import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_stories_last_action" AS ENUM('saved', 'published', 'returned', 'returned-automatically');
  CREATE TYPE "public"."enum__stories_v_version_last_action" AS ENUM('saved', 'published', 'returned', 'returned-automatically');
  CREATE TYPE "public"."enum_users_review_mail" AS ENUM('daily', 'each', 'never');
  ALTER TABLE "stories" ADD COLUMN "rejection_automatic" boolean DEFAULT false;
  ALTER TABLE "stories" ADD COLUMN "told_on" varchar;
  ALTER TABLE "stories" ADD COLUMN "last_action" "enum_stories_last_action";
  ALTER TABLE "stories" ADD COLUMN "changed_by" varchar;
  ALTER TABLE "stories" ADD COLUMN "processing" boolean DEFAULT false;
  ALTER TABLE "_stories_v" ADD COLUMN "version_rejection_automatic" boolean DEFAULT false;
  ALTER TABLE "_stories_v" ADD COLUMN "version_told_on" varchar;
  ALTER TABLE "_stories_v" ADD COLUMN "version_last_action" "enum__stories_v_version_last_action";
  ALTER TABLE "_stories_v" ADD COLUMN "version_changed_by" varchar;
  ALTER TABLE "_stories_v" ADD COLUMN "version_processing" boolean DEFAULT false;
  ALTER TABLE "members" ADD COLUMN "mail_notices" boolean DEFAULT true;
  ALTER TABLE "users" ADD COLUMN "name" varchar;
  ALTER TABLE "users" ADD COLUMN "review_mail" "enum_users_review_mail" DEFAULT 'daily';
  ALTER TABLE "users" ADD COLUMN "snippet_pasted" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "checklist_hidden" boolean DEFAULT false;
  CREATE INDEX "stories_processing_idx" ON "stories" USING btree ("processing");
  CREATE INDEX "_stories_v_version_version_processing_idx" ON "_stories_v" USING btree ("version_processing");`)
  // Data move (hand-written): a story whose newest version has a media body that the
  // worker has not settled is Processing. A body URL ends in /media/<media id>.
  await db.execute(sql`
  UPDATE "_stories_v" v SET "version_processing" = true
    WHERE v."latest" AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(v."version_wadm" -> 'body') b, "media" m
      WHERE m."state" = 'uploaded' AND b ->> 'id' LIKE '%/media/' || m."id");
  UPDATE "stories" s SET "processing" = true
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(s."wadm" -> 'body') b, "media" m
      WHERE m."state" = 'uploaded' AND b ->> 'id' LIKE '%/media/' || m."id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "stories_processing_idx";
  DROP INDEX "_stories_v_version_version_processing_idx";
  ALTER TABLE "stories" DROP COLUMN "rejection_automatic";
  ALTER TABLE "stories" DROP COLUMN "told_on";
  ALTER TABLE "stories" DROP COLUMN "last_action";
  ALTER TABLE "stories" DROP COLUMN "changed_by";
  ALTER TABLE "stories" DROP COLUMN "processing";
  ALTER TABLE "_stories_v" DROP COLUMN "version_rejection_automatic";
  ALTER TABLE "_stories_v" DROP COLUMN "version_told_on";
  ALTER TABLE "_stories_v" DROP COLUMN "version_last_action";
  ALTER TABLE "_stories_v" DROP COLUMN "version_changed_by";
  ALTER TABLE "_stories_v" DROP COLUMN "version_processing";
  ALTER TABLE "members" DROP COLUMN "mail_notices";
  ALTER TABLE "users" DROP COLUMN "name";
  ALTER TABLE "users" DROP COLUMN "review_mail";
  ALTER TABLE "users" DROP COLUMN "snippet_pasted";
  ALTER TABLE "users" DROP COLUMN "checklist_hidden";
  DROP TYPE "public"."enum_stories_last_action";
  DROP TYPE "public"."enum__stories_v_version_last_action";
  DROP TYPE "public"."enum_users_review_mail";`)
}
