import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useOutsidePointerDismiss } from '../../src/shared/hooks/use-outside-pointer-dismiss';

const dispatchPointerDown = (target: Element): void => {
  target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
};

describe('useOutsidePointerDismiss', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('dismisses on outside pointerdown', () => {
    const onDismiss = vi.fn();
    const inside = document.createElement('div');
    inside.className = 'inside';
    const outside = document.createElement('div');
    document.body.append(inside, outside);

    renderHook(() =>
      useOutsidePointerDismiss({
        ignoredSelectors: '.inside',
        onDismiss,
      }),
    );

    dispatchPointerDown(outside);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss when target matches ignored selector', () => {
    const onDismiss = vi.fn();
    const ignored = document.createElement('div');
    ignored.className = 'menu';
    document.body.append(ignored);

    renderHook(() =>
      useOutsidePointerDismiss({
        ignoredSelectors: '.menu',
        onDismiss,
      }),
    );

    dispatchPointerDown(ignored);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('does not dismiss when target is inside an ignored ref', () => {
    const onDismiss = vi.fn();
    const host = document.createElement('div');
    const child = document.createElement('button');
    host.appendChild(child);
    const outside = document.createElement('div');
    document.body.append(host, outside);

    renderHook(() =>
      useOutsidePointerDismiss({
        ignoredRefs: [{ current: host }],
        onDismiss,
      }),
    );

    dispatchPointerDown(child);
    dispatchPointerDown(outside);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('respects custom shouldDismiss predicate', () => {
    const onDismiss = vi.fn();
    const target = document.createElement('div');
    document.body.append(target);

    renderHook(() =>
      useOutsidePointerDismiss({
        onDismiss,
        shouldDismiss: () => false,
      }),
    );

    dispatchPointerDown(target);

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
