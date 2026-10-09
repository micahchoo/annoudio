'use client'

import type { DefaultCellComponentProps } from 'payload'

import { clock } from '@/clock'

/** A list cell that shows seconds as "m:ss". */
export function ClockCell({ cellData }: DefaultCellComponentProps) {
  return <span>{clock(cellData)}</span>
}
