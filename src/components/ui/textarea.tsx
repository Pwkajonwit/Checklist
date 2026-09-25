import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 py-2 text-sm font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal transition-all outline-none hover:border-slate-400 hover:bg-slate-50 focus-visible:border-blue-600 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-50 aria-invalid:border-rose-500 aria-invalid:ring-4 aria-invalid:ring-rose-100",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
