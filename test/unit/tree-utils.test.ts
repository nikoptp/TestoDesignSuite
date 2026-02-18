import { describe, expect, it } from 'vitest';
import type { CategoryNode } from '../../src/shared/types';
import { findNodeById, moveNodeById } from '../../src/shared/tree-utils';

const createTree = (): CategoryNode[] => [
  {
    id: 'node-a',
    name: 'A',
    editorType: 'noteboard',
    children: [],
  },
  {
    id: 'node-b',
    name: 'B',
    editorType: 'noteboard',
    children: [
      {
        id: 'node-b1',
        name: 'B1',
        editorType: 'noteboard',
        children: [],
      },
    ],
  },
  {
    id: 'node-c',
    name: 'C',
    editorType: 'noteboard',
    children: [],
  },
];

describe('moveNodeById', () => {
  it('moves a root node after another root node', () => {
    const tree = createTree();

    const moved = moveNodeById(tree, 'node-a', 'node-c', 'after');

    expect(moved).toBe(true);
    expect(tree.map((node) => node.id)).toEqual(['node-b', 'node-c', 'node-a']);
  });

  it('moves a node to a different parent level based on target location', () => {
    const tree = createTree();

    const moved = moveNodeById(tree, 'node-b1', 'node-c', 'before');

    expect(moved).toBe(true);
    expect(tree.map((node) => node.id)).toEqual(['node-a', 'node-b', 'node-b1', 'node-c']);
    expect(findNodeById(tree, 'node-b')?.children).toEqual([]);
  });

  it('moves a node inside the target node as the last child', () => {
    const tree = createTree();

    const moved = moveNodeById(tree, 'node-a', 'node-b', 'inside');

    expect(moved).toBe(true);
    expect(tree.map((node) => node.id)).toEqual(['node-b', 'node-c']);
    expect(findNodeById(tree, 'node-b')?.children.map((node) => node.id)).toEqual([
      'node-b1',
      'node-a',
    ]);
  });

  it('rejects moving a node relative to its own descendant', () => {
    const tree = createTree();

    const moved = moveNodeById(tree, 'node-b', 'node-b1', 'after');

    expect(moved).toBe(false);
    expect(tree.map((node) => node.id)).toEqual(['node-a', 'node-b', 'node-c']);
    expect(findNodeById(tree, 'node-b')?.children.map((node) => node.id)).toEqual(['node-b1']);
  });

  it('rejects moving a node inside its own descendant', () => {
    const tree = createTree();

    const moved = moveNodeById(tree, 'node-b', 'node-b1', 'inside');

    expect(moved).toBe(false);
    expect(tree.map((node) => node.id)).toEqual(['node-a', 'node-b', 'node-c']);
    expect(findNodeById(tree, 'node-b')?.children.map((node) => node.id)).toEqual(['node-b1']);
  });
});
