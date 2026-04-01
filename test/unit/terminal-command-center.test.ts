import { describe, expect, it } from 'vitest';
import {
  createDefaultTerminalCommandCenterData,
  normalizeTerminalCommandCenterData,
  normalizeTerminalCommandName,
} from '../../src/features/terminal-command-center/terminal-command-center';

describe('terminal-command-center data helpers', () => {
  it('creates empty default data', () => {
    const data = createDefaultTerminalCommandCenterData();
    expect(data.commands).toEqual([]);
    expect(data.panels).toEqual([]);
  });

  it('normalizes malformed payloads to valid command-center data', () => {
    const normalized = normalizeTerminalCommandCenterData({
      commands: [
        {
          id: 'cmd-1',
          name: '  Build  ',
          command: ' npm run build ',
          executionFolder: '  C:\\repo\\app ',
          createdAt: 1,
          updatedAt: 2,
        },
        { nope: true },
      ],
      panels: [
        {
          id: 'panel-1',
          title: ' Main ',
          x: 2.2,
          y: 3.7,
          width: 100,
          height: 120,
          defaultExecutionFolder: '  C:\\repo\\app ',
        },
        { bad: true },
      ],
    });

    expect(normalized.commands).toHaveLength(1);
    expect(normalized.commands[0]?.name).toBe('Build');
    expect(normalized.commands[0]?.command).toBe('npm run build');
    expect(normalized.commands[0]?.executionFolder).toBe('C:\\repo\\app');

    expect(normalized.panels).toHaveLength(1);
    expect(normalized.panels[0]?.title).toBe('Main');
    expect(normalized.panels[0]?.x).toBe(2);
    expect(normalized.panels[0]?.y).toBe(4);
    expect(normalized.panels[0]?.width).toBe(280);
    expect(normalized.panels[0]?.height).toBe(200);
    expect(normalized.panels[0]?.defaultExecutionFolder).toBe('C:\\repo\\app');
  });

  it('normalizes command names with defaults', () => {
    expect(normalizeTerminalCommandName('')).toBe('command');
    expect(normalizeTerminalCommandName('  dev server  ')).toBe('dev server');
  });
});
