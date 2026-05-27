const HTML_TAGS = /<[^>]*>/g
const DANGEROUS_ATTRS = /on\w+\s*=/gi

// Characters blocked in live input — XSS / injection vectors
const BLOCKED_CHARS = /[<>'"`~;=*&\\]/g

export function filterInput(value: string): string {
  return value.replace(BLOCKED_CHARS, '')
}

// For free text fields (title, body): strip HTML/script only, not SQL keywords
// SQL injection not a concern — backend uses Prisma parameterized queries
export function sanitizeText(value: unknown, maxLength = 2000): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(HTML_TAGS, '')
    .replace(DANGEROUS_ATTRS, '')
    .trim()
    .slice(0, maxLength)
}

export function sanitizeShortText(value: unknown): string {
  return sanitizeText(value, 200)
}

// For IDs and controlled values: strict allow-list only
export function sanitizeVideoId(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 11)
}
