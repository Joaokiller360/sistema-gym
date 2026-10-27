import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Uploaded logos are proxied through `/uploads` (see next.config rewrites); external URLs stay as-is. */
export function normalizeLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  return url.replace(/^https?:\/\/[^/]+(?=\/uploads\/)/, '')
}
