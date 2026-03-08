"use client"

import { GooeyToaster as GoeyToasterPrimitive, gooeyToast } from "goey-toast"
import type { GoeyToasterProps } from "goey-toast"
import "goey-toast/styles.css"

export const goeyToast = gooeyToast
export type { GoeyToasterProps }
export type {
  GoeyToastOptions,
  GoeyPromiseData,
  GoeyToastAction,
  GoeyToastClassNames,
  GoeyToastTimings,
} from "goey-toast"

function GoeyToaster(props: GoeyToasterProps) {
  return <GoeyToasterPrimitive position="top-center" {...props} />
}

export { GoeyToaster }
