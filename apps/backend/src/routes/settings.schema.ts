import { z } from 'zod';

export const CURRENCY_OPTIONS = ['USD', 'PHP', 'EUR', 'GBP', 'AUD', 'SGD', 'JPY'] as const;
export const DATE_FORMAT_OPTIONS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] as const;
export const TIME_FORMAT_OPTIONS = ['12h', '24h'] as const;
export const LANGUAGE_OPTIONS = ['en'] as const;

// Intl.supportedValuesOf('timeZone') enumerates canonical IANA zone names but
// excludes the "UTC" special case, even though Intl APIs accept it directly as a
// valid timeZone — and it's this model's own Prisma default, so it must validate.
const VALID_TIMEZONES = new Set([...Intl.supportedValuesOf('timeZone'), 'UTC']);

export const updateSettingsSchema = z.object({
  appName: z.string().trim().min(1).max(100).optional(),
  companyName: z.string().trim().min(1).max(100).optional(),
  logoUrl: z.string().trim().url().nullable().optional(),
  timezone: z
    .string()
    .trim()
    .refine((tz) => VALID_TIMEZONES.has(tz), { message: 'unknown timezone' })
    .optional(),
  dateFormat: z.enum(DATE_FORMAT_OPTIONS).optional(),
  timeFormat: z.enum(TIME_FORMAT_OPTIONS).optional(),
  language: z.enum(LANGUAGE_OPTIONS).optional(),
  currency: z.enum(CURRENCY_OPTIONS).optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
  maxBookingsPerDay: z.number().int().min(1).optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
