import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ImageLightbox } from '../../ImageLightbox';
import type { TourDetail } from '../../../preload';

interface TourViewProps {
  tour: TourDetail;
  onBack: () => void;
}

export function TourView({ tour, onBack }: TourViewProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <div className="tour-view">
      <button type="button" className="neumorphic-button tour-view-back-button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back
      </button>

      <h2>{tour.title}</h2>

      {tour.imageCover && <img className="tour-image-preview" src={tour.imageCover} alt="Cover" />}

      <div className="tour-view-details">
        <div className="tour-view-field">
          <span className="tour-view-label">Status</span>
          <span className={`status-badge ${tour.isActive ? 'status-confirmed' : 'status-cancelled'}`}>
            {tour.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="tour-view-field">
          <span className="tour-view-label">Price</span>
          <span>${Number(tour.price).toFixed(2)}</span>
        </div>

        {tour.priceDiscount != null && (
          <div className="tour-view-field">
            <span className="tour-view-label">Price discount</span>
            <span>${Number(tour.priceDiscount).toFixed(2)}</span>
          </div>
        )}

        {tour.duration != null && (
          <div className="tour-view-field">
            <span className="tour-view-label">Duration</span>
            <span>
              {tour.duration} day{tour.duration === 1 ? '' : 's'}
            </span>
          </div>
        )}

        {tour.maxGroupSize != null && (
          <div className="tour-view-field">
            <span className="tour-view-label">Max group size</span>
            <span>{tour.maxGroupSize}</span>
          </div>
        )}

        {tour.difficulty && (
          <div className="tour-view-field">
            <span className="tour-view-label">Difficulty</span>
            <span>{tour.difficulty}</span>
          </div>
        )}

        {tour.startLocation && (
          <div className="tour-view-field">
            <span className="tour-view-label">Start location</span>
            <span>{tour.startLocation}</span>
          </div>
        )}

        {tour.categories.length > 0 && (
          <div className="tour-view-field tour-view-field-full">
            <span className="tour-view-label">Categories</span>
            <span>{tour.categories.map((category) => category.name).join(', ')}</span>
          </div>
        )}
      </div>

      {tour.summary && (
        <div className="tour-view-section">
          <span className="tour-view-label">Summary</span>
          <p>{tour.summary}</p>
        </div>
      )}

      <div className="tour-view-section">
        <span className="tour-view-label">Description</span>
        <p>{tour.description}</p>
      </div>

      {tour.images.length > 0 && (
        <div className="tour-view-section">
          <span className="tour-view-label">Gallery</span>
          <div className="tour-images-grid">
            {tour.images.map((url, i) => (
              <img
                className="tour-image-thumb tour-image-thumb-clickable"
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
