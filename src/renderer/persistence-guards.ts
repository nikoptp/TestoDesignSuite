import type { CategoryNode, NodeWorkspaceData, PersistedTreeState } from '../shared/types';
import { coercePersistedEditorType } from '../shared/editor-types';

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
    coercePersistedEditorType(obj.editorType) !== null &&
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
    spreadsheet?: unknown;
    steamAchievementArt?: unknown;
    steamMarketplaceAssets?: unknown;
    terminalCommandCenter?: unknown;
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

  if (typeof obj.spreadsheet !== 'undefined') {
    if (typeof obj.spreadsheet !== 'object' || obj.spreadsheet === null) {
      return false;
    }

    const spreadsheet = obj.spreadsheet as {
      sheets?: unknown;
      activeSheetId?: unknown;
      activeCellKey?: unknown;
      rowCount?: unknown;
      columnCount?: unknown;
    };
    if (
      !Array.isArray(spreadsheet.sheets) ||
      typeof spreadsheet.activeSheetId !== 'string' ||
      typeof spreadsheet.activeCellKey !== 'string' ||
      typeof spreadsheet.rowCount !== 'number' ||
      typeof spreadsheet.columnCount !== 'number'
    ) {
      return false;
    }
  }

  if (typeof obj.steamAchievementArt !== 'undefined') {
    if (typeof obj.steamAchievementArt !== 'object' || obj.steamAchievementArt === null) {
      return false;
    }

    const steamAchievementArt = obj.steamAchievementArt as {
      presetId?: unknown;
      borderStyle?: unknown;
      backgroundAdjustments?: unknown;
      backgroundAssetRelativePaths?: unknown;
      entries?: unknown;
    };
    const borderStyle = steamAchievementArt.borderStyle as {
      enabled?: unknown;
      thickness?: unknown;
      opacity?: unknown;
      margin?: unknown;
      radius?: unknown;
      gradientAngle?: unknown;
      color?: unknown;
      midColor?: unknown;
      gradientColor?: unknown;
      backgroundMode?: unknown;
      backgroundOpacity?: unknown;
      backgroundGradientOverlayEnabled?: unknown;
      backgroundGradientOpacity?: unknown;
      backgroundAngle?: unknown;
      backgroundColor?: unknown;
      backgroundMidColor?: unknown;
      backgroundGradientColor?: unknown;
      backgroundImageRelativePath?: unknown;
    } | undefined;
    const backgroundAdjustments = steamAchievementArt.backgroundAdjustments as {
      saturation?: unknown;
      contrast?: unknown;
      blurEnabled?: unknown;
      blurRadius?: unknown;
      blurOpacity?: unknown;
      vignette?: unknown;
    } | undefined;
    if (
      typeof steamAchievementArt.presetId !== 'string' ||
      (typeof steamAchievementArt.borderStyle !== 'undefined' &&
        (typeof borderStyle !== 'object' ||
          borderStyle === null ||
          typeof borderStyle.enabled !== 'boolean' ||
          typeof borderStyle.thickness !== 'number' ||
          typeof borderStyle.opacity !== 'number' ||
          typeof borderStyle.margin !== 'number' ||
          typeof borderStyle.radius !== 'number' ||
          typeof borderStyle.gradientAngle !== 'number' ||
          typeof borderStyle.color !== 'string' ||
          typeof borderStyle.midColor !== 'string' ||
          typeof borderStyle.gradientColor !== 'string' ||
          (borderStyle.backgroundMode !== 'none' &&
            borderStyle.backgroundMode !== 'gradient' &&
            borderStyle.backgroundMode !== 'image') ||
          typeof borderStyle.backgroundOpacity !== 'number' ||
          typeof borderStyle.backgroundGradientOverlayEnabled !== 'boolean' ||
          (typeof borderStyle.backgroundGradientOpacity !== 'undefined' &&
            typeof borderStyle.backgroundGradientOpacity !== 'number') ||
          typeof borderStyle.backgroundAngle !== 'number' ||
          typeof borderStyle.backgroundColor !== 'string' ||
          typeof borderStyle.backgroundMidColor !== 'string' ||
          typeof borderStyle.backgroundGradientColor !== 'string' ||
          (borderStyle.backgroundImageRelativePath !== null &&
            typeof borderStyle.backgroundImageRelativePath !== 'string'))) ||
      (typeof steamAchievementArt.backgroundAdjustments !== 'undefined' &&
        (typeof backgroundAdjustments !== 'object' ||
          backgroundAdjustments === null ||
          typeof backgroundAdjustments.saturation !== 'number' ||
          typeof backgroundAdjustments.contrast !== 'number' ||
          typeof backgroundAdjustments.blurEnabled !== 'boolean' ||
          typeof backgroundAdjustments.blurRadius !== 'number' ||
          typeof backgroundAdjustments.blurOpacity !== 'number' ||
          (typeof backgroundAdjustments.vignette !== 'undefined' &&
            typeof backgroundAdjustments.vignette !== 'number'))) ||
      (typeof steamAchievementArt.backgroundAssetRelativePaths !== 'undefined' &&
        (!Array.isArray(steamAchievementArt.backgroundAssetRelativePaths) ||
          !steamAchievementArt.backgroundAssetRelativePaths.every(
            (value) => typeof value === 'string',
          ))) ||
      !Array.isArray(steamAchievementArt.entries)
    ) {
      return false;
    }

    const entriesValid = steamAchievementArt.entries.every((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return false;
      }
      const item = entry as {
        id?: unknown;
        name?: unknown;
        sourceImageRelativePath?: unknown;
        crop?: unknown;
        imageStyle?: unknown;
        createdAt?: unknown;
        updatedAt?: unknown;
      };
      const crop = item.crop as { zoom?: unknown; offsetX?: unknown; offsetY?: unknown } | undefined;
      const imageStyle = item.imageStyle as {
        adjustments?: {
          saturation?: unknown;
          contrast?: unknown;
          blurEnabled?: unknown;
          blurRadius?: unknown;
          blurOpacity?: unknown;
        };
        shadow?: {
          enabled?: unknown;
          blur?: unknown;
          opacity?: unknown;
          offsetX?: unknown;
          offsetY?: unknown;
        };
      } | undefined;
      return (
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        (item.sourceImageRelativePath === null || typeof item.sourceImageRelativePath === 'string') &&
        typeof crop === 'object' &&
        crop !== null &&
        typeof crop.zoom === 'number' &&
        typeof crop.offsetX === 'number' &&
        typeof crop.offsetY === 'number' &&
        (typeof item.imageStyle === 'undefined' ||
          (typeof imageStyle === 'object' &&
            imageStyle !== null &&
            typeof imageStyle.adjustments === 'object' &&
            imageStyle.adjustments !== null &&
            typeof imageStyle.adjustments.saturation === 'number' &&
            typeof imageStyle.adjustments.contrast === 'number' &&
            typeof imageStyle.adjustments.blurEnabled === 'boolean' &&
            typeof imageStyle.adjustments.blurRadius === 'number' &&
            typeof imageStyle.adjustments.blurOpacity === 'number' &&
            typeof imageStyle.shadow === 'object' &&
            imageStyle.shadow !== null &&
            typeof imageStyle.shadow.enabled === 'boolean' &&
            typeof imageStyle.shadow.blur === 'number' &&
            typeof imageStyle.shadow.opacity === 'number' &&
            typeof imageStyle.shadow.offsetX === 'number' &&
            typeof imageStyle.shadow.offsetY === 'number')) &&
        typeof item.createdAt === 'number' &&
        typeof item.updatedAt === 'number'
      );
    });

    if (!entriesValid) {
      return false;
    }
  }

  if (typeof obj.steamMarketplaceAssets !== 'undefined') {
    if (typeof obj.steamMarketplaceAssets !== 'object' || obj.steamMarketplaceAssets === null) {
      return false;
    }

    const steamMarketplaceAssets = obj.steamMarketplaceAssets as {
      entries?: unknown;
      logoAssetRelativePaths?: unknown;
    };
    if (
      !Array.isArray(steamMarketplaceAssets.entries) ||
      (typeof steamMarketplaceAssets.logoAssetRelativePaths !== 'undefined' &&
        (!Array.isArray(steamMarketplaceAssets.logoAssetRelativePaths) ||
          !steamMarketplaceAssets.logoAssetRelativePaths.every((value) => typeof value === 'string')))
    ) {
      return false;
    }

    const entriesValid = steamMarketplaceAssets.entries.every((entry) => {
      if (typeof entry !== 'object' || entry === null) {
        return false;
      }
      const item = entry as {
        id?: unknown;
        name?: unknown;
        presetId?: unknown;
        sourceImageRelativePath?: unknown;
        logoImageRelativePath?: unknown;
        outputsByPresetId?: unknown;
        createdAt?: unknown;
        updatedAt?: unknown;
      };
      if (
        typeof item.id !== 'string' ||
        typeof item.name !== 'string' ||
        (typeof item.presetId !== 'undefined' && typeof item.presetId !== 'string') ||
        (item.sourceImageRelativePath !== null && typeof item.sourceImageRelativePath !== 'string') ||
        (item.logoImageRelativePath !== null && typeof item.logoImageRelativePath !== 'string') ||
        typeof item.outputsByPresetId !== 'object' ||
        item.outputsByPresetId === null ||
        typeof item.createdAt !== 'number' ||
        typeof item.updatedAt !== 'number'
      ) {
        return false;
      }

      return Object.values(item.outputsByPresetId as Record<string, unknown>).every((output) => {
        if (typeof output !== 'object' || output === null) {
          return false;
        }
        const out = output as {
          enabled?: unknown;
          crop?: unknown;
          overlays?: unknown;
        };
        const crop = out.crop as { zoom?: unknown; offsetX?: unknown; offsetY?: unknown } | undefined;
        const overlays = out.overlays as {
          gradient?: unknown;
          blur?: unknown;
          image?: unknown;
          logo?: unknown;
        } | undefined;
        const gradient = overlays?.gradient as {
          enabled?: unknown;
          angle?: unknown;
          opacity?: unknown;
          color?: unknown;
          midColor?: unknown;
          endColor?: unknown;
        } | undefined;
        const blur = overlays?.blur as {
          enabled?: unknown;
          blurRadius?: unknown;
          opacity?: unknown;
        } | undefined;
        const image = overlays?.image as {
          saturation?: unknown;
          contrast?: unknown;
          vignette?: unknown;
        } | undefined;
        const logo = overlays?.logo as {
          enabled?: unknown;
          opacity?: unknown;
          scale?: unknown;
          offsetX?: unknown;
          offsetY?: unknown;
        } | undefined;

        return (
          typeof out.enabled === 'boolean' &&
          typeof crop === 'object' &&
          crop !== null &&
          typeof crop.zoom === 'number' &&
          typeof crop.offsetX === 'number' &&
          typeof crop.offsetY === 'number' &&
          typeof overlays === 'object' &&
          overlays !== null &&
          typeof gradient === 'object' &&
          gradient !== null &&
          typeof gradient.enabled === 'boolean' &&
          typeof gradient.angle === 'number' &&
          typeof gradient.opacity === 'number' &&
          typeof gradient.color === 'string' &&
          typeof gradient.midColor === 'string' &&
          typeof gradient.endColor === 'string' &&
          typeof blur === 'object' &&
          blur !== null &&
          typeof blur.enabled === 'boolean' &&
          typeof blur.blurRadius === 'number' &&
          typeof blur.opacity === 'number' &&
          typeof image === 'object' &&
          image !== null &&
          typeof image.saturation === 'number' &&
          typeof image.contrast === 'number' &&
          typeof image.vignette === 'number' &&
          typeof logo === 'object' &&
          logo !== null &&
          typeof logo.enabled === 'boolean' &&
          typeof logo.opacity === 'number' &&
          typeof logo.scale === 'number' &&
          typeof logo.offsetX === 'number' &&
          typeof logo.offsetY === 'number'
        );
      });
    });

    if (!entriesValid) {
      return false;
    }
  }

  if (typeof obj.terminalCommandCenter !== 'undefined') {
    if (typeof obj.terminalCommandCenter !== 'object' || obj.terminalCommandCenter === null) {
      return false;
    }

    const terminalCommandCenter = obj.terminalCommandCenter as {
      commands?: unknown;
      panels?: unknown;
    };

    if (!Array.isArray(terminalCommandCenter.commands) || !Array.isArray(terminalCommandCenter.panels)) {
      return false;
    }

    const commandsValid = terminalCommandCenter.commands.every((command) => {
      if (typeof command !== 'object' || command === null) {
        return false;
      }
      const item = command as {
        id?: unknown;
        name?: unknown;
        command?: unknown;
        executionFolder?: unknown;
        createdAt?: unknown;
        updatedAt?: unknown;
      };
      return (
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        typeof item.command === 'string' &&
        typeof item.executionFolder === 'string' &&
        typeof item.createdAt === 'number' &&
        typeof item.updatedAt === 'number'
      );
    });
    if (!commandsValid) {
      return false;
    }

    const panelsValid = terminalCommandCenter.panels.every((panel) => {
      if (typeof panel !== 'object' || panel === null) {
        return false;
      }
      const item = panel as {
        id?: unknown;
        title?: unknown;
        x?: unknown;
        y?: unknown;
        width?: unknown;
        height?: unknown;
        defaultExecutionFolder?: unknown;
      };
      return (
        typeof item.id === 'string' &&
        typeof item.title === 'string' &&
        typeof item.x === 'number' &&
        typeof item.y === 'number' &&
        typeof item.width === 'number' &&
        typeof item.height === 'number' &&
        (item.defaultExecutionFolder === null || typeof item.defaultExecutionFolder === 'string')
      );
    });
    if (!panelsValid) {
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
    schemaVersion?: unknown;
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
  const schemaVersionValid =
    typeof obj.schemaVersion === 'undefined' ||
    (typeof obj.schemaVersion === 'number' &&
      Number.isInteger(obj.schemaVersion) &&
      obj.schemaVersion >= 1);

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
    collapsedNodeIdsValid &&
    schemaVersionValid
  );
};
