import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_stories_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__stories_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_members_status" AS ENUM('active', 'blocked');
  CREATE TYPE "public"."enum_media_kind" AS ENUM('sound', 'image', 'video');
  CREATE TYPE "public"."enum_media_state" AS ENUM('uploaded', 'ready', 'failed');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "projects_site_origins" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"origin" varchar NOT NULL
  );
  
  CREATE TABLE "projects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"rights_line" varchar,
  	"rights_iri" varchar,
  	"language" varchar,
  	"theme_tokens_color_surface" varchar,
  	"theme_tokens_color_text" varchar,
  	"theme_tokens_color_muted" varchar,
  	"theme_tokens_color_accent" varchar,
  	"theme_tokens_color_on_accent" varchar,
  	"theme_tokens_color_border" varchar,
  	"theme_tokens_color_wave" varchar,
  	"theme_tokens_color_region" varchar,
  	"theme_tokens_color_focus" varchar,
  	"theme_tokens_font_family" varchar,
  	"theme_tokens_font_size" varchar,
  	"theme_tokens_radius" varchar,
  	"theme_tokens_space" varchar,
  	"theme_tokens_timeline_height" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "recordings_urls" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "recordings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"duration" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "concepts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"project_id" integer NOT NULL,
  	"iri" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"language" varchar,
  	"parent_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "stories" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"project" varchar,
  	"recording" varchar,
  	"member" varchar,
  	"start" numeric,
  	"end" numeric,
  	"wadm" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_stories_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_stories_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" varchar,
  	"version_project" varchar,
  	"version_recording" varchar,
  	"version_member" varchar,
  	"version_start" numeric,
  	"version_end" numeric,
  	"version_wadm" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__stories_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean
  );
  
  CREATE TABLE "story_representations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"instance" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"etag" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "members" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"nickname" varchar NOT NULL,
  	"status" "enum_members_status" DEFAULT 'active' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "member_sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"token_hash" varchar NOT NULL,
  	"member_id" integer NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "login_codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"code_hash" varchar NOT NULL,
  	"ip_hash" varchar,
  	"requested_at" timestamp(3) with time zone NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"attempts" numeric DEFAULT 0 NOT NULL,
  	"used_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"member" varchar NOT NULL,
  	"kind" "enum_media_kind" NOT NULL,
  	"state" "enum_media_state" DEFAULT 'uploaded' NOT NULL,
  	"size" numeric NOT NULL,
  	"raw" varchar NOT NULL,
  	"derived" varchar,
  	"format" varchar NOT NULL,
  	"duration_sec" numeric,
  	"width" numeric,
  	"height" numeric,
  	"error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
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
  	"projects_id" integer,
  	"recordings_id" integer,
  	"concepts_id" integer,
  	"stories_id" varchar,
  	"story_representations_id" integer,
  	"members_id" integer,
  	"member_sessions_id" integer,
  	"login_codes_id" integer,
  	"media_id" varchar
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
  ALTER TABLE "projects_site_origins" ADD CONSTRAINT "projects_site_origins_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "recordings_urls" ADD CONSTRAINT "recordings_urls_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "concepts" ADD CONSTRAINT "concepts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "concepts" ADD CONSTRAINT "concepts_parent_id_concepts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."concepts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_stories_v" ADD CONSTRAINT "_stories_v_parent_id_stories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "member_sessions" ADD CONSTRAINT "member_sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_recordings_fk" FOREIGN KEY ("recordings_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_concepts_fk" FOREIGN KEY ("concepts_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stories_fk" FOREIGN KEY ("stories_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_story_representations_fk" FOREIGN KEY ("story_representations_id") REFERENCES "public"."story_representations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_members_fk" FOREIGN KEY ("members_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_member_sessions_fk" FOREIGN KEY ("member_sessions_id") REFERENCES "public"."member_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_login_codes_fk" FOREIGN KEY ("login_codes_id") REFERENCES "public"."login_codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "projects_site_origins_order_idx" ON "projects_site_origins" USING btree ("_order");
  CREATE INDEX "projects_site_origins_parent_id_idx" ON "projects_site_origins" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "projects_slug_idx" ON "projects" USING btree ("slug");
  CREATE INDEX "projects_updated_at_idx" ON "projects" USING btree ("updated_at");
  CREATE INDEX "projects_created_at_idx" ON "projects" USING btree ("created_at");
  CREATE INDEX "recordings_urls_order_idx" ON "recordings_urls" USING btree ("_order");
  CREATE INDEX "recordings_urls_parent_id_idx" ON "recordings_urls" USING btree ("_parent_id");
  CREATE INDEX "recordings_updated_at_idx" ON "recordings" USING btree ("updated_at");
  CREATE INDEX "recordings_created_at_idx" ON "recordings" USING btree ("created_at");
  CREATE INDEX "concepts_project_idx" ON "concepts" USING btree ("project_id");
  CREATE UNIQUE INDEX "concepts_iri_idx" ON "concepts" USING btree ("iri");
  CREATE INDEX "concepts_parent_idx" ON "concepts" USING btree ("parent_id");
  CREATE INDEX "concepts_updated_at_idx" ON "concepts" USING btree ("updated_at");
  CREATE INDEX "concepts_created_at_idx" ON "concepts" USING btree ("created_at");
  CREATE INDEX "stories_project_idx" ON "stories" USING btree ("project");
  CREATE INDEX "stories_recording_idx" ON "stories" USING btree ("recording");
  CREATE INDEX "stories_member_idx" ON "stories" USING btree ("member");
  CREATE INDEX "stories_updated_at_idx" ON "stories" USING btree ("updated_at");
  CREATE INDEX "stories_created_at_idx" ON "stories" USING btree ("created_at");
  CREATE INDEX "stories__status_idx" ON "stories" USING btree ("_status");
  CREATE INDEX "project_recording_idx" ON "stories" USING btree ("project","recording");
  CREATE INDEX "_stories_v_parent_idx" ON "_stories_v" USING btree ("parent_id");
  CREATE INDEX "_stories_v_version_version_project_idx" ON "_stories_v" USING btree ("version_project");
  CREATE INDEX "_stories_v_version_version_recording_idx" ON "_stories_v" USING btree ("version_recording");
  CREATE INDEX "_stories_v_version_version_member_idx" ON "_stories_v" USING btree ("version_member");
  CREATE INDEX "_stories_v_version_version_updated_at_idx" ON "_stories_v" USING btree ("version_updated_at");
  CREATE INDEX "_stories_v_version_version_created_at_idx" ON "_stories_v" USING btree ("version_created_at");
  CREATE INDEX "_stories_v_version_version__status_idx" ON "_stories_v" USING btree ("version__status");
  CREATE INDEX "_stories_v_created_at_idx" ON "_stories_v" USING btree ("created_at");
  CREATE INDEX "_stories_v_updated_at_idx" ON "_stories_v" USING btree ("updated_at");
  CREATE INDEX "_stories_v_latest_idx" ON "_stories_v" USING btree ("latest");
  CREATE INDEX "version_project_version_recording_idx" ON "_stories_v" USING btree ("version_project","version_recording");
  CREATE UNIQUE INDEX "story_representations_key_idx" ON "story_representations" USING btree ("key");
  CREATE INDEX "story_representations_instance_idx" ON "story_representations" USING btree ("instance");
  CREATE INDEX "story_representations_updated_at_idx" ON "story_representations" USING btree ("updated_at");
  CREATE INDEX "story_representations_created_at_idx" ON "story_representations" USING btree ("created_at");
  CREATE UNIQUE INDEX "members_email_idx" ON "members" USING btree ("email");
  CREATE INDEX "members_updated_at_idx" ON "members" USING btree ("updated_at");
  CREATE INDEX "members_created_at_idx" ON "members" USING btree ("created_at");
  CREATE UNIQUE INDEX "member_sessions_token_hash_idx" ON "member_sessions" USING btree ("token_hash");
  CREATE INDEX "member_sessions_member_idx" ON "member_sessions" USING btree ("member_id");
  CREATE INDEX "member_sessions_updated_at_idx" ON "member_sessions" USING btree ("updated_at");
  CREATE INDEX "member_sessions_created_at_idx" ON "member_sessions" USING btree ("created_at");
  CREATE INDEX "login_codes_email_idx" ON "login_codes" USING btree ("email");
  CREATE INDEX "login_codes_ip_hash_idx" ON "login_codes" USING btree ("ip_hash");
  CREATE INDEX "login_codes_requested_at_idx" ON "login_codes" USING btree ("requested_at");
  CREATE INDEX "login_codes_updated_at_idx" ON "login_codes" USING btree ("updated_at");
  CREATE INDEX "login_codes_created_at_idx" ON "login_codes" USING btree ("created_at");
  CREATE INDEX "media_member_idx" ON "media" USING btree ("member");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_projects_id_idx" ON "payload_locked_documents_rels" USING btree ("projects_id");
  CREATE INDEX "payload_locked_documents_rels_recordings_id_idx" ON "payload_locked_documents_rels" USING btree ("recordings_id");
  CREATE INDEX "payload_locked_documents_rels_concepts_id_idx" ON "payload_locked_documents_rels" USING btree ("concepts_id");
  CREATE INDEX "payload_locked_documents_rels_stories_id_idx" ON "payload_locked_documents_rels" USING btree ("stories_id");
  CREATE INDEX "payload_locked_documents_rels_story_representations_id_idx" ON "payload_locked_documents_rels" USING btree ("story_representations_id");
  CREATE INDEX "payload_locked_documents_rels_members_id_idx" ON "payload_locked_documents_rels" USING btree ("members_id");
  CREATE INDEX "payload_locked_documents_rels_member_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("member_sessions_id");
  CREATE INDEX "payload_locked_documents_rels_login_codes_id_idx" ON "payload_locked_documents_rels" USING btree ("login_codes_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
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
  DROP TABLE "projects_site_origins" CASCADE;
  DROP TABLE "projects" CASCADE;
  DROP TABLE "recordings_urls" CASCADE;
  DROP TABLE "recordings" CASCADE;
  DROP TABLE "concepts" CASCADE;
  DROP TABLE "stories" CASCADE;
  DROP TABLE "_stories_v" CASCADE;
  DROP TABLE "story_representations" CASCADE;
  DROP TABLE "members" CASCADE;
  DROP TABLE "member_sessions" CASCADE;
  DROP TABLE "login_codes" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_stories_status";
  DROP TYPE "public"."enum__stories_v_version_status";
  DROP TYPE "public"."enum_members_status";
  DROP TYPE "public"."enum_media_kind";
  DROP TYPE "public"."enum_media_state";`)
}
