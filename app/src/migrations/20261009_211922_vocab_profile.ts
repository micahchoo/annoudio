import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

import { etagOf } from '../modules/stories/etag'
import { seedOntologies } from '../modules/vocabulary/ontologies'

// The project vocabulary (design/vocab.md §4). The schema below comes from
// `migrate:create`; the data moves are by hand (`valuesUp`, `valuesDown`):
// 1. Seed the bundled ontologies.
// 2. Per project with concepts: the list Topics (IRI = the old scheme IRI
//    `{origin}/vocab/{project}`), `list` on each concept, and the field Topics
//    (`dcterms:subject`, max 10, shown as tags, position 1). Concept IRIs do not change.
// 3. Every story, main and versions tables: each tag pair (`SpecificResource` + label
//    `TextualBody`, both `tagging`) becomes one value body about the segment.
//    `modified` does not change.
// 4. `story_values` from the rewritten stories.
// 5. The served representations: the same rewrite of their bodies, a new ETag each.
// Down refuses when a value body other than a Topics item exists.

const SUBJECT = 'http://purl.org/dc/terms/subject'

type Db = MigrateUpArgs['db']
type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The segment IRI of a story: the recording plus its fragment. Null for a reply. */
function segmentOf(annotation: Json): string | null {
  const target = annotation.target
  if (!isObject(target) || !isObject(target.selector)) return null
  return `${target.source}#${target.selector.value}`
}

/** Tag pairs → value bodies, in the key order of `stories/shape.ts`. Null: no change. */
export function pairsToValues(annotation: Json): Json | null {
  const body = annotation.body
  const segment = segmentOf(annotation)
  if (!Array.isArray(body) || !segment) return null
  if (!body.some((b) => isObject(b) && b.type === 'SpecificResource')) return null
  const out: unknown[] = []
  for (let i = 0; i < body.length; i++) {
    const b = body[i]
    if (isObject(b) && b.type === 'SpecificResource' && b.purpose === 'tagging') {
      const label = body[i + 1] as Json
      out.push({
        type: ['TextualBody', 'rdf:Statement'],
        purpose: 'tagging',
        value: label.value,
        ...(typeof label.language === 'string' ? { language: label.language } : {}),
        'rdf:subject': { id: segment },
        'rdf:predicate': { id: SUBJECT },
        'rdf:object': { id: b.source },
      })
      i++
    } else out.push(b)
  }
  return { ...annotation, body: out }
}

/** Value bodies of Topics → tag pairs, in the key order of the old `shape.ts`. */
export function valuesToPairs(annotation: Json): Json | null {
  const body = annotation.body
  if (!Array.isArray(body) || !body.some((b) => isObject(b) && Array.isArray(b.type))) return null
  return {
    ...annotation,
    body: body.flatMap((b) =>
      isObject(b) && Array.isArray(b.type)
        ? [
            {
              type: 'SpecificResource',
              source: (b['rdf:object'] as Json).id,
              purpose: 'tagging',
            },
            {
              type: 'TextualBody',
              value: b.value,
              purpose: 'tagging',
              ...(typeof b.language === 'string' ? { language: b.language } : {}),
            },
          ]
        : [b],
    ),
  }
}

/** Apply `change` to every annotation in a JSON tree (a page, a container, a story). */
function walk(value: unknown, change: (a: Json) => Json | null): unknown {
  if (Array.isArray(value)) return value.map((v) => walk(v, change))
  if (!isObject(value)) return value
  const out: Json = {}
  for (const [key, v] of Object.entries(value)) out[key] = walk(v, change)
  return out.type === 'Annotation' ? (change(out) ?? out) : out
}

async function rewriteStories(db: Db, change: (a: Json) => Json | null) {
  for (const [table, column] of [
    ['stories', 'wadm'],
    ['_stories_v', 'version_wadm'],
  ] as const) {
    const { rows } = await db.execute<{ id: string | number; wadm: Json }>(
      sql`select id, ${sql.raw(column)} as wadm from ${sql.raw(table)}`,
    )
    for (const row of rows) {
      const next = row.wadm ? change(row.wadm) : null
      if (!next) continue
      await db.execute(
        sql`update ${sql.raw(table)} set ${sql.raw(column)} = ${JSON.stringify(next)}::jsonb where id = ${row.id}`,
      )
    }
  }
}

/** The served bytes again, with the same JSON writer as `stories/paginate.ts`. */
async function rewriteRepresentations(db: Db, change: (a: Json) => Json | null) {
  const { rows } = await db.execute<{ id: number; body: string }>(
    sql`select id, body from story_representations`,
  )
  for (const row of rows) {
    const body = JSON.stringify(walk(JSON.parse(row.body), change))
    if (body === row.body) continue
    await db.execute(
      sql`update story_representations set body = ${body}, etag = ${etagOf(body)} where id = ${row.id}`,
    )
  }
}

export async function valuesUp(db: Db): Promise<void> {
  await seedOntologies(db)
  await db.execute(sql`
    insert into vocab_lists (project_id, key, iri, label, kind, hidden, updated_at, created_at)
      select distinct on (c.project_id) c.project_id, 'topics',
             regexp_replace(c.iri, '/c/[^/]+$', ''), 'Topics', 'items', false, now(), now()
        from concepts c
        where not exists (select 1 from vocab_lists l where l.project_id = c.project_id and l.key = 'topics')
        order by c.project_id, c.id`)
  await db.execute(sql`
    update concepts c set list_id = l.id from vocab_lists l
      where l.project_id = c.project_id and l.key = 'topics' and c.list_id is null`)
  await db.execute(sql`
    insert into vocab_fields (project_id, property_id, label, help, value_type, list_id, required,
                              max, show_as, allow_own, hidden, position, updated_at, created_at)
      select l.project_id, t.id, 'Topics', 'What is this part about?', 'list', l.id, false,
             10, 'tags', false, false, 1, now(), now()
        from vocab_lists l join ontology_terms t on t.iri = ${SUBJECT}
        where l.key = 'topics'
          and not exists (select 1 from vocab_fields f where f.project_id = l.project_id and f.property_id = t.id)`)
  await rewriteStories(db, pairsToValues)
  await db.execute(sql`delete from story_values`)
  for (const [layer, from] of [
    [
      'newest',
      sql`select v.parent_id as story, v.version_project as project, v.version_wadm as wadm from _stories_v v where v.latest`,
    ],
    [
      'published',
      sql`select s.id as story, s.project, s.wadm from stories s where s._status = 'published'`,
    ],
  ] as const) {
    await db.execute(sql`
      insert into story_values (story_id, project, layer, property, object_iri, literal, datatype, language, own, updated_at, created_at)
        select r.story, r.project, ${layer}::enum_story_values_layer, b -> 'rdf:predicate' ->> 'id',
               b -> 'rdf:object' ->> 'id', null, null, null, false, now(), now()
          from (${from}) r, jsonb_array_elements(r.wadm -> 'body') b
          where b ? 'rdf:predicate' and r.project is not null`)
  }
  await rewriteRepresentations(db, pairsToValues)
}

export async function valuesDown(db: Db): Promise<void> {
  const { rows } = await db.execute<{ n: string }>(sql`
    select count(*) as n from (
      select b from stories s, jsonb_array_elements(s.wadm -> 'body') b
      union all
      select b from _stories_v v, jsonb_array_elements(v.version_wadm -> 'body') b
    ) x where b ? 'rdf:predicate'
      and (b -> 'rdf:predicate' ->> 'id' <> ${SUBJECT} or not (b -> 'rdf:object' ? 'id'))`)
  if (Number(rows[0].n) > 0) {
    throw new Error(
      `vocab_profile down: ${rows[0].n} values are not items of Topics. The old shape cannot hold them. Nothing was changed.`,
    )
  }
  await rewriteStories(db, valuesToPairs)
  await rewriteRepresentations(db, valuesToPairs)
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_ontologies_source" AS ENUM('bundled', 'uploaded');
  CREATE TYPE "public"."enum_ontology_terms_kind" AS ENUM('property', 'class');
  CREATE TYPE "public"."enum_vocab_lists_kind" AS ENUM('items', 'entities');
  CREATE TYPE "public"."enum_vocab_fields_value_type" AS ENUM('text', 'date', 'number', 'link', 'list', 'entity');
  CREATE TYPE "public"."enum_vocab_fields_show_as" AS ENUM('line', 'tags', 'none');
  CREATE TYPE "public"."enum_story_values_layer" AS ENUM('newest', 'published');
  CREATE TABLE "ontologies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"namespace" varchar NOT NULL,
  	"prefix" varchar NOT NULL,
  	"source" "enum_ontologies_source" NOT NULL,
  	"licence" varchar,
  	"file_hash" varchar,
  	"loaded_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ontology_terms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"iri" varchar NOT NULL,
  	"ontology_id" integer,
  	"project_id" integer,
  	"kind" "enum_ontology_terms_kind" NOT NULL,
  	"label" varchar NOT NULL,
  	"comment" varchar,
  	"range_hint" varchar,
  	"gone" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "vocab_lists" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"project_id" integer NOT NULL,
  	"key" varchar NOT NULL,
  	"iri" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"kind" "enum_vocab_lists_kind" NOT NULL,
  	"class_id" integer,
  	"hidden" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "vocab_fields" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"project_id" integer NOT NULL,
  	"property_id" integer NOT NULL,
  	"label" varchar NOT NULL,
  	"help" varchar,
  	"value_type" "enum_vocab_fields_value_type" NOT NULL,
  	"list_id" integer,
  	"required" boolean DEFAULT false,
  	"max" numeric DEFAULT 1 NOT NULL,
  	"show_as" "enum_vocab_fields_show_as" DEFAULT 'line' NOT NULL,
  	"allow_own" boolean DEFAULT false,
  	"hidden" boolean DEFAULT false,
  	"position" numeric NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "story_values" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"story_id" varchar NOT NULL,
  	"project" varchar NOT NULL,
  	"layer" "enum_story_values_layer" NOT NULL,
  	"property" varchar NOT NULL,
  	"object_iri" varchar,
  	"literal" varchar,
  	"datatype" varchar,
  	"language" varchar,
  	"own" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "concepts" ADD COLUMN "list_id" integer;
  ALTER TABLE "concepts" ADD COLUMN "same_as" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ontologies_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ontology_terms_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "vocab_lists_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "vocab_fields_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "story_values_id" integer;
  ALTER TABLE "ontology_terms" ADD CONSTRAINT "ontology_terms_ontology_id_ontologies_id_fk" FOREIGN KEY ("ontology_id") REFERENCES "public"."ontologies"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ontology_terms" ADD CONSTRAINT "ontology_terms_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vocab_lists" ADD CONSTRAINT "vocab_lists_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vocab_lists" ADD CONSTRAINT "vocab_lists_class_id_ontology_terms_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."ontology_terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vocab_fields" ADD CONSTRAINT "vocab_fields_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vocab_fields" ADD CONSTRAINT "vocab_fields_property_id_ontology_terms_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."ontology_terms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vocab_fields" ADD CONSTRAINT "vocab_fields_list_id_vocab_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."vocab_lists"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "story_values" ADD CONSTRAINT "story_values_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "ontologies_namespace_idx" ON "ontologies" USING btree ("namespace");
  CREATE INDEX "ontologies_updated_at_idx" ON "ontologies" USING btree ("updated_at");
  CREATE INDEX "ontologies_created_at_idx" ON "ontologies" USING btree ("created_at");
  CREATE UNIQUE INDEX "ontology_terms_iri_idx" ON "ontology_terms" USING btree ("iri");
  CREATE INDEX "ontology_terms_ontology_idx" ON "ontology_terms" USING btree ("ontology_id");
  CREATE INDEX "ontology_terms_project_idx" ON "ontology_terms" USING btree ("project_id");
  CREATE INDEX "ontology_terms_label_idx" ON "ontology_terms" USING btree ("label");
  CREATE INDEX "ontology_terms_updated_at_idx" ON "ontology_terms" USING btree ("updated_at");
  CREATE INDEX "ontology_terms_created_at_idx" ON "ontology_terms" USING btree ("created_at");
  CREATE INDEX "vocab_lists_project_idx" ON "vocab_lists" USING btree ("project_id");
  CREATE UNIQUE INDEX "vocab_lists_iri_idx" ON "vocab_lists" USING btree ("iri");
  CREATE INDEX "vocab_lists_class_idx" ON "vocab_lists" USING btree ("class_id");
  CREATE INDEX "vocab_lists_updated_at_idx" ON "vocab_lists" USING btree ("updated_at");
  CREATE INDEX "vocab_lists_created_at_idx" ON "vocab_lists" USING btree ("created_at");
  CREATE UNIQUE INDEX "project_key_idx" ON "vocab_lists" USING btree ("project_id","key");
  CREATE INDEX "vocab_fields_project_idx" ON "vocab_fields" USING btree ("project_id");
  CREATE INDEX "vocab_fields_property_idx" ON "vocab_fields" USING btree ("property_id");
  CREATE INDEX "vocab_fields_list_idx" ON "vocab_fields" USING btree ("list_id");
  CREATE INDEX "vocab_fields_position_idx" ON "vocab_fields" USING btree ("position");
  CREATE INDEX "vocab_fields_updated_at_idx" ON "vocab_fields" USING btree ("updated_at");
  CREATE INDEX "vocab_fields_created_at_idx" ON "vocab_fields" USING btree ("created_at");
  CREATE UNIQUE INDEX "project_property_idx" ON "vocab_fields" USING btree ("project_id","property_id");
  CREATE INDEX "story_values_story_idx" ON "story_values" USING btree ("story_id");
  CREATE INDEX "story_values_project_idx" ON "story_values" USING btree ("project");
  CREATE INDEX "story_values_property_idx" ON "story_values" USING btree ("property");
  CREATE INDEX "story_values_object_iri_idx" ON "story_values" USING btree ("object_iri");
  CREATE INDEX "story_values_updated_at_idx" ON "story_values" USING btree ("updated_at");
  CREATE INDEX "story_values_created_at_idx" ON "story_values" USING btree ("created_at");
  ALTER TABLE "concepts" ADD CONSTRAINT "concepts_list_id_vocab_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."vocab_lists"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ontologies_fk" FOREIGN KEY ("ontologies_id") REFERENCES "public"."ontologies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ontology_terms_fk" FOREIGN KEY ("ontology_terms_id") REFERENCES "public"."ontology_terms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vocab_lists_fk" FOREIGN KEY ("vocab_lists_id") REFERENCES "public"."vocab_lists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vocab_fields_fk" FOREIGN KEY ("vocab_fields_id") REFERENCES "public"."vocab_fields"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_story_values_fk" FOREIGN KEY ("story_values_id") REFERENCES "public"."story_values"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "concepts_list_idx" ON "concepts" USING btree ("list_id");
  CREATE INDEX "payload_locked_documents_rels_ontologies_id_idx" ON "payload_locked_documents_rels" USING btree ("ontologies_id");
  CREATE INDEX "payload_locked_documents_rels_ontology_terms_id_idx" ON "payload_locked_documents_rels" USING btree ("ontology_terms_id");
  CREATE INDEX "payload_locked_documents_rels_vocab_lists_id_idx" ON "payload_locked_documents_rels" USING btree ("vocab_lists_id");
  CREATE INDEX "payload_locked_documents_rels_vocab_fields_id_idx" ON "payload_locked_documents_rels" USING btree ("vocab_fields_id");
  CREATE INDEX "payload_locked_documents_rels_story_values_id_idx" ON "payload_locked_documents_rels" USING btree ("story_values_id");`)
  await valuesUp(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await valuesDown(db)
  // `DROP TABLE … CASCADE` drops the foreign keys of the other tables: `IF EXISTS` below.
  await db.execute(sql`
   ALTER TABLE "ontologies" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ontology_terms" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "vocab_lists" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "vocab_fields" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "story_values" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "ontologies" CASCADE;
  DROP TABLE "ontology_terms" CASCADE;
  DROP TABLE "vocab_lists" CASCADE;
  DROP TABLE "vocab_fields" CASCADE;
  DROP TABLE "story_values" CASCADE;
  ALTER TABLE "concepts" DROP CONSTRAINT IF EXISTS "concepts_list_id_vocab_lists_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_ontologies_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_ontology_terms_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_vocab_lists_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_vocab_fields_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_story_values_fk";
  
  DROP INDEX "concepts_list_idx";
  DROP INDEX "payload_locked_documents_rels_ontologies_id_idx";
  DROP INDEX "payload_locked_documents_rels_ontology_terms_id_idx";
  DROP INDEX "payload_locked_documents_rels_vocab_lists_id_idx";
  DROP INDEX "payload_locked_documents_rels_vocab_fields_id_idx";
  DROP INDEX "payload_locked_documents_rels_story_values_id_idx";
  ALTER TABLE "concepts" DROP COLUMN "list_id";
  ALTER TABLE "concepts" DROP COLUMN "same_as";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ontologies_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ontology_terms_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "vocab_lists_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "vocab_fields_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "story_values_id";
  DROP TYPE "public"."enum_ontologies_source";
  DROP TYPE "public"."enum_ontology_terms_kind";
  DROP TYPE "public"."enum_vocab_lists_kind";
  DROP TYPE "public"."enum_vocab_fields_value_type";
  DROP TYPE "public"."enum_vocab_fields_show_as";
  DROP TYPE "public"."enum_story_values_layer";`)
}
