import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_projects_sign_in" AS ENUM('email-code', 'invite-code', 'both');
  CREATE TABLE "invite_codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"project" varchar NOT NULL,
  	"code_hash" varchar NOT NULL,
  	"hint" varchar NOT NULL,
  	"label" varchar,
  	"uses" numeric DEFAULT 1 NOT NULL,
  	"expires_at" timestamp(3) with time zone,
  	"revoked_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "invite_uses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"invite_id" integer NOT NULL,
  	"member_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "invite_tries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"ip_hash" varchar,
  	"tried_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "projects" ADD COLUMN "sign_in" "enum_projects_sign_in";
  ALTER TABLE "members" ADD COLUMN "email_verified" boolean DEFAULT false;
  -- Hand-written (design/invite-codes.md): every member before this migration signed in
  -- with a login code, so the email is verified. Old projects keep login codes.
  UPDATE "members" SET "email_verified" = true;
  UPDATE "projects" SET "sign_in" = 'email-code' WHERE "sign_in" IS NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "invite_codes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "invite_uses_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "invite_tries_id" integer;
  ALTER TABLE "invite_uses" ADD CONSTRAINT "invite_uses_invite_id_invite_codes_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invite_codes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invite_uses" ADD CONSTRAINT "invite_uses_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "invite_codes_project_idx" ON "invite_codes" USING btree ("project");
  CREATE UNIQUE INDEX "invite_codes_code_hash_idx" ON "invite_codes" USING btree ("code_hash");
  CREATE INDEX "invite_codes_updated_at_idx" ON "invite_codes" USING btree ("updated_at");
  CREATE INDEX "invite_codes_created_at_idx" ON "invite_codes" USING btree ("created_at");
  CREATE INDEX "invite_uses_invite_idx" ON "invite_uses" USING btree ("invite_id");
  CREATE INDEX "invite_uses_member_idx" ON "invite_uses" USING btree ("member_id");
  CREATE INDEX "invite_uses_updated_at_idx" ON "invite_uses" USING btree ("updated_at");
  CREATE INDEX "invite_uses_created_at_idx" ON "invite_uses" USING btree ("created_at");
  CREATE INDEX "invite_tries_email_idx" ON "invite_tries" USING btree ("email");
  CREATE INDEX "invite_tries_ip_hash_idx" ON "invite_tries" USING btree ("ip_hash");
  CREATE INDEX "invite_tries_tried_at_idx" ON "invite_tries" USING btree ("tried_at");
  CREATE INDEX "invite_tries_updated_at_idx" ON "invite_tries" USING btree ("updated_at");
  CREATE INDEX "invite_tries_created_at_idx" ON "invite_tries" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invite_codes_fk" FOREIGN KEY ("invite_codes_id") REFERENCES "public"."invite_codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invite_uses_fk" FOREIGN KEY ("invite_uses_id") REFERENCES "public"."invite_uses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invite_tries_fk" FOREIGN KEY ("invite_tries_id") REFERENCES "public"."invite_tries"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_invite_codes_id_idx" ON "payload_locked_documents_rels" USING btree ("invite_codes_id");
  CREATE INDEX "payload_locked_documents_rels_invite_uses_id_idx" ON "payload_locked_documents_rels" USING btree ("invite_uses_id");
  CREATE INDEX "payload_locked_documents_rels_invite_tries_id_idx" ON "payload_locked_documents_rels" USING btree ("invite_tries_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Hand-ordered: the generated order dropped the tables with CASCADE first, and then
  // failed on the foreign keys that CASCADE had already dropped.
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_invite_codes_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_invite_uses_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_invite_tries_fk";
  DROP INDEX "payload_locked_documents_rels_invite_codes_id_idx";
  DROP INDEX "payload_locked_documents_rels_invite_uses_id_idx";
  DROP INDEX "payload_locked_documents_rels_invite_tries_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "invite_codes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "invite_uses_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "invite_tries_id";
  DROP TABLE "invite_uses" CASCADE;
  DROP TABLE "invite_codes" CASCADE;
  DROP TABLE "invite_tries" CASCADE;
  ALTER TABLE "projects" DROP COLUMN "sign_in";
  ALTER TABLE "members" DROP COLUMN "email_verified";
  DROP TYPE "public"."enum_projects_sign_in";`)
}
