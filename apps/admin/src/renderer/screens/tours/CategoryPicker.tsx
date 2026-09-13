import { KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '../../components/ui/popover';
import type { CategorySummary } from '../../../preload';

interface CategoryPickerProps {
  categories: CategorySummary[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreateCategory: (name: string) => Promise<CategorySummary | null>;
  disabled?: boolean;
}

export function CategoryPicker({
  categories,
  selectedIds,
  onChange,
  onCreateCategory,
  disabled,
}: CategoryPickerProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // The dropdown deliberately stays open after picking a category (so a user can add
  // several in a row without reopening it), but TourForm keeps this component mounted
  // — just slid off-screen — after a save rather than unmounting it. If the dropdown
  // was still open at submit time, its portaled content would otherwise keep floating
  // over whatever's behind the now-hidden form. Closing it as soon as the form starts
  // saving (disabled flips true) guarantees it's never left open behind a closed panel.
  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
    }
  }, [disabled]);

  const selected = useMemo(
    () => categories.filter((category) => selectedIds.includes(category.id)),
    [categories, selectedIds],
  );

  const queryLower = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      categories.filter(
        (category) =>
          !selectedIds.includes(category.id) && category.name.toLowerCase().includes(queryLower),
      ),
    [categories, selectedIds, queryLower],
  );
  const hasExactMatch = categories.some((category) => category.name.toLowerCase() === queryLower);
  const showCreateOption = queryLower.length > 0 && !hasExactMatch;
  // Nothing to pick and nothing to create — hide the dropdown entirely rather than
  // opening it just to show an empty "No matching categories." message.
  const hasResults = matches.length > 0 || showCreateOption;

  function selectCategory(category: CategorySummary) {
    onChange([...selectedIds, category.id]);
    setQuery('');
  }

  function removeCategory(id: string) {
    onChange(selectedIds.filter((existing) => existing !== id));
  }

  async function createCategory() {
    const name = query.trim();
    if (!name || creating) {
      return;
    }
    setCreating(true);
    try {
      const created = await onCreateCategory(name);
      if (created) {
        onChange([...selectedIds, created.id]);
        setQuery('');
      }
    } finally {
      setCreating(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && query === '' && selected.length > 0) {
      removeCategory(selected[selected.length - 1].id);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (matches.length > 0) {
        selectCategory(matches[0]);
      } else if (showCreateOption) {
        void createCategory();
      }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((category) => (
            <span
              key={category.id}
              className="flex items-center gap-1.5 rounded-lg bg-surface py-1 pl-3 pr-1.5 text-sm text-heading neu-inset-sm"
            >
              {category.name}
              <button
                type="button"
                className="flex h-4.5 w-4.5 items-center justify-center rounded-full border-none bg-transparent p-0 text-muted hover:text-error"
                onClick={() => removeCategory(category.id)}
                disabled={disabled}
                aria-label={`Remove ${category.name}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <Popover open={isOpen && hasResults} onOpenChange={setIsOpen}>
        <PopoverAnchor asChild>
          <input
            className="neu-field"
            type="text"
            placeholder="Search or create a category…"
            value={query}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
          />
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="max-h-60 w-[var(--radix-popper-anchor-width)] overflow-y-auto p-2"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex flex-col gap-1">
            {matches.map((category) => (
              <Button
                key={category.id}
                variant="ghost"
                size="sm"
                className="w-full justify-start rounded-lg px-2.5 py-2 text-left text-[0.8125rem] font-normal text-heading"
                onClick={() => selectCategory(category)}
              >
                {category.name}
              </Button>
            ))}
            {showCreateOption && (
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'w-full justify-start rounded-lg px-2.5 py-2 text-left text-[0.8125rem] font-normal text-heading',
                  creating && 'opacity-60',
                )}
                disabled={creating}
                onClick={() => void createCategory()}
              >
                Create "{query.trim()}"
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
