import React from 'react';
import type { CategoryNode } from '../shared/types';
import { editorTypeMeta } from '../shared/editor-types';

type EditorPanelProps = {
  selectedNode: CategoryNode | undefined;
};

export const EditorPanel = ({ selectedNode }: EditorPanelProps): React.ReactElement => {
  if (!selectedNode) {
    return (
      <>
        <h2>No node selected</h2>
        <p className="editor-subtitle">Select or create a node to begin.</p>
        <div className="content-placeholder">Choose a node from the structure tree.</div>
      </>
    );
  }

  if (selectedNode.editorType === 'noteboard') {
    return (
      <>
        <h2>{selectedNode.name}</h2>
        <p className="editor-subtitle">
          Editor type: {editorTypeMeta(selectedNode.editorType).label}
        </p>
        <div className="content-placeholder">
          Noteboard React migration is pending. Use legacy mode for full noteboard interactions.
        </div>
      </>
    );
  }

  return (
    <>
      <h2>{selectedNode.name}</h2>
      <p className="editor-subtitle">
        Editor type: {editorTypeMeta(selectedNode.editorType).label}
      </p>
      <div className="content-placeholder">
        This editor type is scaffolded but not implemented yet.
      </div>
    </>
  );
};
