/**
 * Get initials from display name for avatar placeholder.
 * "Anjali Verma" -> "AV", "Anjali" -> "AN", "" -> "U"
 */
export function getInitials(name: string | undefined | null): string {
  if (!name || !name.trim()) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
