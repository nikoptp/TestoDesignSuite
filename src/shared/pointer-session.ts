type PointerSessionOptions = {
  onMove?: (event: PointerEvent) => void;
  onEnd?: (event: PointerEvent) => void;
  capture?: boolean;
  passive?: boolean;
  bodyClassName?: string;
};

export const startWindowPointerSession = ({
  onMove,
  onEnd,
  capture = false,
  passive = false,
  bodyClassName,
}: PointerSessionOptions): (() => void) => {
  if (bodyClassName) {
    document.body.classList.add(bodyClassName);
  }

  const onPointerMove = (event: PointerEvent): void => {
    onMove?.(event);
  };

  const onPointerEnd = (event: PointerEvent): void => {
    onEnd?.(event);
  };

  window.addEventListener('pointermove', onPointerMove, { capture, passive });
  window.addEventListener('pointerup', onPointerEnd, { capture, passive });
  window.addEventListener('pointercancel', onPointerEnd, { capture, passive });

  let cleaned = false;
  return (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    window.removeEventListener('pointermove', onPointerMove, capture);
    window.removeEventListener('pointerup', onPointerEnd, capture);
    window.removeEventListener('pointercancel', onPointerEnd, capture);
    if (bodyClassName) {
      document.body.classList.remove(bodyClassName);
    }
  };
};
