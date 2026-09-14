import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Trims every string field in a payload before it's sent to the backend — stray
// leading/trailing whitespace from copy-paste or an accidental spacebar tap
// shouldn't get stored (mirrors the same normalization lib/customers.ts already
// applies to email server-side, just extended to every text field here). Recurses
// one level into plain nested objects (e.g. CreateBookingPayload's `customer`), but
// treats arrays, File/Blob, and Date values as opaque — never call this on a payload
// that contains a password field, since trimming could silently change it.
export function trimStrings<T>(value: T): T {
  if (typeof value === 'string') {
    return value.trim() as T;
  }
  if (Array.isArray(value) || value instanceof File || value instanceof Date || value === null) {
    return value;
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = trimStrings(val);
    }
    return result as T;
  }
  return value;
}
