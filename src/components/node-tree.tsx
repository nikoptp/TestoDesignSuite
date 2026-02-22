import React from 'react';
import type { CategoryNode } from '../shared/types';
import { editorTypeMeta } from '../shared/editor-types';
import { getTreeNodeDragPayload, setTreeNodeDragPayload } from '../shared/drag-payloads';

export type NodeDropPosition = 'before' | 'after' | 'inside';

export type NodeTreeViewState = {
  selectedNodeId: string | null;
  editingNodeId: string | null;
  editingNameDraft: string;
};

type NodeTreeProps = {
  nodes: CategoryNode[];
  viewState: NodeTreeViewState;
  collapsedNodeIds: string[];
  onSelectNode: (nodeId: string) => void;
  onBeginRename: (nodeId: string) => void;
  onRenameDraftChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onToggleNodeCollapsed: (nodeId: string) => void;
  onAddChildNode: (nodeId: string) => void;
  onRequestDeleteNode: (nodeId: string) => void;
  onMoveNode: (sourceId: string, targetId: string, position: NodeDropPosition) => void;
};

type NodeDropHint = {
  targetNodeId: string;
  position: NodeDropPosition;
};

type NodeItemProps = NodeTreeProps & {
  node: CategoryNode;
  draggedNodeId: string | null;
  dropHint: NodeDropHint | null;
  onDragStartNode: (event: React.DragEvent, nodeId: string) => void;
  onDragEndNode: () => void;
  onDragOverNode: (event: React.DragEvent<HTMLDivElement>, nodeId: string) => void;
  onDragLeaveNode: (event: React.DragEvent<HTMLDivElement>, nodeId: string) => void;
  onDropNode: (event: React.DragEvent<HTMLDivElement>, nodeId: string) => void;
};

type NodeTreeBranchProps = NodeTreeProps & {
  draggedNodeId: string | null;
  dropHint: NodeDropHint | null;
  onDragStartNode: (event: React.DragEvent, nodeId: string) => void;
  onDragEndNode: () => void;
  onDragOverNode: (event: React.DragEvent<HTMLDivElement>, nodeId: string) => void;
  onDragLeaveNode: (event: React.DragEvent<HTMLDivElement>, nodeId: string) => void;
  onDropNode: (event: React.DragEvent<HTMLDivElement>, nodeId: string) => void;
};

const NodeItem = ({
  node,
  viewState,
  onSelectNode,
  onBeginRename,
  onRenameDraftChange,
  onRenameCommit,
  onRenameCancel,
  collapsedNodeIds,
  onToggleNodeCollapsed,
  onAddChildNode,
  onRequestDeleteNode,
  onMoveNode,
  draggedNodeId,
  dropHint,
  onDragStartNode,
  onDragEndNode,
  onDragOverNode,
  onDragLeaveNode,
  onDropNode,
}: NodeItemProps): React.ReactElement => {
  const isEditing = viewState.editingNodeId === node.id;
  const meta = editorTypeMeta(node.editorType);
  const hasChildren = node.children.length > 0;
  const isCollapsed = hasChildren && collapsedNodeIds.includes(node.id);
  const isDragged = draggedNodeId === node.id;
  const isDropBefore = dropHint?.targetNodeId === node.id && dropHint.position === 'before';
  const isDropAfter = dropHint?.targetNodeId === node.id && dropHint.position === 'after';
  const isDropInside = dropHint?.targetNodeId === node.id && dropHint.position === 'inside';

  return (
    <li>
      <div
        className={`tree-row ${isDragged ? 'dragging' : ''} ${isDropBefore ? 'drop-before' : ''} ${isDropAfter ? 'drop-after' : ''} ${isDropInside ? 'drop-inside' : ''}`}
        onDragOver={(event) => onDragOverNode(event, node.id)}
        onDragLeave={(event) => onDragLeaveNode(event, node.id)}
        onDrop={(event) => onDropNode(event, node.id)}
      >
        <button
          className={`icon-action secondary collapse-toggle ${!hasChildren ? 'invisible' : ''}`}
          title={isCollapsed ? 'Expand node' : 'Collapse node'}
          aria-label={isCollapsed ? 'Expand node' : 'Collapse node'}
          onClick={() => onToggleNodeCollapsed(node.id)}
          disabled={!hasChildren}
        >
          <i className={`fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'}`}></i>
        </button>
        {isEditing ? (
          <div className="tree-item editing">
            <span className="node-category-icon" title={meta.label} aria-label={meta.label}>
              <i className={meta.iconClass}></i>
            </span>
            <input
              className="rename-input"
              value={viewState.editingNameDraft}
              onChange={(event) => onRenameDraftChange(event.target.value)}
              onBlur={onRenameCommit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onRenameCommit();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  onRenameCancel();
                }
              }}
              autoFocus
            />
          </div>
        ) : (
          <button
            className={`tree-item ${node.id === viewState.selectedNodeId ? 'active' : ''}`}
            title={meta.label}
            onClick={() => onSelectNode(node.id)}
            onDoubleClick={() => onBeginRename(node.id)}
            draggable={viewState.editingNodeId === null}
            onDragStart={(event) => onDragStartNode(event, node.id)}
            onDragEnd={onDragEndNode}
          >
            <span className="node-category-icon" aria-label={meta.label}>
              <i className={meta.iconClass}></i>
            </span>
            <span className="node-name">{node.name}</span>
          </button>
        )}
        <div className="node-actions">
          <button
            className="icon-action"
            title="Add child node"
            aria-label="Add child node"
            onClick={() => onAddChildNode(node.id)}
          >
            <i className="fa-solid fa-plus"></i>
          </button>
          <button
            className="icon-action danger"
            title="Delete node"
            aria-label="Delete node"
            onClick={() => onRequestDeleteNode(node.id)}
          >
            <i className="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>

      {hasChildren && !isCollapsed ? (
        <ul className="tree-list nested">
          <NodeTreeBranch
            nodes={node.children}
            viewState={viewState}
            collapsedNodeIds={collapsedNodeIds}
            onSelectNode={onSelectNode}
            onBeginRename={onBeginRename}
            onRenameDraftChange={onRenameDraftChange}
            onRenameCommit={onRenameCommit}
            onRenameCancel={onRenameCancel}
            onToggleNodeCollapsed={onToggleNodeCollapsed}
            onAddChildNode={onAddChildNode}
            onRequestDeleteNode={onRequestDeleteNode}
            onMoveNode={onMoveNode}
            draggedNodeId={draggedNodeId}
            dropHint={dropHint}
            onDragStartNode={onDragStartNode}
            onDragEndNode={onDragEndNode}
            onDragOverNode={onDragOverNode}
            onDragLeaveNode={onDragLeaveNode}
            onDropNode={onDropNode}
          />
        </ul>
      ) : null}
    </li>
  );
};

const NodeTreeBranch = (props: NodeTreeBranchProps): React.ReactElement => {
  const { nodes } = props;

  return (
    <>
      {nodes.map((node) => (
        <NodeItem key={node.id} node={node} {...props} />
      ))}
    </>
  );
};

export const NodeTree = (props: NodeTreeProps): React.ReactElement => {
  const [draggedNodeId, setDraggedNodeId] = React.useState<string | null>(null);
  const [dropHint, setDropHint] = React.useState<NodeDropHint | null>(null);

  const clearDragState = React.useCallback(() => {
    setDraggedNodeId(null);
    setDropHint(null);
  }, []);

  const onDragStartNode = React.useCallback((event: React.DragEvent, nodeId: string) => {
    if (props.viewState.editingNodeId) {
      event.preventDefault();
      return;
    }

    setDraggedNodeId(nodeId);
    setTreeNodeDragPayload(event.dataTransfer, nodeId);
  }, [props.viewState.editingNodeId]);

  const onDragEndNode = React.useCallback(() => {
    clearDragState();
  }, [clearDragState]);

  const onDragOverNode = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>, nodeId: string) => {
      if (props.viewState.editingNodeId) {
        return;
      }

      const draggedId = draggedNodeId ?? getTreeNodeDragPayload(event.dataTransfer);
      if (!draggedId || draggedId === nodeId) {
        if (dropHint) {
          setDropHint(null);
        }
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      const rect = event.currentTarget.getBoundingClientRect();
      const topThreshold = rect.top + rect.height * 0.28;
      const bottomThreshold = rect.bottom - rect.height * 0.28;
      const position: NodeDropPosition =
        event.clientY < topThreshold
          ? 'before'
          : event.clientY > bottomThreshold
            ? 'after'
            : 'inside';
      setDropHint((prev) =>
        prev && prev.targetNodeId === nodeId && prev.position === position
          ? prev
          : { targetNodeId: nodeId, position },
      );
    },
    [draggedNodeId, dropHint, props.viewState.editingNodeId],
  );

  const onDragLeaveNode = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>, nodeId: string) => {
      if (dropHint?.targetNodeId !== nodeId) {
        return;
      }

      const relatedTarget = event.relatedTarget;
      if (relatedTarget instanceof Element && event.currentTarget.contains(relatedTarget)) {
        return;
      }
      setDropHint(null);
    },
    [dropHint],
  );

  const onDropNode = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>, nodeId: string) => {
      event.preventDefault();
      if (props.viewState.editingNodeId) {
        clearDragState();
        return;
      }

      const draggedId = draggedNodeId ?? getTreeNodeDragPayload(event.dataTransfer);
      const nextDropHint = dropHint;
      clearDragState();

      if (!draggedId || !nextDropHint || nextDropHint.targetNodeId !== nodeId) {
        return;
      }

      props.onMoveNode(draggedId, nodeId, nextDropHint.position);
    },
    [clearDragState, draggedNodeId, dropHint, props],
  );

  return (
    <NodeTreeBranch
      {...props}
      draggedNodeId={draggedNodeId}
      dropHint={dropHint}
      onDragStartNode={onDragStartNode}
      onDragEndNode={onDragEndNode}
      onDragOverNode={onDragOverNode}
      onDragLeaveNode={onDragLeaveNode}
      onDropNode={onDropNode}
    />
  );
};
