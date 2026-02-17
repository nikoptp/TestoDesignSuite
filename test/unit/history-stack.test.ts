import { describe, expect, it } from 'vitest';
import { createHistoryStack } from '../../src/renderer/history-stack';

describe('createHistoryStack', () => {
  it('enforces max entries and supports undo/redo traversal', () => {
    const stack = createHistoryStack<string>(2);

    stack.push('A');
    stack.push('B');
    stack.push('C');

    expect(stack.undo('NOW')).toBe('C');
    expect(stack.undo('AFTER-C')).toBe('B');
    expect(stack.undo('AFTER-B')).toBeNull();

    expect(stack.redo('AFTER-UNDO')).toBe('AFTER-C');
    expect(stack.redo('AFTER-REDO')).toBe('NOW');
    expect(stack.redo('AFTER-NOW')).toBeNull();
  });
});
