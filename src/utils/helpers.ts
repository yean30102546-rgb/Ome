/**
 * Utility Functions
 * Formatting, validation, and helper functions
 */

/**
 * Generate a unique ID for a rework case
 * Format: RWYYMMDDHHmm (e.g., RW2604251707)
 */
export function generateCaseId(): string {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(2);
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const dd = now.getDate().toString().padStart(2, '0');
  const hh = now.getHours().toString().padStart(2, '0');
  const min = now.getMinutes().toString().padStart(2, '0');

  return `RW${yy}${mm}${dd}${hh}${min}`;
}

/**
 * Generate unique sub-IDs for items within a case
 * Format: {caseId}-{itemNumber:03d} (e.g., RW2604251707-001)
 */
export function generateItemSubId(caseId: string, itemIndex: number): string {
  return `${caseId}-${(itemIndex + 1).toString().padStart(3, '0')}`;
}

/**
 * Format date to Thai format
 */
export function formatDateThai(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Validate required fields
 */
export function validateReworkItem(item: {
  itemNumber?: string | number;
  itemName?: string;
  amount?: number | string;
  reason?: string;
  responsible?: string;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!item.itemNumber || String(item.itemNumber).trim() === '') {
    errors.push('Item Number is required');
  }

  if (!item.itemName || String(item.itemName).trim() === '') {
    errors.push('Item Name is required');
  }

  if (!item.amount || parseInt(String(item.amount)) <= 0) {
    errors.push('Amount must be greater than 0');
  }

  if (!item.reason || String(item.reason).trim() === '') {
    errors.push('Reason is required');
  }

  if (!item.responsible || String(item.responsible).trim() === '') {
    errors.push('Responsible party is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate all form items
 */
export function validateAllItems(items: any[]): { isValid: boolean; errors: Record<number, string[]> } {
  const errors: Record<number, string[]> = {};

  items.forEach((item, idx) => {
    const validation = validateReworkItem(item);
    if (!validation.isValid) {
      errors[idx] = validation.errors;
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Check if save button should be disabled
 * Required fields: itemNumber, itemName, amount, reason, responsible
 */
export function isSaveDisabled(items: any[]): boolean {
  if (items.length === 0) return true;

  return items.some(
    (item) =>
      !item.itemNumber ||
      !item.itemName ||
      !item.amount ||
      item.amount <= 0 ||
      !item.reason ||
      !item.responsible
  );
}

/**
 * Sort cases by status: Pending > In-Progress > Completed
 */
export function sortCasesByStatus(
  cases: any[]
): any[] {
  const statusOrder = { Pending: 0, 'In-Progress': 1, Completed: 2 };

  return [...cases].sort(
    (a, b) =>
      (statusOrder[a.status as keyof typeof statusOrder] || 999) -
      (statusOrder[b.status as keyof typeof statusOrder] || 999)
  );
}

/**
 * Filter cases by search query
 */
export function filterCasesByQuery(cases: any[], query: string): any[] {
  if (!query.trim()) return cases;

  const lowerQuery = query.toLowerCase();

  return cases.filter(
    (caseItem) =>
      caseItem.id.toLowerCase().includes(lowerQuery) ||
      caseItem.source.toLowerCase().includes(lowerQuery) ||
      caseItem.items.some((item: any) =>
        item.itemName.toLowerCase().includes(lowerQuery)
      )
  );
}

/**
 * Check if a value is a valid number
 */
export function isNumeric(value: string): boolean {
  return /^\d*$/.test(value);
}

/**
 * Enforce numeric input only
 */
export function enforceNumeric(value: string): string {
  return value.replace(/[^\d]/g, '');
}

/**
 * Format timestamp to readable format
 */
export function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

/**
 * Calculate completion percentage
 */
export function calculateCompletionRate(cases: any[]): number {
  if (cases.length === 0) return 0;
  const completed = cases.filter((c) => c.status === 'Completed').length;
  return Math.round((completed / cases.length) * 100);
}

/**
 * Get statistics from cases
 */
export function getStatistics(cases: any[]) {
  return {
    total: cases.length,
    pending: cases.filter((c) => c.status === 'Pending').length,
    inProgress: cases.filter((c) => c.status === 'In-Progress').length,
    completed: cases.filter((c) => c.status === 'Completed').length,
    completionRate: calculateCompletionRate(cases),
  };
}
