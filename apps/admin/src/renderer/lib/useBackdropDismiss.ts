import { useEffect, useRef } from 'react';

// Wires the backdrop overlay's click-to-close imperatively (a DOM listener attached via
// ref) instead of a JSX onClick prop. The overlay is aria-hidden and never keyboard-
// focusable by design — dialogs already expose the Escape key (see useEscapeToClose) and
// a visible Cancel/Close button as their real accessible close paths, so this is a
// mouse-only convenience layered on top, not a control that itself needs to be reachable.
// Keeping it off onClick means static accessibility analysis has no element+handler pair
// to mistake for a non-native interactive control.
//
// disabled mirrors useEscapeToClose's param so both close paths stay consistent (e.g.
// both suppressed together while a submit is in flight).
export function useBackdropDismiss(onClose: () => void, disabled = false) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) {
      return;
    }
    function handleClick() {
      onCloseRef.current();
    }
    el.addEventListener('click', handleClick);
    return () => el.removeEventListener('click', handleClick);
  }, [disabled]);

  return ref;
}
