'use server'

import {
  exportSkos,
  importSkos,
  type ImportResult,
  type SkosFile,
  type SkosFormat,
} from '@/modules/vocabulary'

import { requestOperator } from '../operator'

const origin = () => process.env.ANNOUDIO_ORIGIN || ''

/** The project vocabulary as a SKOS file, for the "Download as SKOS" buttons. */
export async function downloadSkos(
  project: string,
  format: SkosFormat,
): Promise<SkosFile | { error: 'forbidden' | 'unknown-project' }> {
  const session = await requestOperator()
  if (!session) return { error: 'forbidden' }
  const file = await exportSkos({ payload: session.payload, origin: origin() }, project, format)
  return file ?? { error: 'unknown-project' }
}

/** The preview (`apply: false`) or the import (`apply: true`) of a SKOS file. */
export async function uploadSkos(
  project: string,
  text: string,
  apply: boolean,
): Promise<ImportResult | { ok: false; error: 'forbidden' }> {
  const session = await requestOperator()
  if (!session) return { ok: false, error: 'forbidden' }
  return importSkos({ payload: session.payload, origin: origin() }, project, text, { apply })
}
