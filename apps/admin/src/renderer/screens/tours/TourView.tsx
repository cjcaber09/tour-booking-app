import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ImageLightbox } from '../../ImageLightbox';
import { Button } from '../../components/ui/button';
import { useAppSettings } from '../../states/appSettingsStore';
import type { TourDetail } from '../../../preload';

interface TourViewProps {
  tour: TourDetail;
  onBack: () => void;
}

export function TourView({ tour, onBack }: TourViewProps) {
  const { formatCurrency } = useAppSettings();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <div className="detail-view">
      <Button className="action-button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back
      </Button>

      <h2 className="panel-title">{tour.title}</h2>

      {tour.imageCover && (
        <img className="h-30 w-40 rounded-xl object-cover neu-raised-md" src={tour.imageCover} alt="Cover" />
      )}

      <div className="detail-grid">
        <div className="detail-field">
          <span className="detail-label">Status</span>
          <span className={`status-badge ${tour.isActive ? 'status-confirmed' : 'status-cancelled'}`}>
            {tour.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="detail-field">
          <span className="detail-label">Price</span>
          <span>{formatCurrency(tour.price)}</span>
        </div>

        {tour.priceDiscount != null && (
          <div className="detail-field">
            <span className="detail-label">Price discount</span>
            <span>{formatCurrency(tour.priceDiscount)}</span>
          </div>
        )}

        {tour.duration != null && (
          <div className="detail-field">
            <span className="detail-label">Duration</span>
            <span>
              {tour.duration} day{tour.duration === 1 ? '' : 's'}
            </span>
          </div>
        )}

        {tour.maxGroupSize != null && (
          <div className="detail-field">
            <span className="detail-label">Max group size</span>
            <span>{tour.maxGroupSize}</span>
          </div>
        )}

        {tour.difficulty && (
          <div className="detail-field">
            <span className="detail-label">Difficulty</span>
            <span>{tour.difficulty}</span>
          </div>
        )}

        {tour.startLocation && (
          <div className="detail-field">
            <span className="detail-label">Start location</span>
            <span>{tour.startLocation}</span>
          </div>
        )}

        {tour.categories.length > 0 && (
          <div className="detail-field col-span-full">
            <span className="detail-label">Categories</span>
            <span>{tour.categories.map((category) => category.name).join(', ')}</span>
          </div>
        )}
      </div>

      {tour.summary && (
        <div className="detail-section">
          <span className="detail-label">Summary</span>
          <p>{tour.summary}</p>
        </div>
      )}

      <div className="detail-section">
        <span className="detail-label">Description</span>
        <p>{tour.description}</p>
      </div>

      {tour.images.length > 0 && (
        <div className="detail-section">
          <span className="detail-label">Gallery</span>
          <div className="mt-2 flex flex-wrap gap-3">
            {tour.images.map((url, i) => (
              <img
                className="block h-20 w-25 cursor-pointer rounded-[10px] object-cover neu-raised-md"
                src={url}
                alt=""
                key={url}
                onClick={() => setLightboxIndex(i)}
              />
            ))}
          </div>
        </div>
      )}

      {lightboxIndex !== null && (
        <ImageLightbox images={tour.images} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  );
}
