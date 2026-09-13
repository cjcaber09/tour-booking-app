import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './lib/utils';
import { Button } from './components/ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, loading, onPageChange }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) {
      return;
    }
    onPageChange(nextPage);
  }

  return (
    <div className="pagination">
      <Button
        className="page-arrow"
        onClick={() => goToPage(page - 1)}
        disabled={loading || page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </Button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
        <Button
          key={n}
          className={cn('page-button', n === page && 'page-button-active')}
          onClick={() => goToPage(n)}
          disabled={loading || n === page}
        >
          {n}
        </Button>
      ))}
      <Button
        className="page-arrow"
        onClick={() => goToPage(page + 1)}
        disabled={loading || page >= totalPages}
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </Button>
    </div>
  );
}
