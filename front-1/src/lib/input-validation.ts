/**
 * Centralized input validation and sanitization.
 *
 * Uses whitelist approach: each field type defines exactly which chars are allowed.
 * Everything else is stripped/blocked.
 *
 * XSS/injection vectors always blocked across all types (except password):
 * < > ` \ { } | ^ ~ $ (outside their allowed contexts)
 */

export type FieldType =
  | 'text'     // General text: letters, numbers, basic punctuation
  | 'name'     // Person/place names: letters, accents, spaces, hyphens, apostrophes
  | 'email'    // Email addresses
  | 'password' // Passwords: all printable ASCII
  | 'url'      // URLs/slugs with full RFC 3986 set
  | 'price'    // Monetary: digits + decimal point
  | 'date'     // Dates: digits, slashes, hyphens
  | 'phone'    // Phone numbers: digits, +, spaces, hyphens, parens
  | 'search'   // Search queries: permissive but safe
  | 'number'   // Pure integers
  | 'address'  // Physical addresses: includes #, /, °
  | 'slug'     // URL slugs: alphanumeric, hyphens, underscores

/**
 * Character classes per field type (content of [...]).
 * Used to build allowed/forbidden regex dynamically.
 */
const CHAR_CLASS: Record<FieldType, string> = {
  name:     "a-zA-ZÀ-ÿ\\s'\\-.,",
  text:     "a-zA-Z0-9À-ÿ\\s.,;:'\"\\/()\\-&!?",
  email:    "a-zA-Z0-9._%+\\-@",
  password: "\\x20-\\x7E",
  url:      "a-zA-Z0-9\\-._~:/?#\\[\\]@!$&'()*+,;=%",
  price:    "0-9.",
  date:     "0-9/\\-",
  phone:    "0-9+\\s\\-()",
  search:   "a-zA-Z0-9À-ÿ\\s.,'\\-+@",
  number:   "0-9",
  address:  "a-zA-Z0-9À-ÿ\\s.,;:'\\-#\\/°()",
  slug:     "a-z0-9\\-_",
}

function allowedRegex(type: FieldType): RegExp {
  return new RegExp(`^[${CHAR_CLASS[type]}]*$`)
}

function forbiddenCharRegex(type: FieldType): RegExp {
  return new RegExp(`[^${CHAR_CLASS[type]}]`, 'g')
}

/** Check if an entire string is valid for the given field type. */
export function isValid(value: string, type: FieldType): boolean {
  if (!value) return true
  return allowedRegex(type).test(value)
}

/** Check if a single character is allowed for the given field type. */
export function isCharAllowed(char: string, type: FieldType): boolean {
  return new RegExp(`^[${CHAR_CLASS[type]}]$`).test(char)
}

/**
 * Remove forbidden characters and trim whitespace.
 * Safe to call in onChange or before submitting to the backend.
 */
export function sanitize(value: string, type: FieldType): string {
  return value.replace(forbiddenCharRegex(type), '').trim()
}

/**
 * Sanitize without trimming (for use during typing where trim would be disruptive).
 */
export function sanitizeNoTrim(value: string, type: FieldType): string {
  return value.replace(forbiddenCharRegex(type), '')
}

export interface SafeInputHandlers {
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onPaste: (e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onDrop: (e: React.DragEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void
}

/**
 * Create React event handlers that enforce field type restrictions.
 *
 * Spread the returned object onto any <input> or <textarea>:
 *   <input {...createHandlers('name')} ... />
 *
 * These handlers:
 * - Block forbidden chars on keydown
 * - Sanitize clipboard paste (insert clean text at cursor)
 * - Block drag-and-drop of invalid content
 * - Trim on blur
 */
export function createHandlers(type: FieldType): SafeInputHandlers {
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key.length !== 1) return
    if (!isCharAllowed(e.key, type)) {
      e.preventDefault()
    }
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.preventDefault()
    const raw = e.clipboardData.getData('text/plain')
    const clean = sanitizeNoTrim(raw, type)
    if (!clean) return

    const target = e.currentTarget
    const start = target.selectionStart ?? target.value.length
    const end = target.selectionEnd ?? target.value.length
    const current = target.value
    const newValue = current.substring(0, start) + clean + current.substring(end)

    const nativeSetter = Object.getOwnPropertyDescriptor(
      target instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype,
      'value'
    )?.set
    nativeSetter?.call(target, newValue)
    target.dispatchEvent(new Event('input', { bubbles: true }))
    const pos = start + clean.length
    if (target.type !== 'email') {
      target.setSelectionRange(pos, pos)
    }
  }

  function onDrop(e: React.DragEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const text = e.dataTransfer.getData('text/plain')
    if (text && !isValid(text, type)) {
      e.preventDefault()
    }
  }

  function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const target = e.currentTarget
    const trimmed = target.value.trim()
    if (trimmed !== target.value) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        target instanceof HTMLTextAreaElement
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype,
        'value'
      )?.set
      nativeSetter?.call(target, trimmed)
      target.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  return { onKeyDown, onPaste, onDrop, onBlur }
}

/**
 * Infer a FieldType from an HTML input type attribute.
 * Use as a fallback when no explicit fieldType prop is given.
 */
export function inferFieldType(htmlType?: string): FieldType {
  switch (htmlType) {
    case 'email':    return 'email'
    case 'password': return 'password'
    case 'number':   return 'number'
    case 'tel':      return 'phone'
    case 'url':      return 'url'
    case 'date':
    case 'datetime-local':
    case 'month':
    case 'week':     return 'date'
    default:         return 'text'
  }
}

/**
 * Like createHandlers but without onBlur — use for React Hook Form inputs
 * where register() manages its own onBlur for field-level validation.
 */
export function createBlockHandlers(type: FieldType): Omit<SafeInputHandlers, 'onBlur'> {
  const { onKeyDown, onPaste, onDrop } = createHandlers(type)
  return { onKeyDown, onPaste, onDrop }
}

/**
 * Zod .refine() helper: validates that a field value matches the allowed pattern.
 * Usage: z.string().refine(zodSafeField('name'), 'Caracteres no permitidos')
 */
export function zodSafeField(type: FieldType) {
  return (value: string) => !value || isValid(value.trim(), type)
}
