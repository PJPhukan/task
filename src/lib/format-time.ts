/**
 * Formats seconds into a compact string representation with tabular numerals.
 * Examples: '3d 4h', '2h 15m', '45m', '12s'.
 */
export function formatCompactWaiting(seconds: number): string {
  if (seconds <= 0) return '0m';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${secs}s`;
}

/**
 * Formats an ISO date string (YYYY-MM-DD or full ISO) to a compact human-readable date.
 * Example: 'Oct 12' or '2026-10-12'.
 */
export function formatCompactDueDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Checks if a due date is in the past compared to the start of today.
 */
export function isDueDateOverdue(dueDateString: string | null | undefined): boolean {
  if (!dueDateString) return false;
  try {
    const due = new Date(dueDateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today;
  } catch {
    return false;
  }
}
