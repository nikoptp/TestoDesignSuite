import { describe, expect, it } from 'vitest';
import type { PersistedTreeState } from '../../src/shared/types';
import {
  updateNodeKanbanData,
  updateNodeNoteboardData,
  updateNodeSpreadsheetData,
  updateNodeSteamAchievementArtData,
  updateNodeSteamMarketplaceAssetsData,
  updateNodeTerminalCommandCenterData,
  updateNodeWorkspaceData,
} from '../../src/features/app/workspace-node-updaters';
import {
  createDefaultSteamAchievementBorderStyle,
  createDefaultSteamAchievementEntryImageStyle,
} from '../../src/features/steam-achievement/steam-achievement-art';
import { createDefaultSteamMarketplaceOutputState } from '../../src/features/steam-marketplace/steam-marketplace-assets';

const baseState = (): PersistedTreeState => ({
  nodes: [],
  selectedNodeId: null,
  nextNodeNumber: 1,
  nodeDataById: {},
});

describe('workspace-node-updaters', () => {
  it('updates workspace slice immutably', () => {
    const next = updateNodeWorkspaceData(baseState(), 'node-a', (workspace) => ({
      ...workspace,
      document: { markdown: 'hello' },
    }));

    expect(next.nodeDataById['node-a']?.document?.markdown).toBe('hello');
  });

  it('updates noteboard slice with defaults when missing', () => {
    const next = updateNodeNoteboardData(baseState(), 'node-a', (noteboard) => ({
      ...noteboard,
      cards: [{ id: 'card-1', text: '', createdAt: 1, color: '#fff', x: 0, y: 0, width: 200, height: 120 }],
    }));

    expect(next.nodeDataById['node-a']?.noteboard?.cards).toHaveLength(1);
  });

  it('updates kanban slice with defaults when missing', () => {
    const next = updateNodeKanbanData(baseState(), 'node-k', (kanban) => ({
      ...kanban,
      columns: [{ id: 'todo', name: 'To Do', color: '#000000' }],
      cards: [],
      nextTaskNumber: 2,
    }));

    expect(next.nodeDataById['node-k']?.kanban?.nextTaskNumber).toBe(2);
    expect(next.nodeDataById['node-k']?.kanban?.columns[0]?.id).toBe('todo');
  });

  it('updates spreadsheet slice with defaults when missing', () => {
    const next = updateNodeSpreadsheetData(baseState(), 'node-s', (spreadsheet) => ({
      ...spreadsheet,
      sheets: [
        {
          id: 'sheet-1',
          name: 'Sheet 1',
          cells: {
            A1: { raw: '42' },
          },
        },
      ],
      activeSheetId: 'sheet-1',
      activeCellKey: 'A1',
      rowCount: 50,
      columnCount: 26,
    }));

    expect(next.nodeDataById['node-s']?.spreadsheet?.activeSheetId).toBe('sheet-1');
    expect(next.nodeDataById['node-s']?.spreadsheet?.sheets[0]?.cells.A1?.raw).toBe('42');
  });

  it('updates steam achievement art slice with defaults when missing', () => {
    const next = updateNodeSteamAchievementArtData(baseState(), 'node-steam', (steamAchievementArt) => ({
      ...steamAchievementArt,
      presetId: 'steam-achievement-256',
      borderStyle: {
        ...createDefaultSteamAchievementBorderStyle(),
        enabled: true,
      },
      entries: [
        {
          id: 'entry-1',
          name: 'first-achievement',
          sourceImageRelativePath: 'project-assets/images/hero.png',
          crop: {
            zoom: 1,
            offsetX: 0,
            offsetY: 0,
          },
          imageStyle: createDefaultSteamAchievementEntryImageStyle(),
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    }));

    expect(next.nodeDataById['node-steam']?.steamAchievementArt?.entries[0]?.name).toBe(
      'first-achievement',
    );
    expect(next.nodeDataById['node-steam']?.steamAchievementArt?.borderStyle.enabled).toBe(true);
  });

  it('updates steam marketplace assets slice with defaults when missing', () => {
    const next = updateNodeSteamMarketplaceAssetsData(baseState(), 'node-marketplace', (steamMarketplaceAssets) => ({
      ...steamMarketplaceAssets,
      entries: [
        {
          id: 'entry-1',
          name: 'capsule-art',
          sourceImageRelativePath: 'project-assets/images/capsule.png',
          logoImageRelativePath: 'project-assets/images/logo.png',
          outputsByPresetId: {
            'header-capsule': createDefaultSteamMarketplaceOutputState(),
          },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    }));

    expect(next.nodeDataById['node-marketplace']?.steamMarketplaceAssets?.entries[0]?.name).toBe(
      'capsule-art',
    );
    expect(
      next.nodeDataById['node-marketplace']?.steamMarketplaceAssets?.entries[0]?.outputsByPresetId[
        'header-capsule'
      ]?.enabled,
    ).toBe(true);
  });

  it('updates terminal command center slice with defaults when missing', () => {
    const next = updateNodeTerminalCommandCenterData(baseState(), 'node-terminal', (terminalCommandCenter) => ({
      ...terminalCommandCenter,
      commands: [
        {
          id: 'command-1',
          name: 'Install',
          command: 'npm install',
          executionFolder: 'j:/Repositories/Git/TestoDesignSuite',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      panels: [
        {
          id: 'panel-1',
          title: 'Install shell',
          x: 32,
          y: 32,
          width: 640,
          height: 360,
          defaultExecutionFolder: 'j:/Repositories/Git/TestoDesignSuite',
        },
      ],
    }));

    expect(next.nodeDataById['node-terminal']?.terminalCommandCenter?.commands[0]?.name).toBe('Install');
    expect(next.nodeDataById['node-terminal']?.terminalCommandCenter?.panels[0]?.title).toBe(
      'Install shell',
    );
  });
});
