import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "stories" ADD COLUMN "sent_again" boolean DEFAULT false;
  ALTER TABLE "_stories_v" ADD COLUMN "version_sent_again" boolean DEFAULT false;
  ALTER TABLE "members" ADD COLUMN "test" boolean DEFAULT false;
  CREATE INDEX "members_test_idx" ON "members" USING btree ("test");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "members_test_idx";
  ALTER TABLE "stories" DROP COLUMN "sent_again";
  ALTER TABLE "_stories_v" DROP COLUMN "version_sent_again";
  ALTER TABLE "members" DROP COLUMN "test";`)
}
