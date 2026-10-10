import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// The admin rework (design/rework-notes.md): the widgets of a project (`projects.recordings`),
// the unlisted page of a story (`stories.toldOnUnlisted`), and the rights lines as one
// sentence (design/concept-map.md W5). The schema SQL is generated; the data move of the
// rights lines is by hand. A row with `rights = 'other'` (or none) keeps its own text.

const LINES = [
  ['cc-by-4.0', 'CC BY 4.0', 'Stories on this page are shared under CC BY 4.0.'],
  ['cc-by-nc-4.0', 'CC BY-NC 4.0', 'Stories on this page are shared under CC BY-NC 4.0.'],
  ['all-rights-reserved', 'All rights reserved', 'All rights to the stories on this page are reserved.'],
] as const

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "projects_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"recordings_id" integer
  );
  
  ALTER TABLE "stories" ADD COLUMN "told_on_unlisted" varchar;
  ALTER TABLE "_stories_v" ADD COLUMN "version_told_on_unlisted" varchar;
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_recordings_fk" FOREIGN KEY ("recordings_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "projects_rels_order_idx" ON "projects_rels" USING btree ("order");
  CREATE INDEX "projects_rels_parent_idx" ON "projects_rels" USING btree ("parent_id");
  CREATE INDEX "projects_rels_path_idx" ON "projects_rels" USING btree ("path");
  CREATE INDEX "projects_rels_recordings_id_idx" ON "projects_rels" USING btree ("recordings_id");`)
  for (const [rights, , line] of LINES) {
    await db.execute(sql`update projects set rights_line = ${line} where rights = ${rights}`)
  }
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  for (const [rights, line] of LINES) {
    await db.execute(sql`update projects set rights_line = ${line} where rights = ${rights}`)
  }
  await db.execute(sql`
   DROP TABLE "projects_rels" CASCADE;
  ALTER TABLE "stories" DROP COLUMN "told_on_unlisted";
  ALTER TABLE "_stories_v" DROP COLUMN "version_told_on_unlisted";`)
}
