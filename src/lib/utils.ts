export { cn } from "cn"

/**
 * Safely extracts the human-readable user note from the checklist entry notes field.
 * Handles plain text, JSON with ppe_details & user_note, nested JSON, or returns empty string.
 */
export function extractUserNote(rawNotes?: string | null): string {
  if (!rawNotes || typeof rawNotes !== 'string') return ''
  const trimmed = rawNotes.trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed && typeof parsed === 'object') {
        if ('user_note' in parsed) {
          return extractUserNote(parsed.user_note)
        }
        if ('ppe_details' in parsed) {
          return ''
        }
      }
    } catch {
      // not valid JSON, treat as normal string
    }
  }

  return trimmed
}

/**
 * Formats a date string (YYYY-MM-DD) into DD/MM/YYYY
 */
export function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return '-'
  const parts = dateStr.trim().split('-')
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return dateStr
}
