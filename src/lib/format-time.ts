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

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Formats a date using the app-wide standard format:
 * - '13 Oct 2026' for full dates or dates outside the current year
 * - '13 Oct' for dates in the current year
 */
export function formatAppDate(
  dateInput: string | Date | null | undefined,
  forceFull = false
): string {
  if (!dateInput) return '';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    const day = d.getDate();
    const month = MONTHS_SHORT[d.getMonth()];
    const year = d.getFullYear();
    const currentYear = new Date().getFullYear();

    if (forceFull || year !== currentYear) {
      return `${day} ${month} ${year}`;
    }
    return `${day} ${month}`;
  } catch {
    return String(dateInput);
  }
}

/**
 * Formats an ISO date string to a compact human-readable date using the app standard.
 * Example: '13 Oct' or '13 Oct 2026'.
 */
export function formatCompactDueDate(dateString: string): string {
  return formatAppDate(dateString);
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
