import React from 'react';

type UseOutsidePointerDismissOptions = {
  enabled?: boolean;
  ignoredSelectors?: string;
  ignoredRefs?: Array<React.RefObject<HTMLElement | null>>;
  onDismiss: (event: PointerEvent) => void;
  shouldDismiss?: (target: Element, event: PointerEvent) => boolean;
  capture?: boolean;
};

export const useOutsidePointerDismiss = ({
  enabled = true,
  ignoredSelectors,
  ignoredRefs,
  onDismiss,
  shouldDismiss,
  capture = true,
}: UseOutsidePointerDismissOptions): void => {
  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (ignoredSelectors && target.closest(ignoredSelectors)) {
        return;
      }

      if (
        ignoredRefs?.some((ref) => {
          const element = ref.current;
          return Boolean(element && element.contains(target));
        })
      ) {
        return;
      }

      if (shouldDismiss && !shouldDismiss(target, event)) {
        return;
      }

      onDismiss(event);
    };

    window.addEventListener('pointerdown', onPointerDown, capture);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, capture);
    };
  }, [capture, enabled, ignoredRefs, ignoredSelectors, onDismiss, shouldDismiss]);
};
