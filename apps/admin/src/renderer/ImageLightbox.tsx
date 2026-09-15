import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from './lib/utils';
import { Button } from './components/ui/button';

const NAV_BUTTON_CLASS =
  'absolute rounded-full bg-white/10 p-0 text-white transition-colors duration-150 ease-in-out hover:bg-white/20';

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
    <div className="fixed inset-0 z-[950] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/85" aria-hidden="true" onClick={onClose} />
      <Button
        variant="ghost"
        className={cn(NAV_BUTTON_CLASS, 'right-6 top-6 h-11 w-11')}
        onClick={onClose}
        aria-label="Close"
      >
        <X size={24} />
      </Button>

      {images.length > 1 && (
        <Button
          variant="ghost"
          className={cn(NAV_BUTTON_CLASS, 'left-6 top-1/2 h-14 w-14 -translate-y-1/2')}
          onClick={showPrev}
          aria-label="Previous image"
        >
          <ChevronLeft size={32} />
        </Button>
      )}

      <img className="relative max-h-[85vh] max-w-[90vw] rounded-lg object-contain" src={images[index]} alt="" />

      {images.length > 1 && (
        <Button
          variant="ghost"
          className={cn(NAV_BUTTON_CLASS, 'right-6 top-1/2 h-14 w-14 -translate-y-1/2')}
          onClick={showNext}
          aria-label="Next image"
        >
          <ChevronRight size={32} />
        </Button>
      )}
    </div>
  );
}
