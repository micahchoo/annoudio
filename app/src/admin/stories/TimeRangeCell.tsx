'use client'

import type { DefaultCellComponentProps } from 'payload'

import { clockRange } from '@/clock'

/** The `start` cell of the stories list: the time range, for example "1:02–1:35". */
export function TimeRangeCell({ cellData, rowData }: DefaultCellComponentProps) {
  return <span>{clockRange(cellData, rowData?.end)}</span>
}
