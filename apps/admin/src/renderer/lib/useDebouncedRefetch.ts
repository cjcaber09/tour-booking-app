import { useEffect, useRef } from 'react';

// Matches the debounce delay BookingForm's customer search already uses.
const DEBOUNCE_MS = 300;

// Refetches page 1 (debounced) whenever any value in `deps` changes, skipping the
// very first render — the initial page load is already handled by each screen's own
// mount effect, so re-running this on mount too would double-fetch.
export function useDebouncedRefetch(fetchPage: (page: number) => void, deps: unknown[]) {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const handle = setTimeout(() => fetchPage(1), DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // deps is intentionally spread by the caller, not a literal array here — there's
    // no react-hooks lint plugin installed in this project to satisfy either way.
  }, deps);
}
