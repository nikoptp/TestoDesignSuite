import type { CategoryNode, NodeWorkspaceData, PersistedTreeState } from '../shared/types';
import { isValidEditorType } from '../shared/editor-types';

const isNode = (value: unknown): value is CategoryNode => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as {
    id?: unknown;
    name?: unknown;
    editorType?: unknown;
    children?: unknown;
  };

  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    isValidEditorType(obj.editorType) &&
    Array.isArray(obj.children) &&
    obj.children.every((child) => isNode(child))
  );
};

const isKanbanCard = (card: unknown): boolean => {
  if (typeof card !== 'object' || card === null) {
    return false;
  }
  const item = card as {
    id?: unknown;
    title?: unknown;
    markdown?: unknown;
    taskNumber?: unknown;
    priority?: unknown;
    columnId?: unknown;
    collaboration?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
  };
  const collaboration = item.collaboration;
  const watcherIds = (collaboration as { watcherIds?: unknown } | undefined)?.watcherIds;
  const collaborationValid =
    typeof collaboration === 'undefined' ||
    (typeof collaboration === 'object' &&
      collaboration !== null &&
      !Array.isArray(collaboration) &&
      ((collaboration as { assigneeId?: unknown }).assigneeId === undefined ||
        typeof (collaboration as { assigneeId?: unknown }).assigneeId === 'string' ||
        (collaboration as { assigneeId?: unknown }).assigneeId === null) &&
      ((collaboration as { createdById?: unknown }).createdById === undefined ||
        typeof (collaboration as { createdById?: unknown }).createdById === 'string' ||
        (collaboration as { createdById?: unknown }).createdById === null) &&
      (watcherIds === undefined ||
        (Array.isArray(watcherIds) && watcherIds.every((value) => typeof value === 'string'))));

  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.markdown === 'string' &&
    typeof item.taskNumber === 'number' &&
    Number.isInteger(item.taskNumber) &&
    item.taskNumber >= 1 &&
    (item.priority === 'none' ||
      item.priority === 'low' ||
      item.priority === 'medium' ||
      item.priority === 'high') &&
    typeof item.columnId === 'string' &&
    collaborationValid &&
    typeof item.createdAt === 'number' &&
    typeof item.updatedAt === 'number'
  );
};

const isNodeWorkspaceData = (value: unknown): value is NodeWorkspaceData => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as {
    noteboard?: unknown;
    document?: unknown;
    kanban?: unknown;
  };

  if (typeof obj.noteboard !== 'undefined') {
    if (typeof obj.noteboard !== 'object' || obj.noteboard === null) {
      return false;
    }

    const noteboard = obj.noteboard as { cards?: unknown };
    if (!Array.isArray(noteboard.cards)) {
      return false;
    }

    const view = (obj.noteboard as { view?: unknown }).view;
    if (typeof view !== 'undefined') {
      if (typeof view !== 'object' || view === null) {
        return false;
      }

      const viewObj = view as {
        zoom?: unknown;
        offsetX?: unknown;
        offsetY?: unknown;
      };

      if (
        typeof viewObj.zoom !== 'number' ||
        typeof viewObj.offsetX !== 'number' ||
        typeof viewObj.offsetY !== 'number'
      ) {
        return false;
      }
    }

    const cardsValid = noteboard.cards.every((card) => {
      if (typeof card !== 'object' || card === null) {
        return false;
      }

      const item = card as {
        id?: unknown;
        text?: unknown;
        createdAt?: unknown;
        x?: unknown;
        y?: unknown;
      };

      return (
        typeof item.id === 'string' &&
        typeof item.text === 'string' &&
        typeof item.createdAt === 'number' &&
        (typeof item.x === 'undefined' || typeof item.x === 'number') &&
        (typeof item.y === 'undefined' || typeof item.y === 'number')
      );
    });

    if (!cardsValid) {
      return false;
    }
  }

  if (typeof obj.document !== 'undefined') {
    if (typeof obj.document !== 'object' || obj.document === null) {
      return false;
    }
    const doc = obj.document as { markdown?: unknown };
    if (typeof doc.markdown !== 'string') {
      return false;
    }
  }

  if (typeof obj.kanban !== 'undefined') {
    if (typeof obj.kanban !== 'object' || obj.kanban === null) {
      return false;
    }
    const kanban = obj.kanban as {
      columns?: unknown;
      cards?: unknown;
      nextTaskNumber?: unknown;
      collapsedColumnIds?: unknown;
    };
    if (
      !Array.isArray(kanban.columns) ||
      !Array.isArray(kanban.cards) ||
      typeof kanban.nextTaskNumber !== 'number' ||
      !Number.isInteger(kanban.nextTaskNumber) ||
      kanban.nextTaskNumber < 1
    ) {
      return false;
    }

    const columnsValid = kanban.columns.every((column) => {
      if (typeof column !== 'object' || column === null) {
        return false;
      }
      const item = column as {
        id?: unknown;
        name?: unknown;
        color?: unknown;
      };
      return (
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.color === 'string'
      );
    });
    if (!columnsValid) {
      return false;
    }

    if (!kanban.cards.every((card) => isKanbanCard(card))) {
      return false;
    }

    if (
      typeof kanban.collapsedColumnIds !== 'undefined' &&
      (!Array.isArray(kanban.collapsedColumnIds) ||
        !kanban.collapsedColumnIds.every((id) => typeof id === 'string'))
    ) {
      return false;
    }
  }

  return true;
};

export const isPersistedTreeState = (value: unknown): value is PersistedTreeState => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as {
    nodes?: unknown;
    selectedNodeId?: unknown;
    nextNodeNumber?: unknown;
    nodeDataById?: unknown;
    sharedKanbanBacklogCards?: unknown;
    sidebarWidth?: unknown;
    collapsedNodeIds?: unknown;
  };

  const nodeDataValid =
    typeof obj.nodeDataById === 'undefined' ||
    (typeof obj.nodeDataById === 'object' &&
      obj.nodeDataById !== null &&
      Object.values(obj.nodeDataById as Record<string, unknown>).every((entry) =>
        isNodeWorkspaceData(entry),
      ));
  const sidebarWidthValid =
    typeof obj.sidebarWidth === 'undefined' ||
    (typeof obj.sidebarWidth === 'number' &&
      Number.isFinite(obj.sidebarWidth) &&
      obj.sidebarWidth >= 120 &&
      obj.sidebarWidth <= 920);
  const collapsedNodeIdsValid =
    typeof obj.collapsedNodeIds === 'undefined' ||
    (Array.isArray(obj.collapsedNodeIds) &&
      obj.collapsedNodeIds.every((id) => typeof id === 'string'));
  const sharedKanbanBacklogCardsValid =
    typeof obj.sharedKanbanBacklogCards === 'undefined' ||
    (Array.isArray(obj.sharedKanbanBacklogCards) &&
      obj.sharedKanbanBacklogCards.every((card) => isKanbanCard(card)));

  return (
    Array.isArray(obj.nodes) &&
    obj.nodes.every((node) => isNode(node)) &&
    (typeof obj.selectedNodeId === 'string' || obj.selectedNodeId === null) &&
    typeof obj.nextNodeNumber === 'number' &&
    Number.isInteger(obj.nextNodeNumber) &&
    obj.nextNodeNumber >= 1 &&
    nodeDataValid &&
    sharedKanbanBacklogCardsValid &&
    sidebarWidthValid &&
    collapsedNodeIdsValid
  );
};
