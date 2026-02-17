import React from 'react';
import type { CategoryNode } from '../shared/types';
import { editorTypeMeta } from '../shared/editor-types';

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
};

type NodeItemProps = NodeTreeProps & {
  node: CategoryNode;
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
}: NodeItemProps): React.ReactElement => {
  const isEditing = viewState.editingNodeId === node.id;
  const meta = editorTypeMeta(node.editorType);
  const hasChildren = node.children.length > 0;
  const isCollapsed = hasChildren && collapsedNodeIds.includes(node.id);

  return (
    <li>
      <div className="tree-row">
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
          <NodeTree
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
          />
        </ul>
      ) : null}
    </li>
  );
};

export const NodeTree = (props: NodeTreeProps): React.ReactElement => {
  const { nodes } = props;

  return (
    <>
      {nodes.map((node) => (
        <NodeItem key={node.id} node={node} {...props} />
      ))}
    </>
  );
};
