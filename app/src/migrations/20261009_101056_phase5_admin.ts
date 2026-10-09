import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Phase 5. Data moves by hand (added after `migrate:create`):
// - `recordings.urls` (array) becomes `url` (the first address) and `otherUrls` (the rest).
// - `stories.nickname` and `stories.excerpt` come from the stored WADM record, as the
//   `deriveColumns` hook of `stories` makes them (first text body, 80 characters).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_projects_review_rule" AS ENUM('review', 'publish-at-once');
  CREATE TYPE "public"."enum_projects_rights" AS ENUM('cc-by-4.0', 'cc-by-nc-4.0', 'all-rights-reserved', 'other');
  CREATE TABLE "recordings_other_urls" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar NOT NULL
  );

  ALTER TABLE "recordings" ADD COLUMN "url" varchar;
  UPDATE "recordings" r SET "url" = coalesce(
    (SELECT u."url" FROM "recordings_urls" u WHERE u."_parent_id" = r."id" ORDER BY u."_order" LIMIT 1), '');
  INSERT INTO "recordings_other_urls" ("_order", "_parent_id", "id", "url")
    SELECT u."_order", u."_parent_id", u."id", u."url" FROM "recordings_urls" u
    WHERE u."_order" > (SELECT min(f."_order") FROM "recordings_urls" f WHERE f."_parent_id" = u."_parent_id");
  ALTER TABLE "recordings" ALTER COLUMN "url" SET NOT NULL;
  DROP TABLE "recordings_urls" CASCADE;

  ALTER TABLE "projects" ADD COLUMN "review_rule" "enum_projects_review_rule" DEFAULT 'review';
  ALTER TABLE "projects" ADD COLUMN "rights" "enum_projects_rights";
  ALTER TABLE "concepts" ADD COLUMN "hidden" boolean DEFAULT false;
  ALTER TABLE "stories" ADD COLUMN "nickname" varchar;
  ALTER TABLE "stories" ADD COLUMN "excerpt" varchar;
  ALTER TABLE "stories" ADD COLUMN "rejection_reason" varchar;
  ALTER TABLE "stories" ADD COLUMN "rejection_operator" varchar;
  ALTER TABLE "stories" ADD COLUMN "rejection_at" timestamp(3) with time zone;
  ALTER TABLE "_stories_v" ADD COLUMN "version_nickname" varchar;
  ALTER TABLE "_stories_v" ADD COLUMN "version_excerpt" varchar;
  ALTER TABLE "_stories_v" ADD COLUMN "version_rejection_reason" varchar;
  ALTER TABLE "_stories_v" ADD COLUMN "version_rejection_operator" varchar;
  ALTER TABLE "_stories_v" ADD COLUMN "version_rejection_at" timestamp(3) with time zone;
  ALTER TABLE "recordings_other_urls" ADD CONSTRAINT "recordings_other_urls_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "recordings_other_urls_order_idx" ON "recordings_other_urls" USING btree ("_order");
  CREATE INDEX "recordings_other_urls_parent_id_idx" ON "recordings_other_urls" USING btree ("_parent_id");

  CREATE FUNCTION pg_temp.annoudio_excerpt(wadm jsonb) RETURNS varchar LANGUAGE sql AS $$
    SELECT CASE WHEN char_length(t) > 80 THEN left(t, 79) || '…' ELSE t END
    FROM (SELECT btrim(regexp_replace(coalesce((
      SELECT b ->> 'value' FROM jsonb_array_elements(wadm -> 'body') WITH ORDINALITY AS e(b, n)
      WHERE b ->> 'type' = 'TextualBody' AND NOT b ? 'purpose' ORDER BY n LIMIT 1), ''),
      '\\s+', ' ', 'g')) AS t) AS text
  $$;
  UPDATE "stories" SET "nickname" = "wadm" -> 'creator' ->> 'nickname',
    "excerpt" = pg_temp.annoudio_excerpt("wadm");
  UPDATE "_stories_v" SET "version_nickname" = "version_wadm" -> 'creator' ->> 'nickname',
    "version_excerpt" = pg_temp.annoudio_excerpt("version_wadm");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "recordings_urls" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar NOT NULL
  );
  INSERT INTO "recordings_urls" ("_order", "_parent_id", "id", "url")
    SELECT 1, r."id", gen_random_uuid()::varchar, r."url" FROM "recordings" r;
  INSERT INTO "recordings_urls" ("_order", "_parent_id", "id", "url")
    SELECT o."_order" + 1, o."_parent_id", o."id", o."url" FROM "recordings_other_urls" o;

  DROP TABLE "recordings_other_urls" CASCADE;
  ALTER TABLE "recordings_urls" ADD CONSTRAINT "recordings_urls_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "recordings_urls_order_idx" ON "recordings_urls" USING btree ("_order");
  CREATE INDEX "recordings_urls_parent_id_idx" ON "recordings_urls" USING btree ("_parent_id");
  ALTER TABLE "stories" DROP COLUMN "nickname";
  ALTER TABLE "stories" DROP COLUMN "excerpt";
  ALTER TABLE "stories" DROP COLUMN "rejection_reason";
  ALTER TABLE "stories" DROP COLUMN "rejection_operator";
  ALTER TABLE "stories" DROP COLUMN "rejection_at";
  ALTER TABLE "_stories_v" DROP COLUMN "version_nickname";
  ALTER TABLE "_stories_v" DROP COLUMN "version_excerpt";
  ALTER TABLE "_stories_v" DROP COLUMN "version_rejection_reason";
  ALTER TABLE "_stories_v" DROP COLUMN "version_rejection_operator";
  ALTER TABLE "_stories_v" DROP COLUMN "version_rejection_at";
  ALTER TABLE "recordings" DROP COLUMN "url";
  ALTER TABLE "projects" DROP COLUMN "review_rule";
  ALTER TABLE "projects" DROP COLUMN "rights";
  ALTER TABLE "concepts" DROP COLUMN "hidden";
  DROP TYPE "public"."enum_projects_review_rule";
  DROP TYPE "public"."enum_projects_rights";`)
}
