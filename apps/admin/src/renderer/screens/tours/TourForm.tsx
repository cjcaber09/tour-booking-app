import { ChangeEvent, FormEvent, useState } from 'react';
import { useAuth } from '../../AuthContext';
import { toast } from '../../toast';
import type { CreateTourPayload } from '../../../preload';

interface TourFormProps {
  onCancel: () => void;
  onCreated: () => void;
}

interface FormState {
  title: string;
  description: string;
  price: string;
  summary: string;
  duration: string;
  maxGroupSize: string;
  difficulty: '' | 'easy' | 'medium' | 'difficult';
  priceDiscount: string;
  startLocation: string;
  isActive: boolean;
}

const INITIAL_STATE: FormState = {
  title: '',
  description: '',
  price: '',
  summary: '',
  duration: '',
  maxGroupSize: '',
  difficulty: '',
  priceDiscount: '',
  startLocation: '',
  isActive: true,
};

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function cleanIpcErrorMessage(message: string): string {
  return message
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '');
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function TourForm({ onCancel, onCreated }: TourFormProps) {
  const { session } = useAuth();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const [uploadedImage, setUploadedImage] = useState<{ file: File; url: string } | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetImage() {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(null);
    setImagePreviewUrl('');
    setImageError('');
    setUploadedImage(null);
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError('Unsupported file type. Use JPEG, PNG, WebP, or GIF.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Image exceeds 5MB limit.');
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageError('');
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  function handleCancel() {
    setForm(INITIAL_STATE);
    setFieldErrors({});
    resetImage();
    onCancel();
  }

  function handleRequestError(err: unknown) {
    const raw = err instanceof Error ? cleanIpcErrorMessage(err.message) : 'request failed';
    try {
      const parsed = JSON.parse(raw) as {
        status?: number;
        error?: string;
        details?: Record<string, string[]>;
      };
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
        toast.error(parsed.error || 'Could not complete request.');
      }
    } catch {
      toast.error(raw || 'Could not complete request.');
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!session || !imageFile) {
      return;
    }
    setSubmitting(true);
    setFieldErrors({});

    try {
      let url: string;
      if (uploadedImage && uploadedImage.file === imageFile) {
        url = uploadedImage.url;
      } else {
        const base64 = await fileToBase64(imageFile);
        ({ url } = await window.toursAPI.uploadImage(base64, imageFile.name, imageFile.type, session.accessToken));
        setUploadedImage({ file: imageFile, url });
      }

      const payload: CreateTourPayload = {
        title: form.title,
        description: form.description,
        price: Number(form.price),
        imageCover: url,
        isActive: form.isActive,
      };
      if (form.summary) payload.summary = form.summary;
      if (form.duration) payload.duration = Number(form.duration);
      if (form.maxGroupSize) payload.maxGroupSize = Number(form.maxGroupSize);
      if (form.difficulty) payload.difficulty = form.difficulty;
      if (form.priceDiscount) payload.priceDiscount = Number(form.priceDiscount);
      if (form.startLocation) payload.startLocation = form.startLocation;

      await window.toursAPI.create(payload, session.accessToken);
      toast.success('Tour created.');
      setForm(INITIAL_STATE);
      resetImage();
      onCreated();
    } catch (err) {
      handleRequestError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="tour-form" onSubmit={handleSubmit}>
      <h2>New Tour</h2>

      <label className="tour-field tour-field-full">
        <span>Title</span>
        <input
          name="title"
          placeholder="e.g. Sunset Kayak Tour"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          required
        />
        {fieldErrors.title && <p className="tour-field-error">{fieldErrors.title}</p>}
      </label>

      <label className="tour-field tour-field-full">
        <span>Description</span>
        <textarea
          name="description"
          placeholder="Describe what makes this tour worth booking..."
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          required
        />
        {fieldErrors.description && <p className="tour-field-error">{fieldErrors.description}</p>}
      </label>

      <label className="tour-field">
        <span>Summary</span>
        <input
          name="summary"
          placeholder="A short one-line summary for listings"
          value={form.summary}
          onChange={(e) => update('summary', e.target.value)}
        />
      </label>

      <label className="tour-field">
        <span>Price</span>
        <input
          name="price"
          type="number"
          placeholder="0.00"
          value={form.price}
          onChange={(e) => update('price', e.target.value)}
          required
        />
        {fieldErrors.price && <p className="tour-field-error">{fieldErrors.price}</p>}
      </label>

      <label className="tour-field">
        <span>Price discount</span>
        <input
          name="priceDiscount"
          type="number"
          placeholder="Optional discounted price"
          value={form.priceDiscount}
          onChange={(e) => update('priceDiscount', e.target.value)}
        />
        {fieldErrors.priceDiscount && <p className="tour-field-error">{fieldErrors.priceDiscount}</p>}
      </label>

      <label className="tour-field">
        <span>Duration (days)</span>
        <input
          name="duration"
          type="number"
          placeholder="e.g. 5"
          value={form.duration}
          onChange={(e) => update('duration', e.target.value)}
        />
        {fieldErrors.duration && <p className="tour-field-error">{fieldErrors.duration}</p>}
      </label>

      <label className="tour-field">
        <span>Max group size</span>
        <input
          name="maxGroupSize"
          type="number"
          placeholder="e.g. 12"
          value={form.maxGroupSize}
          onChange={(e) => update('maxGroupSize', e.target.value)}
        />
        {fieldErrors.maxGroupSize && <p className="tour-field-error">{fieldErrors.maxGroupSize}</p>}
      </label>

      <label className="tour-field">
        <span>Difficulty</span>
        <select
          name="difficulty"
          value={form.difficulty}
          onChange={(e) => update('difficulty', e.target.value as FormState['difficulty'])}
        >
          <option value="">—</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="difficult">Difficult</option>
        </select>
      </label>

      <label className="tour-field tour-field-full">
        <span>Cover image</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageChange} />
        {imagePreviewUrl && <img className="tour-image-preview" src={imagePreviewUrl} alt="Cover preview" />}
        {imageError && <p className="tour-field-error">{imageError}</p>}
      </label>

      <label className="tour-field tour-field-full">
        <span>Start location</span>
        <input
          name="startLocation"
          placeholder="e.g. Bali, Indonesia"
          value={form.startLocation}
          onChange={(e) => update('startLocation', e.target.value)}
        />
      </label>

      <label className="tour-field tour-field-checkbox tour-field-full">
        <input
          name="isActive"
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => update('isActive', e.target.checked)}
        />
        <span>Active</span>
      </label>

      <div className="tour-form-actions">
        <button type="button" className="neumorphic-button" onClick={handleCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="neumorphic-button" disabled={submitting || !imageFile}>
          {submitting ? 'Creating…' : 'Create Tour'}
        </button>
      </div>
    </form>
  );
}
