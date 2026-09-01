import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { toast } from '../../toast';
import type { CreateTourPayload, TourDetail } from '../../../preload';

interface TourFormProps {
  tour?: TourDetail;
  onCancel: () => void;
  onSaved: () => void;
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

function deriveFormState(tour: TourDetail | undefined): FormState {
  if (!tour) {
    return INITIAL_STATE;
  }
  return {
    title: tour.title,
    description: tour.description,
    price: String(tour.price),
    summary: tour.summary ?? '',
    duration: tour.duration != null ? String(tour.duration) : '',
    maxGroupSize: tour.maxGroupSize != null ? String(tour.maxGroupSize) : '',
    difficulty: tour.difficulty ?? '',
    priceDiscount: tour.priceDiscount != null ? String(tour.priceDiscount) : '',
    startLocation: tour.startLocation ?? '',
    isActive: tour.isActive,
  };
}

interface GalleryImage {
  id: string;
  url?: string;
  file?: File;
  previewUrl?: string;
}

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

export function TourForm({ tour, onCancel, onSaved }: TourFormProps) {
  const isEditing = tour != null;
  const { session } = useAuth();
  const [form, setForm] = useState<FormState>(() => deriveFormState(tour));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'images'>('details');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const [uploadedImage, setUploadedImage] = useState<{ file: File; url: string } | null>(null);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(
    () => (tour?.images ?? []).map((url) => ({ id: url, url })),
  );
  const [galleryError, setGalleryError] = useState('');
  const [isCoverDragActive, setIsCoverDragActive] = useState(false);
  const [isGalleryDragActive, setIsGalleryDragActive] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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

  function processCoverFile(file: File) {
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

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    processCoverFile(file);
  }

  function handleCoverDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsCoverDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }
    processCoverFile(file);
  }

  function handleCoverDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsCoverDragActive(true);
  }

  function handleCoverDragLeave() {
    setIsCoverDragActive(false);
  }

  function processGalleryFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    const accepted: GalleryImage[] = [];
    let error = '';
    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        error = 'Unsupported file type. Use JPEG, PNG, WebP, or GIF.';
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        error = 'One or more images exceed the 5MB limit.';
        continue;
      }
      accepted.push({ id: `local-${crypto.randomUUID()}`, file, previewUrl: URL.createObjectURL(file) });
    }
    setGalleryError(error);
    if (accepted.length > 0) {
      setGalleryImages((prev) => [...prev, ...accepted]);
    }
  }

  function handleGalleryFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    processGalleryFiles(files);
  }

  function handleGalleryDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsGalleryDragActive(false);
    processGalleryFiles(Array.from(event.dataTransfer.files ?? []));
  }

  function handleGalleryDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsGalleryDragActive(true);
  }

  function handleGalleryDragLeave() {
    setIsGalleryDragActive(false);
  }

  function handleRemoveGalleryImage(id: string) {
    setGalleryImages((prev) => {
      const target = prev.find((image) => image.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((image) => image.id !== id);
    });
  }

  function resetGalleryImages() {
    for (const image of galleryImages) {
      if (image.previewUrl) {
        URL.revokeObjectURL(image.previewUrl);
      }
    }
    setGalleryImages([]);
    setGalleryError('');
  }

  function handleCancel() {
    setForm(INITIAL_STATE);
    setFieldErrors({});
    resetImage();
    resetGalleryImages();
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
    if (!session) {
      return;
    }
    setSubmitting(true);
    setFieldErrors({});

    try {
      const payload: CreateTourPayload = {
        title: form.title,
        description: form.description,
        price: Number(form.price),
        isActive: form.isActive,
      };

      if (imageFile) {
        if (uploadedImage && uploadedImage.file === imageFile) {
          // Reference equality is enough: the browser constructs a new File object on every
          // file-input selection, even re-picking the same path, so this only hits on a retry
          // of the same staged pick — not a false match after choosing a different file.
          payload.imageCover = uploadedImage.url;
        } else {
          const base64 = await fileToBase64(imageFile);
          const { url } = await window.toursAPI.uploadImage(
            base64,
            imageFile.name,
            imageFile.type,
            session.accessToken,
          );
          setUploadedImage({ file: imageFile, url });
          payload.imageCover = url;
        }
      }

      if (form.summary) payload.summary = form.summary;
      if (form.duration) payload.duration = Number(form.duration);
      if (form.maxGroupSize) payload.maxGroupSize = Number(form.maxGroupSize);
      if (form.difficulty) payload.difficulty = form.difficulty;
      if (form.priceDiscount) payload.priceDiscount = Number(form.priceDiscount);
      if (form.startLocation) payload.startLocation = form.startLocation;

      const notYetUploaded = galleryImages.filter((image): image is GalleryImage & { file: File } => image.file != null);
      let newlyUploadedUrls: string[] = [];
      if (notYetUploaded.length > 0) {
        const filesPayload = await Promise.all(
          notYetUploaded.map(async (image) => ({
            data: await fileToBase64(image.file),
            filename: image.file.name,
            mimetype: image.file.type,
          })),
        );
        ({ urls: newlyUploadedUrls } = await window.toursAPI.uploadImages(filesPayload, session.accessToken));
      }
      const existingUrls = galleryImages.filter((image) => image.url != null).map((image) => image.url as string);
      payload.images = [...existingUrls, ...newlyUploadedUrls];

      if (isEditing && tour) {
        await window.toursAPI.update(tour.id, payload, session.accessToken);
        toast.success('Tour updated.');
      } else {
        await window.toursAPI.create(payload, session.accessToken);
        toast.success('Tour created.');
      }
      setForm(INITIAL_STATE);
      resetImage();
      resetGalleryImages();
      onSaved();
    } catch (err) {
      handleRequestError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="tour-form" onSubmit={handleSubmit}>
      <h2>{isEditing ? 'Edit Tour' : 'New Tour'}</h2>

      <div className="tour-form-tabs">
        <button
          type="button"
          className={`tour-form-tab ${activeTab === 'details' ? 'tour-form-tab-active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
        <button
          type="button"
          className={`tour-form-tab ${activeTab === 'images' ? 'tour-form-tab-active' : ''}`}
          onClick={() => setActiveTab('images')}
        >
          Images
        </button>
      </div>

      {activeTab === 'details' && (
        <>
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

          <div className="tour-field tour-field-full">
            <span>Cover image</span>
            <div
              className={`tour-image-dropzone ${isCoverDragActive ? 'tour-image-dropzone-active' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => coverInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  coverInputRef.current?.click();
                }
              }}
              onDragOver={handleCoverDragOver}
              onDragLeave={handleCoverDragLeave}
              onDrop={handleCoverDrop}
            >
              <span>Drag & drop an image here, or click to browse</span>
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageChange}
              className="tour-image-input-hidden"
            />
            {imagePreviewUrl && <img className="tour-image-preview" src={imagePreviewUrl} alt="Cover preview" />}
            {imageError && <p className="tour-field-error">{imageError}</p>}
          </div>

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
        </>
      )}

      {activeTab === 'images' && (
        <div className="tour-field tour-field-full">
          <span>Gallery images</span>
          <div
            className={`tour-image-dropzone ${isGalleryDragActive ? 'tour-image-dropzone-active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => galleryInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                galleryInputRef.current?.click();
              }
            }}
            onDragOver={handleGalleryDragOver}
            onDragLeave={handleGalleryDragLeave}
            onDrop={handleGalleryDrop}
          >
            <span>Drag & drop images here, or click to browse</span>
          </div>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleGalleryFilesChange}
            className="tour-image-input-hidden"
          />
          {galleryError && <p className="tour-field-error">{galleryError}</p>}
          {galleryImages.length > 0 && (
            <div className="tour-images-grid">
              {galleryImages.map((image) => (
                <div className="tour-image-thumb-wrapper" key={image.id}>
                  <img className="tour-image-thumb" src={image.url ?? image.previewUrl} alt="" />
                  <button
                    type="button"
                    className="tour-image-remove-button"
                    onClick={() => handleRemoveGalleryImage(image.id)}
                    aria-label="Remove image"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="tour-form-actions">
        <button type="button" className="neumorphic-button" onClick={handleCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="neumorphic-button" disabled={submitting}>
          {submitting ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save Changes' : 'Create Tour'}
        </button>
      </div>
    </form>
  );
}
