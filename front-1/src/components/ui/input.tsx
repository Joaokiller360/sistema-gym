import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"
import { type FieldType, createHandlers, inferFieldType } from "@/lib/input-validation"

interface InputProps extends React.ComponentProps<"input"> {
  fieldType?: FieldType
}

function Input({ className, type, fieldType, onKeyDown, onPaste, onDrop, onBlur, ...props }: InputProps) {
  const effectiveType = fieldType ?? inferFieldType(type)

  // Skip validation for types that have native browser handling or file inputs
  const skipValidation = type === 'file' || type === 'checkbox' || type === 'radio'
    || type === 'hidden' || type === 'date' || type === 'datetime-local'
    || type === 'month' || type === 'week' || type === 'time' || type === 'color'
    || type === 'range'

  const handlers = skipValidation ? null : createHandlers(effectiveType)

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      onKeyDown={e => { handlers?.onKeyDown(e as React.KeyboardEvent<HTMLInputElement>); onKeyDown?.(e) }}
      onPaste={e => { handlers?.onPaste(e as React.ClipboardEvent<HTMLInputElement>); onPaste?.(e) }}
      onDrop={e => { handlers?.onDrop(e as React.DragEvent<HTMLInputElement>); onDrop?.(e) }}
      onBlur={e => { handlers?.onBlur(e as React.FocusEvent<HTMLInputElement>); onBlur?.(e) }}
      {...props}
    />
  )
}

export { Input }
