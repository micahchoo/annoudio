// Make the bundled ontologies: `src/modules/vocabulary/bundled/<prefix>.json`, one term
// list per ontology, from the official files (design/vocab.md §2, §9.1).
//
//   pnpm exec tsx scripts/bundle-ontologies.ts [cache folder]
//
// The script downloads each official file into the cache folder (default: a folder in the
// system temp folder) when the file is not there, then reads it with the same term rules
// as an upload (`vocabulary/terms.ts`). The app never downloads these files: the JSON
// files are checked in, and a migration seeds them.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseRdf, type RdfSyntax } from '../src/modules/vocabulary/rdf'
import { termsOf } from '../src/modules/vocabulary/terms'

interface Source {
  prefix: string
  label: string
  namespace: string
  url: string
  syntax: RdfSyntax
  licence: string
  allSubjectsAreProperties?: boolean
}

// Prefixes are the ones of the W3C annotation context (`anno.jsonld`) where it has one:
// `dctypes` (not `dctype`) and `schema` with `http:` IRIs.
const SOURCES: Source[] = [
  {
    prefix: 'dcterms',
    label: 'Dublin Core',
    namespace: 'http://purl.org/dc/terms/',
    url: 'https://www.dublincore.org/specifications/dublin-core/dcmi-terms/dublin_core_terms.ttl',
    syntax: 'turtle',
    licence: 'CC BY 4.0 (DCMI)',
  },
  {
    prefix: 'dctypes',
    label: 'Dublin Core types',
    namespace: 'http://purl.org/dc/dcmitype/',
    url: 'https://www.dublincore.org/specifications/dublin-core/dcmi-terms/dublin_core_type.ttl',
    syntax: 'turtle',
    licence: 'CC BY 4.0 (DCMI)',
  },
  {
    prefix: 'foaf',
    label: 'FOAF',
    namespace: 'http://xmlns.com/foaf/0.1/',
    url: 'http://xmlns.com/foaf/spec/index.rdf',
    syntax: 'rdf-xml',
    licence: 'CC BY 1.0',
  },
  {
    prefix: 'skos',
    label: 'SKOS',
    namespace: 'http://www.w3.org/2004/02/skos/core#',
    url: 'https://www.w3.org/2009/08/skos-reference/skos.rdf',
    syntax: 'rdf-xml',
    licence: 'W3C Software and Document Licence',
  },
  {
    prefix: 'rdf',
    label: 'RDF',
    namespace: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    url: 'https://www.w3.org/1999/02/22-rdf-syntax-ns.ttl',
    syntax: 'turtle',
    licence: 'W3C Software and Document Licence',
  },
  {
    prefix: 'rdfs',
    label: 'RDF Schema',
    namespace: 'http://www.w3.org/2000/01/rdf-schema#',
    url: 'https://www.w3.org/2000/01/rdf-schema.ttl',
    syntax: 'turtle',
    licence: 'W3C Software and Document Licence',
  },
  {
    prefix: 'schema',
    label: 'Schema.org',
    namespace: 'http://schema.org/',
    url: 'https://schema.org/version/latest/schemaorg-current-http.ttl',
    syntax: 'turtle',
    licence: 'CC BY-SA 3.0',
  },
  {
    prefix: 'relators',
    label: 'MARC relators',
    namespace: 'http://id.loc.gov/vocabulary/relators/',
    url: 'https://id.loc.gov/vocabulary/relators.nt',
    syntax: 'turtle',
    // id.loc.gov/about: "making it available as a public domain data set".
    licence: 'Public domain (Library of Congress)',
    allSubjectsAreProperties: true,
  },
]

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(here, '../src/modules/vocabulary/bundled')
const cache = path.resolve(process.argv[2] ?? path.join(tmpdir(), 'annoudio-ontologies'))

async function source(item: Source): Promise<string> {
  const file = path.join(cache, `${item.prefix}${path.extname(new URL(item.url).pathname)}`)
  try {
    return await readFile(file, 'utf8')
  } catch {
    const response = await fetch(item.url, { headers: { 'user-agent': 'annoudio-bundle' } })
    if (!response.ok) throw new Error(`${item.url}: ${response.status}`)
    const text = await response.text()
    await writeFile(file, text)
    return text
  }
}

await mkdir(cache, { recursive: true })
await mkdir(out, { recursive: true })
for (const item of SOURCES) {
  const text = await source(item)
  const terms = termsOf(await parseRdf(text, item.syntax), item)
  const { allSubjectsAreProperties: _all, syntax: _syntax, ...meta } = item
  await writeFile(
    path.join(out, `${item.prefix}.json`),
    `${JSON.stringify({ ...meta, terms }, null, 1)}\n`,
  )
  const count = (kind: string) => terms.filter((t) => t.kind === kind).length
  console.info(`${item.prefix}: ${count('property')} properties, ${count('class')} classes`)
}
