// Records every workflow of design/recordings/ from the running demo stack: a trimmed WebM,
// a poster PNG and a caption per recording.
//
//   node design/recordings/scripts/record-all.mjs          # all, in the order below
//   node design/recordings/scripts/record-all.mjs 04 10    # only the flows whose name starts so
//   node design/recordings/scripts/record-all.mjs --gif    # also a GIF of each
//
// The order matters: 10 and 11 make the member's stories that 06 publishes and 07 returns,
// 12 changes the returned story, 13 replies on a published one. State between flows
// (the member, story ids) is in scripts/.work/state.json. Set REC_RUN to reuse a member.

import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const flowsDir = fileURLToPath(new URL('./flows/', import.meta.url))
const args = process.argv.slice(2)
if (args.includes('--gif')) process.env.REC_GIF = '1'
const only = args.filter((a) => !a.startsWith('--'))
// 04 adds the question Place before the member answers it (10); 01 runs after 10 and 11,
// so Today shows stories that wait; 06 publishes the member's first story, 07 returns the next.
const ORDER = ['04', '05', '08', '10', '11', '01', '02', '03', '09', '06', '07', '12', '13', '14', '15', '16', '17', '18', '19']
const rank = (f) => (ORDER.indexOf(f.slice(0, 2)) + 100) % 100
const files = readdirSync(flowsDir)
  .filter((f) => f.endsWith('.mjs'))
  .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  .filter((f) => only.length === 0 || only.some((p) => f.startsWith(p)))

const results = []
let failed = 0
for (const file of files) {
  console.log(`== ${file}`)
  const flow = await import(join(flowsDir, file))
  try {
    results.push({ ...(await flow.default()), role: flow.role, workflow: flow.workflow })
  } catch (error) {
    failed += 1
    console.error(`  FAILED: ${error.message.split('\n').slice(0, 6).join('\n  ')}`)
  }
}
writeFileSync(
  fileURLToPath(new URL('./.work/last-run.json', import.meta.url)),
  JSON.stringify(results, null, 2),
)
console.log(`\n${results.length} recorded, ${failed} failed.`)
for (const r of results) console.log(`${r.name}.webm\t${r.seconds} s\t${(r.bytes / 1048576).toFixed(2)} MB`)
process.exit(failed ? 1 : 0)
