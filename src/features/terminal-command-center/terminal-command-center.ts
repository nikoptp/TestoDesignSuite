import { createId } from '../../shared/tree-utils';
import type {
  TerminalCommandCenterData,
  TerminalCommandPreset,
  TerminalPanelLayout,
} from '../../shared/types';

const DEFAULT_COMMAND_NAME = 'command';

export const createTerminalCommandPreset = (
  input?: Partial<Pick<TerminalCommandPreset, 'name' | 'command' | 'executionFolder'>>,
): TerminalCommandPreset => {
  const now = Date.now();
  return {
    id: createId('terminal-command'),
    name: normalizeTerminalCommandName(input?.name ?? DEFAULT_COMMAND_NAME),
    command: normalizeTerminalCommandString(input?.command ?? ''),
    executionFolder: normalizeExecutionFolder(input?.executionFolder ?? ''),
    createdAt: now,
    updatedAt: now,
  };
};

export const createTerminalPanelLayout = (
  input?: Partial<Omit<TerminalPanelLayout, 'id'>>,
): TerminalPanelLayout => ({
  id: createId('terminal-panel'),
  title: normalizeTerminalPanelTitle(input?.title ?? 'Terminal'),
  x: typeof input?.x === 'number' && Number.isFinite(input.x) ? Math.round(input.x) : 64,
  y: typeof input?.y === 'number' && Number.isFinite(input.y) ? Math.round(input.y) : 64,
  width:
    typeof input?.width === 'number' && Number.isFinite(input.width)
      ? clampDimension(input.width, 280, 1400)
      : 560,
  height:
    typeof input?.height === 'number' && Number.isFinite(input.height)
      ? clampDimension(input.height, 200, 1000)
      : 360,
  defaultExecutionFolder:
    typeof input?.defaultExecutionFolder === 'string' && input.defaultExecutionFolder.trim()
      ? input.defaultExecutionFolder.trim()
      : null,
});

export const createDefaultTerminalCommandCenterData = (): TerminalCommandCenterData => ({
  commands: [],
  panels: [],
});

export const normalizeTerminalCommandName = (value: string): string => {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return (normalized || DEFAULT_COMMAND_NAME).slice(0, 96);
};

export const normalizeTerminalPanelTitle = (value: string): string => {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return (normalized || 'Terminal').slice(0, 96);
};

export const normalizeTerminalCommandString = (value: string): string => value.trim();

export const normalizeExecutionFolder = (value: string): string => value.trim();

const clampDimension = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)));

const normalizePreset = (input: unknown): TerminalCommandPreset | null => {
  if (typeof input !== 'object' || input === null) {
    return null;
  }

  const candidate = input as Partial<TerminalCommandPreset>;
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) {
    return null;
  }

  const now = Date.now();
  const createdAt =
    typeof candidate.createdAt === 'number' && Number.isFinite(candidate.createdAt)
      ? candidate.createdAt
      : now;
  const updatedAt =
    typeof candidate.updatedAt === 'number' && Number.isFinite(candidate.updatedAt)
      ? candidate.updatedAt
      : createdAt;

  return {
    id: candidate.id,
    name: normalizeTerminalCommandName(
      typeof candidate.name === 'string' ? candidate.name : DEFAULT_COMMAND_NAME,
    ),
    command: normalizeTerminalCommandString(
      typeof candidate.command === 'string' ? candidate.command : '',
    ),
    executionFolder: normalizeExecutionFolder(
      typeof candidate.executionFolder === 'string' ? candidate.executionFolder : '',
    ),
    createdAt,
    updatedAt,
  };
};

const normalizePanel = (input: unknown): TerminalPanelLayout | null => {
  if (typeof input !== 'object' || input === null) {
    return null;
  }

  const candidate = input as Partial<TerminalPanelLayout>;
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) {
    return null;
  }

  return {
    id: candidate.id,
    title: normalizeTerminalPanelTitle(typeof candidate.title === 'string' ? candidate.title : 'Terminal'),
    x: typeof candidate.x === 'number' && Number.isFinite(candidate.x) ? Math.round(candidate.x) : 64,
    y: typeof candidate.y === 'number' && Number.isFinite(candidate.y) ? Math.round(candidate.y) : 64,
    width:
      typeof candidate.width === 'number' && Number.isFinite(candidate.width)
        ? clampDimension(candidate.width, 280, 1400)
        : 560,
    height:
      typeof candidate.height === 'number' && Number.isFinite(candidate.height)
        ? clampDimension(candidate.height, 200, 1000)
        : 360,
    defaultExecutionFolder:
      typeof candidate.defaultExecutionFolder === 'string' && candidate.defaultExecutionFolder.trim()
        ? candidate.defaultExecutionFolder.trim()
        : null,
  };
};

export const normalizeTerminalCommandCenterData = (input: unknown): TerminalCommandCenterData => {
  if (typeof input !== 'object' || input === null) {
    return createDefaultTerminalCommandCenterData();
  }

  const candidate = input as {
    commands?: unknown;
    panels?: unknown;
  };

  const commands = Array.isArray(candidate.commands)
    ? candidate.commands.flatMap((command) => {
        const normalized = normalizePreset(command);
        return normalized ? [normalized] : [];
      })
    : [];
  const panels = Array.isArray(candidate.panels)
    ? candidate.panels.flatMap((panel) => {
        const normalized = normalizePanel(panel);
        return normalized ? [normalized] : [];
      })
    : [];

  return {
    commands,
    panels,
  };
};
