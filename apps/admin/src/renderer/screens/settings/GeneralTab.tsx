import { ChangeEvent, DragEvent, FormEvent, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../AuthContext';
import { useAppSettings } from '../../AppSettingsContext';
import { toast } from '../../toast';
import { cn } from '../../lib/utils';
import { fileToBase64 } from '../../lib/file';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import type { AppSettingsDto, UpdateAppSettingsPayload } from '../../../preload';

// Mirrors apps/backend/src/routes/settings.schema.ts's const arrays — no shared
// package between the two apps, so these must be kept manually in sync.
const CURRENCY_OPTIONS = ['USD', 'PHP', 'EUR', 'GBP', 'AUD', 'SGD', 'JPY'] as const;
const DATE_FORMAT_OPTIONS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] as const;
const TIME_FORMAT_OPTIONS = ['12h', '24h'] as const;
const LANGUAGE_OPTIONS = ['en'] as const;
const LANGUAGE_LABELS: Record<(typeof LANGUAGE_OPTIONS)[number], string> = { en: 'English' };
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DROPZONE_CLASS =
  'flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted transition-colors duration-150 ease-in-out hover:border-muted';
const DROPZONE_ACTIVE_CLASS = 'border-accent-end text-heading';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function cleanIpcErrorMessage(message: string): string {
  return message
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '');
}

export function GeneralTab() {
  const { settings, status } = useAppSettings();

  if (!settings) {
    return <p className="status-message">{status === 'error' ? 'Could not load settings.' : 'Loading…'}</p>;
  }

  // Keyed on settings.id (stable across the singleton row's lifetime) so the form's
  // local state is (re-)seeded from the fetched settings exactly once they arrive,
  // rather than initializing from `null` on a fast first render.
  return <GeneralTabForm key={settings.id} settings={settings} />;
}

function GeneralTabForm({ settings }: { settings: AppSettingsDto }) {
  const { session } = useAuth();
  const { refresh } = useAppSettings();

  const [appName, setAppName] = useState(settings.appName);
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [dateFormat, setDateFormat] = useState(settings.dateFormat);
  const [timeFormat, setTimeFormat] = useState(settings.timeFormat);
  const [language, setLanguage] = useState(settings.language);
  const [currency, setCurrency] = useState(settings.currency);
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(settings.fiscalYearStartMonth);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState('');
  const [logoError, setLogoError] = useState('');
  const [uploadedLogo, setUploadedLogo] = useState<{ file: File; url: string } | null>(null);
  const [isLogoDragActive, setIsLogoDragActive] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // 'UTC' is prepended explicitly: Intl.supportedValuesOf('timeZone') enumerates
  // canonical IANA zone names but excludes the "UTC" special case, even though it's
  // a valid timeZone value and this model's own Prisma default.
  const timezoneOptions = useMemo(() => ['UTC', ...Intl.supportedValuesOf('timeZone')], []);
  const currentLogoUrl = logoPreviewUrl || settings.logoUrl || '';

  function processLogoFile(file: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setLogoError('Unsupported file type. Use JPEG, PNG, WebP, or GIF.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setLogoError('Image exceeds 5MB limit.');
      return;
    }
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    setLogoError('');
    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
  }

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      processLogoFile(file);
    }
  }

  function handleLogoDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsLogoDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processLogoFile(file);
    }
  }

  function handleRequestError(err: unknown) {
    const raw = err instanceof Error ? cleanIpcErrorMessage(err.message) : 'request failed';
    try {
      const parsed = JSON.parse(raw) as { status?: number; error?: string; details?: Record<string, string[]> };
      if (parsed.status === 401) {
        toast.error('Session expired, please log in again.');
      } else if (parsed.details) {
        const flat: Record<string, string> = {};
        for (const [field, messages] of Object.entries(parsed.details)) {
          if (messages?.[0]) {
            flat[field] = messages[0];
          }
        }
        setFieldErrors(flat);
      } else {
        toast.error(parsed.error || 'Could not save settings.');
      }
    } catch {
      toast.error(raw || 'Could not save settings.');
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      return;
    }
    setSubmitting(true);
    setFieldErrors({});

    try {
      const payload: UpdateAppSettingsPayload = {
        appName,
        companyName,
        timezone,
        dateFormat,
        timeFormat,
        language,
        currency,
        fiscalYearStartMonth,
      };

      if (logoFile) {
        if (uploadedLogo && uploadedLogo.file === logoFile) {
          payload.logoUrl = uploadedLogo.url;
        } else {
          const base64 = await fileToBase64(logoFile);
          const { url } = await window.settingsAPI.uploadLogo(base64, logoFile.name, logoFile.type, session.accessToken);
          setUploadedLogo({ file: logoFile, url });
          payload.logoUrl = url;
        }
      }

      await window.settingsAPI.update(payload, session.accessToken);
      await refresh();
      toast.success('Settings saved.');
    } catch (err) {
      handleRequestError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid grid-cols-2 gap-x-6 gap-y-4" onSubmit={handleSubmit}>
      <label className="form-field col-span-full">
        <span>App name</span>
        <input className="neu-field" value={appName} onChange={(e) => setAppName(e.target.value)} required />
        {fieldErrors.appName && <p className="form-field-error">{fieldErrors.appName}</p>}
      </label>

      <label className="form-field col-span-full">
        <span>Company name</span>
        <input className="neu-field" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
        {fieldErrors.companyName && <p className="form-field-error">{fieldErrors.companyName}</p>}
      </label>

      <div className="form-field col-span-full">
        <span>Logo</span>
        <div
          className={cn(DROPZONE_CLASS, isLogoDragActive && DROPZONE_ACTIVE_CLASS)}
          role="button"
          tabIndex={0}
          onClick={() => logoInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              logoInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsLogoDragActive(true);
          }}
          onDragLeave={() => setIsLogoDragActive(false)}
          onDrop={handleLogoDrop}
        >
          <span>Drag & drop a logo here, or click to browse</span>
        </div>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleLogoChange}
          className="hidden"
        />
        {currentLogoUrl && (
          <img className="h-16 w-16 rounded-xl object-cover neu-raised-md" src={currentLogoUrl} alt="Logo preview" />
        )}
        {logoError && <p className="form-field-error">{logoError}</p>}
      </div>

      <label className="form-field">
        <span>Timezone</span>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {timezoneOptions.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.timezone && <p className="form-field-error">{fieldErrors.timezone}</p>}
      </label>

      <label className="form-field">
        <span>Currency</span>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCY_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="form-field">
        <span>Date format</span>
        <Select value={dateFormat} onValueChange={setDateFormat}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_FORMAT_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="form-field">
        <span>Time format</span>
        <Select value={timeFormat} onValueChange={setTimeFormat}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIME_FORMAT_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option === '12h' ? '12-hour' : '24-hour'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="form-field">
        <span>Language</span>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {LANGUAGE_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="form-field">
        <span>Fiscal year start</span>
        <Select value={String(fiscalYearStartMonth)} onValueChange={(v) => setFiscalYearStartMonth(Number(v))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_LABELS.map((label, index) => (
              <SelectItem key={label} value={String(index + 1)}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <div className="form-actions">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
