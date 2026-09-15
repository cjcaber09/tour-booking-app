import { useEffect, useRef } from 'react';

// Module-level stack of currently-mounted dialogs, most-recently-opened last. Needed
// because CategoriesDialog nests a ConfirmDialog inside it (its own delete
// confirmation) — both call this hook, both listen on the same `window` target, and
// a browser fires every listener on a target regardless of DOM nesting. Without this,
// Escape while the nested confirmation is open would close both dialogs at once
// instead of just the topmost one.
let stack: symbol[] = [];

// disabled lets a caller suppress Escape while some other guard (e.g. an in-flight
// submit) is already blocking backdrop-click-to-dismiss too, so the two stay consistent.
export function useEscapeToClose(onClose: () => void, disabled = false) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (disabled) {
      return;
    }
    const id = Symbol();
    stack.push(id);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && stack.at(-1) === id) {
        onCloseRef.current();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      stack = stack.filter((entry) => entry !== id);
    };
  }, [disabled]);
}
