import * as React from "react"
import { cn } from "@/lib/utils"
import { type FieldType, createHandlers } from "@/lib/input-validation"

interface TextareaProps extends React.ComponentProps<"textarea"> {
  fieldType?: FieldType
}

function Textarea({ className, fieldType = 'text', onKeyDown, onPaste, onDrop, onBlur, ...props }: TextareaProps) {
  const handlers = createHandlers(fieldType)

  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      onKeyDown={e => { handlers.onKeyDown(e); onKeyDown?.(e) }}
      onPaste={e => { handlers.onPaste(e); onPaste?.(e) }}
      onDrop={e => { handlers.onDrop(e); onDrop?.(e) }}
      onBlur={e => { handlers.onBlur(e); onBlur?.(e) }}
      {...props}
    />
  )
}

export { Textarea }
