import { ChangeEvent, DragEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { X, LoaderCircle } from 'lucide-react';
import { useAuth } from '../../states/authStore';
import { toast } from '../../toast';
import { useRequestError } from '../../lib/useRequestError';
import { cn, trimStrings } from '../../lib/utils';
import { fileToBase64 } from '../../lib/file';
import { Button } from '../../components/ui/button';
import { CategoryPicker } from './CategoryPicker';
import type { CreateTourPayload, TourDetail, CategorySummary } from '../../../preload';

const DROPZONE_CLASS =
  'flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted transition-colors duration-150 ease-in-out hover:border-muted';
const DROPZONE_ACTIVE_CLASS = 'border-accent-end text-heading';

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

export function TourForm({ tour, onCancel, onSaved }: TourFormProps) {
  const isEditing = tour != null;
  const { session } = useAuth();
  const [form, setForm] = useState<FormState>(() => deriveFormState(tour));
  const { fieldErrors, setFieldErrors, handleRequestError } = useRequestError();
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

  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    () => tour?.categories.map((category) => category.id) ?? [],
  );

  useEffect(() => {
    if (!session) {
      return;
    }
    window.categoriesAPI
      .list(1, 100, session.accessToken)
      .then((result) => setCategories(result.categories))
      .catch(() => toast.error('Could not load categories.'));
  }, [session]);

  async function handleCreateCategory(name: string): Promise<CategorySummary | null> {
    if (!session) {
      return null;
    }
    try {
      const created = await window.categoriesAPI.create({ name }, session.accessToken);
      setCategories((prev) => [...prev, created]);
      return created;
    } catch {
      toast.error('Could not create category.');
      return null;
    }
  }

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
    setSelectedCategoryIds([]);
    onCancel();
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
        categoryIds: selectedCategoryIds,
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

      const sanitizedPayload = trimStrings(payload);
      if (isEditing && tour) {
        await window.toursAPI.update(tour.id, sanitizedPayload, session.accessToken);
        toast.success('Tour updated.');
      } else {
        await window.toursAPI.create(sanitizedPayload, session.accessToken);
        toast.success('Tour created.');
      }
      setForm(INITIAL_STATE);
      resetImage();
      resetGalleryImages();
      setSelectedCategoryIds([]);
      onSaved();
    } catch (err) {
      handleRequestError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <h2 className="panel-title">{isEditing ? 'Edit Tour' : 'New Tour'}</h2>

      <div className="col-span-full mb-2 flex gap-2 border-b border-border">
        <button
          type="button"
          className={cn('tab-button', activeTab === 'details' && 'tab-button-active')}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
        <button
          type="button"
          className={cn('tab-button', activeTab === 'images' && 'tab-button-active')}
          onClick={() => setActiveTab('images')}
        >
          Images
        </button>
      </div>

      {activeTab === 'details' && (
        <>
          <label className="form-field col-span-full">
            <span>Title</span>
            <input
              className="neu-field"
              name="title"
              placeholder="e.g. Sunset Kayak Tour"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              required
            />
            {fieldErrors.title && <p className="form-field-error">{fieldErrors.title}</p>}
          </label>

          <label className="form-field col-span-full">
            <span>Description</span>
            <textarea
              className="neu-field min-h-20 resize-y"
              name="description"
              placeholder="Describe what makes this tour worth booking..."
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              required
            />
            {fieldErrors.description && <p className="form-field-error">{fieldErrors.description}</p>}
          </label>

          <label className="form-field">
            <span>Summary</span>
            <input
              className="neu-field"
              name="summary"
              placeholder="A short one-line summary for listings"
              value={form.summary}
              onChange={(e) => update('summary', e.target.value)}
            />
          </label>

          <label className="form-field">
            <span>Price</span>
            <input
              className="neu-field"
              name="price"
              type="number"
              placeholder="0.00"
              value={form.price}
              onChange={(e) => update('price', e.target.value)}
              required
            />
            {fieldErrors.price && <p className="form-field-error">{fieldErrors.price}</p>}
          </label>

          <label className="form-field">
            <span>Price discount</span>
            <input
              className="neu-field"
              name="priceDiscount"
              type="number"
              placeholder="Optional discounted price"
              value={form.priceDiscount}
              onChange={(e) => update('priceDiscount', e.target.value)}
            />
            {fieldErrors.priceDiscount && <p className="form-field-error">{fieldErrors.priceDiscount}</p>}
          </label>

          <label className="form-field">
            <span>Duration (days)</span>
            <input
              className="neu-field"
              name="duration"
              type="number"
              placeholder="e.g. 5"
              value={form.duration}
              onChange={(e) => update('duration', e.target.value)}
            />
            {fieldErrors.duration && <p className="form-field-error">{fieldErrors.duration}</p>}
          </label>

          <label className="form-field">
            <span>Max group size</span>
            <input
              className="neu-field"
              name="maxGroupSize"
              type="number"
              placeholder="e.g. 12"
              value={form.maxGroupSize}
              onChange={(e) => update('maxGroupSize', e.target.value)}
            />
            {fieldErrors.maxGroupSize && <p className="form-field-error">{fieldErrors.maxGroupSize}</p>}
          </label>

          <label className="form-field">
            <span>Difficulty</span>
            <select
              className="neu-field"
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

          <div className="form-field col-span-full">
            <span>Cover image</span>
            <div
              className={cn(DROPZONE_CLASS, isCoverDragActive && DROPZONE_ACTIVE_CLASS)}
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
              className="hidden"
            />
            {imagePreviewUrl && (
              <img
                className="h-30 w-40 rounded-xl object-cover neu-raised-md"
                src={imagePreviewUrl}
                alt="Cover preview"
              />
            )}
            {imageError && <p className="form-field-error">{imageError}</p>}
          </div>

          <label className="form-field col-span-full">
            <span>Start location</span>
            <input
              className="neu-field"
              name="startLocation"
              placeholder="e.g. Bali, Indonesia"
              value={form.startLocation}
              onChange={(e) => update('startLocation', e.target.value)}
            />
          </label>

          <div className="form-field col-span-full">
            <span>Categories</span>
            <CategoryPicker
              categories={categories}
              selectedIds={selectedCategoryIds}
              onChange={setSelectedCategoryIds}
              onCreateCategory={handleCreateCategory}
              disabled={submitting}
            />
          </div>

          <label className="form-field col-span-full flex-row items-center gap-2">
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
        <div className="form-field col-span-full">
          <span>Gallery images</span>
          <div
            className={cn(DROPZONE_CLASS, isGalleryDragActive && DROPZONE_ACTIVE_CLASS)}
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
            className="hidden"
          />
          {galleryError && <p className="form-field-error">{galleryError}</p>}
          {galleryImages.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-3">
              {galleryImages.map((image) => (
                <div className="relative h-20 w-25" key={image.id}>
                  <img
                    className="block h-20 w-25 rounded-[10px] object-cover neu-raised-md"
                    src={image.url ?? image.previewUrl}
                    alt=""
                  />
                  <button
                    type="button"
                    className="absolute -right-1.5 -top-1.5 flex h-5.5 w-5.5 items-center justify-center rounded-full border-none bg-surface p-0 text-sm leading-none text-error neu-raised-xs active:neu-inset-sm"
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

      <div className="form-actions">
        <Button type="button" onClick={handleCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <LoaderCircle className="animate-[spin_0.8s_linear_infinite]" size={14} />}
          {submitting ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save Changes' : 'Create Tour'}
        </Button>
      </div>
    </form>
  );
}
