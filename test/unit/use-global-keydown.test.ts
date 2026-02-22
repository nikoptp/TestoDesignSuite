import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGlobalKeydown } from '../../src/shared/hooks/use-global-keydown';

describe('useGlobalKeydown', () => {
  it('registers keydown handler while enabled', () => {
    const onKeyDown = vi.fn();
    renderHook(() => useGlobalKeydown({ onKeyDown }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('does not register handler when disabled', () => {
    const onKeyDown = vi.fn();
    renderHook(() => useGlobalKeydown({ enabled: false, onKeyDown }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it('uses latest callback after rerender', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ handler }) =>
        useGlobalKeydown({
          onKeyDown: handler,
        }),
      { initialProps: { handler: first } },
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    rerender({ handler: second });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
