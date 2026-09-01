import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import './ImageLightbox.css';

interface ImageLightboxProps {
  images: string[];
  startIndex: number;
  onClose: () => void;
}

export function ImageLightbox({ images, startIndex, onClose }: ImageLightboxProps) {
  const [index, setIndex] = useState(startIndex);

  function showPrev() {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }

  function showNext() {
    setIndex((i) => (i + 1) % images.length);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        showPrev();
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        showNext();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length, onClose]);

  return (
    <div className="image-lightbox-backdrop" onClick={onClose}>
      <button type="button" className="image-lightbox-close-button" onClick={onClose} aria-label="Close">
        <X size={24} />
      </button>

      {images.length > 1 && (
        <button
          type="button"
          className="image-lightbox-nav-button image-lightbox-nav-prev"
          onClick={(e) => {
            e.stopPropagation();
            showPrev();
          }}
          aria-label="Previous image"
        >
          <ChevronLeft size={32} />
        </button>
      )}

      <img className="image-lightbox-image" src={images[index]} alt="" onClick={(e) => e.stopPropagation()} />

      {images.length > 1 && (
        <button
          type="button"
          className="image-lightbox-nav-button image-lightbox-nav-next"
          onClick={(e) => {
            e.stopPropagation();
            showNext();
          }}
          aria-label="Next image"
        >
          <ChevronRight size={32} />
        </button>
      )}
    </div>
  );
}
