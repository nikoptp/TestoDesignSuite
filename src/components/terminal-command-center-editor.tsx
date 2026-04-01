import React from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import type { CategoryNode, TerminalCommandCenterData, TerminalSessionState } from '../shared/types';
import { editorTypeMeta } from '../shared/editor-types';
import { createId } from '../shared/tree-utils';
import { startWindowPointerSession } from '../shared/pointer-session';
import {
  normalizeExecutionFolder,
  normalizeTerminalCommandName,
  normalizeTerminalCommandString,
  normalizeTerminalPanelTitle,
} from '../features/terminal-command-center/terminal-command-center';

type TerminalCommandCenterEditorProps = {
  node: CategoryNode;
  data: TerminalCommandCenterData;
  onCreateCommand: (input: { id: string; name: string; command: string; executionFolder: string }) => void;
  onPatchCommand: (
    commandId: string,
    patch: Partial<{ name: string; command: string; executionFolder: string }>,
  ) => void;
  onDeleteCommand: (commandId: string) => void;
  onCreatePanel: (input: {
    id: string;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    defaultExecutionFolder: string | null;
  }) => void;
  onPatchPanel: (
    panelId: string,
    patch: Partial<{
      title: string;
      x: number;
      y: number;
      width: number;
      height: number;
      defaultExecutionFolder: string | null;
    }>,
  ) => void;
  onDeletePanel: (panelId: string) => void;
};

type PanelRuntime = {
  sessionId: string;
  status: TerminalSessionState;
  commandId: string | null;
  executionFolder: string;
  errorMessage: string | null;
};

type PanelTerminalView = {
  terminal: Terminal;
  fitAddon: FitAddon;
  dispose: () => void;
};

const normalizeTerminalOutput = (value: string): string => value.replace(/\u007f/g, '');

const clampDimension = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(value)));

const clampZoom = (value: number): number => Math.min(2.5, Math.max(0.5, value));
const CANVAS_ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5] as const;

const findNearestZoomStepIndex = (zoom: number): number => {
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;
  CANVAS_ZOOM_STEPS.forEach((step, index) => {
    const distance = Math.abs(step - zoom);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });
  return closestIndex;
};

const terminalFontSizeForZoom = (zoom: number): number => Math.max(9, Math.round(12 * zoom));

const estimateTerminalColsRows = (width: number, height: number): { cols: number; rows: number } => ({
  cols: Math.max(30, Math.floor((width - 20) / 8)),
  rows: Math.max(8, Math.floor((height - 90) / 18)),
});

const statusSymbol = (status: TerminalSessionState): string => {
  if (status === 'running') {
    return '*';
  }
  if (status === 'idle') {
    return '~';
  }
  if (status === 'error') {
    return 'x';
  }
  return 'o';
};

const statusVisualClass = (status: TerminalSessionState): 'running' | 'idle' | 'warning' | 'stopped' => {
  if (status === 'running') {
    return 'running';
  }
  if (status === 'idle') {
    return 'idle';
  }
  if (status === 'error') {
    return 'warning';
  }
  return 'stopped';
};

export const TerminalCommandCenterEditor = ({
  node,
  data,
  onCreateCommand,
  onPatchCommand,
  onDeleteCommand,
  onCreatePanel,
  onPatchPanel,
  onDeletePanel,
}: TerminalCommandCenterEditorProps): React.ReactElement => {
  const meta = editorTypeMeta(node.editorType);
  const [canvasOffset, setCanvasOffset] = React.useState({ x: 0, y: 0 });
  const [canvasZoom, setCanvasZoom] = React.useState(1);
  const [confirmDeleteCommandId, setConfirmDeleteCommandId] = React.useState<string | null>(null);
  const [newCommandName, setNewCommandName] = React.useState('');
  const [newCommandText, setNewCommandText] = React.useState('');
  const [newCommandFolder, setNewCommandFolder] = React.useState('');
  const [runtimeByPanelId, setRuntimeByPanelId] = React.useState<Record<string, PanelRuntime>>({});
  const panelViewportRef = React.useRef<Record<string, HTMLDivElement | null>>({});
  const panelTerminalViewRef = React.useRef<Record<string, PanelTerminalView>>({});
  const panelInputBufferRef = React.useRef<Record<string, string>>({});
  const runtimeByPanelIdRef = React.useRef<Record<string, PanelRuntime>>({});

  const queuedRunByPanelIdRef = React.useRef<
    Record<string, { command: string; commandId: string | null; executionFolder: string }>
  >({});

  React.useEffect(() => {
    runtimeByPanelIdRef.current = runtimeByPanelId;
  }, [runtimeByPanelId]);

  React.useEffect(() => {
    const removeOutputListener = window.testoApi?.terminalOnOutput?.((payload) => {
      const panelId =
        Object.entries(runtimeByPanelIdRef.current).find(([, runtime]) => runtime.sessionId === payload.sessionId)?.[0] ??
        null;
      if (!panelId) {
        return;
      }
      const terminalView = panelTerminalViewRef.current[panelId];
      terminalView?.terminal.write(normalizeTerminalOutput(payload.chunk));
    });
    const removeStatusListener = window.testoApi?.terminalOnStatus?.((payload) => {
      const panelIdFromRuntime =
        Object.entries(runtimeByPanelIdRef.current).find(([, runtime]) => runtime.sessionId === payload.sessionId)?.[0] ??
        payload.panelId ??
        null;
      if (payload.message && panelIdFromRuntime) {
        panelTerminalViewRef.current[panelIdFromRuntime]?.terminal.writeln(`\x1b[90m[status]\x1b[0m ${payload.message}`);
      }
      setRuntimeByPanelId((prev) => {
        const next = { ...prev };
        const targetPanelId = panelIdFromRuntime;
        if (!targetPanelId) {
          return prev;
        }
        const current = next[targetPanelId];
        if (!current) {
          return prev;
        }
        next[targetPanelId] = {
          ...current,
          sessionId: payload.state === 'stopped' ? '' : current.sessionId,
          status: payload.state,
          commandId: payload.commandId ?? current.commandId,
          errorMessage: payload.message ?? null,
        };
        return next;
      });
    });

    return () => {
      removeOutputListener?.();
      removeStatusListener?.();
    };
  }, []);

  React.useEffect(() => {
    const activePanelIds = new Set(data.panels.map((panel) => panel.id));

    for (const panel of data.panels) {
      if (panelTerminalViewRef.current[panel.id]) {
        continue;
      }
      const viewportElement = panelViewportRef.current[panel.id];
      if (!viewportElement) {
        continue;
      }

      const terminal = new Terminal({
        convertEol: true,
        cursorBlink: true,
        fontFamily: 'Cascadia Mono, Consolas, Menlo, Monaco, monospace',
        fontSize: terminalFontSizeForZoom(canvasZoom),
        lineHeight: 1.35,
        scrollback: 8000,
        theme: {
          background: 'rgba(7, 12, 24, 0.04)',
          foreground: '#d5deef',
          cursor: '#8ab4ff',
        },
      });
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(viewportElement);
      fitAddon.fit();
      terminal.focus();

      const dataDisposable = terminal.onData((value) => {
        const runtime = runtimeByPanelIdRef.current[panel.id];
        if (!runtime?.sessionId) {
          return;
        }
        const currentBuffer = panelInputBufferRef.current[panel.id] ?? '';
        let nextBuffer = currentBuffer;
        let pendingCommand: string | null = null;

        for (const character of value) {
          if (character === '\r') {
            terminal.write('\r\n');
            pendingCommand = nextBuffer;
            nextBuffer = '';
            continue;
          }
          if (character === '\n') {
            continue;
          }
          if (character === '\u007f' || character === '\u0008') {
            if (nextBuffer.length > 0) {
              nextBuffer = nextBuffer.slice(0, -1);
              terminal.write('\b \b');
            }
            continue;
          }
          if (character === '\u0003') {
            nextBuffer = '';
            terminal.write('^C\r\n');
            queuedRunByPanelIdRef.current[panel.id] = {
              command: '',
              commandId: runtime.commandId,
              executionFolder: runtime.executionFolder,
            };
            panelInputBufferRef.current[panel.id] = '';
            void window.testoApi?.terminalStopSession(runtime.sessionId);
            setRuntimeByPanelId((prev) => ({
              ...prev,
              [panel.id]: {
                ...runtime,
                sessionId: '',
                status: 'stopped',
                errorMessage: null,
              },
            }));
            continue;
          }
          if (character >= ' ' && character !== '\u007f') {
            nextBuffer += character;
            terminal.write(character);
          }
        }

        panelInputBufferRef.current[panel.id] = nextBuffer;
        if (pendingCommand !== null) {
          const commandToRun = pendingCommand.trim();
          if (!commandToRun) {
            return;
          }
          void window.testoApi?.terminalRunPreset({
            sessionId: runtime.sessionId,
            command: commandToRun,
          });
        }
      });

      panelTerminalViewRef.current[panel.id] = {
        terminal,
        fitAddon,
        dispose: () => {
          dataDisposable.dispose();
          terminal.dispose();
        },
      };
    }

    Object.keys(panelTerminalViewRef.current).forEach((panelId) => {
      if (activePanelIds.has(panelId)) {
        return;
      }
      panelTerminalViewRef.current[panelId]?.dispose();
      delete panelTerminalViewRef.current[panelId];
      delete panelViewportRef.current[panelId];
      delete panelInputBufferRef.current[panelId];
    });
  }, [data.panels]);

  React.useEffect(() => {
    for (const panel of data.panels) {
      const queued = queuedRunByPanelIdRef.current[panel.id];
      const currentRuntime = runtimeByPanelId[panel.id];
      if (currentRuntime?.sessionId) {
        continue;
      }
      if (currentRuntime && !queued) {
        continue;
      }
      const terminalView = panelTerminalViewRef.current[panel.id];
      const estimatedDimensions = estimateTerminalColsRows(panel.width * canvasZoom, panel.height * canvasZoom);
      void (async () => {
        const result = await window.testoApi?.terminalCreateSession({
          panelId: panel.id,
          commandId: queued?.commandId ?? currentRuntime?.commandId ?? null,
          executionFolder:
            queued?.executionFolder ??
            currentRuntime?.executionFolder ??
            panel.defaultExecutionFolder ??
            '',
          cols: terminalView?.terminal.cols ?? estimatedDimensions.cols,
          rows: terminalView?.terminal.rows ?? estimatedDimensions.rows,
        });
        if (!result || result.ok === false) {
          let errorMessage = 'Unable to create terminal session.';
          if (result && result.ok === false) {
            errorMessage = result.message;
          }
          setRuntimeByPanelId((prev) => ({
            ...prev,
            [panel.id]: {
              sessionId: '',
              status: 'error',
              commandId: queued?.commandId ?? currentRuntime?.commandId ?? null,
              executionFolder:
                queued?.executionFolder ??
                currentRuntime?.executionFolder ??
                panel.defaultExecutionFolder ??
                '',
              errorMessage,
            },
          }));
          return;
        }

        setRuntimeByPanelId((prev) => ({
          ...prev,
          [panel.id]: {
            sessionId: result.sessionId,
            status: result.state,
            commandId: result.commandId,
            executionFolder: result.executionFolder,
            errorMessage: null,
          },
        }));

        const activeTerminalView = panelTerminalViewRef.current[panel.id];
        if (activeTerminalView) {
          activeTerminalView.fitAddon.fit();
          await window.testoApi?.terminalResize({
            sessionId: result.sessionId,
            cols: activeTerminalView.terminal.cols,
            rows: activeTerminalView.terminal.rows,
          });
          activeTerminalView.terminal.focus();
        }

        const queuedRun = queuedRunByPanelIdRef.current[panel.id];
        if (queuedRun?.command) {
          const runResult = await window.testoApi?.terminalRunPreset({
            sessionId: result.sessionId,
            command: queuedRun.command,
          });
          if (!runResult || runResult.ok === false) {
            setRuntimeByPanelId((prev) => ({
              ...prev,
              [panel.id]: {
                ...(prev[panel.id] ?? {
                  sessionId: result.sessionId,
                  status: 'error',
                  commandId: result.commandId,
                  executionFolder: result.executionFolder,
                  errorMessage: null,
                }),
                status: 'error',
                errorMessage: runResult?.ok === false ? runResult.message : 'Failed to run command.',
              },
            }));
          }
        }
        if (queuedRun) {
          delete queuedRunByPanelIdRef.current[panel.id];
        }
      })();
    }
  }, [canvasZoom, data.panels, runtimeByPanelId]);

  React.useEffect(() => {
    const activePanelIds = new Set(data.panels.map((panel) => panel.id));
    for (const panelId of Object.keys(runtimeByPanelId)) {
      if (activePanelIds.has(panelId)) {
        continue;
      }
      const runtime = runtimeByPanelId[panelId];
      if (runtime?.sessionId) {
        void window.testoApi?.terminalCloseSession(runtime.sessionId);
      }
      panelTerminalViewRef.current[panelId]?.dispose();
      delete panelTerminalViewRef.current[panelId];
      delete panelViewportRef.current[panelId];
      delete panelInputBufferRef.current[panelId];
    }
  }, [data.panels, runtimeByPanelId]);

  React.useEffect(
    () => () => {
      Object.values(runtimeByPanelIdRef.current).forEach((runtime) => {
        if (runtime.sessionId) {
          void window.testoApi?.terminalCloseSession(runtime.sessionId);
        }
      });
      Object.values(panelTerminalViewRef.current).forEach((view) => {
        view.dispose();
      });
      panelTerminalViewRef.current = {};
      panelViewportRef.current = {};
      panelInputBufferRef.current = {};
    },
    [],
  );

  React.useEffect(() => {
    Object.entries(panelTerminalViewRef.current).forEach(([panelId, terminalView]) => {
      terminalView.terminal.options.fontSize = terminalFontSizeForZoom(canvasZoom);
      terminalView.fitAddon.fit();
      const runtime = runtimeByPanelIdRef.current[panelId];
      if (!runtime?.sessionId) {
        return;
      }
      void window.testoApi?.terminalResize({
        sessionId: runtime.sessionId,
        cols: terminalView.terminal.cols,
        rows: terminalView.terminal.rows,
      });
    });
  }, [canvasZoom]);

  const runtimeRefByCommandId = React.useMemo(() => {
    const next: Record<string, { panelId: string; runtime: PanelRuntime }> = {};
    Object.entries(runtimeByPanelId).forEach(([panelId, runtime]) => {
      if (!runtime.commandId) {
        return;
      }
      const existing = next[runtime.commandId];
      if (!existing || runtime.sessionId) {
        next[runtime.commandId] = { panelId, runtime };
      }
    });
    return next;
  }, [runtimeByPanelId]);

  const createCommand = React.useCallback((): void => {
    const name = normalizeTerminalCommandName(newCommandName);
    const command = normalizeTerminalCommandString(newCommandText);
    const executionFolder = normalizeExecutionFolder(newCommandFolder);
    if (!command || !executionFolder) {
      return;
    }
    onCreateCommand({
      id: createId('terminal-command'),
      name,
      command,
      executionFolder,
    });
    setNewCommandName('');
    setNewCommandText('');
    setNewCommandFolder('');
  }, [newCommandFolder, newCommandName, newCommandText, onCreateCommand]);

  const browseExecutionFolder = React.useCallback(async (): Promise<void> => {
    const pickedPath = await window.testoApi?.terminalPickExecutionFolder?.(newCommandFolder || undefined);
    if (pickedPath) {
      setNewCommandFolder(pickedPath);
    }
  }, [newCommandFolder]);

  const createEmptyPanel = React.useCallback((): void => {
    onCreatePanel({
      id: createId('terminal-panel'),
      title: 'Terminal',
      x: 72 + data.panels.length * 16,
      y: 72 + data.panels.length * 16,
      width: 620,
      height: 380,
      defaultExecutionFolder: null,
    });
  }, [data.panels.length, onCreatePanel]);

  const playCommand = React.useCallback(
    (commandId: string): void => {
      const command = data.commands.find((item) => item.id === commandId);
      if (!command) {
        return;
      }
      const linkedRuntime = runtimeRefByCommandId[commandId];
      if (linkedRuntime) {
        queuedRunByPanelIdRef.current[linkedRuntime.panelId] = {
          command: command.command,
          commandId: command.id,
          executionFolder: command.executionFolder,
        };
        setRuntimeByPanelId((prev) => ({
          ...prev,
          [linkedRuntime.panelId]: {
            ...linkedRuntime.runtime,
            sessionId: '',
            status: 'stopped',
            executionFolder: command.executionFolder,
            errorMessage: null,
          },
        }));
        return;
      }
      const panelId = createId('terminal-panel');
      queuedRunByPanelIdRef.current[panelId] = {
        command: command.command,
        commandId: command.id,
        executionFolder: command.executionFolder,
      };
      onCreatePanel({
        id: panelId,
        title: normalizeTerminalPanelTitle(command.name),
        x: 72 + data.panels.length * 16,
        y: 72 + data.panels.length * 16,
        width: 620,
        height: 380,
        defaultExecutionFolder: command.executionFolder,
      });
    },
    [data.commands, data.panels.length, onCreatePanel, runtimeRefByCommandId],
  );

  const stopByCommand = React.useCallback(async (commandId: string): Promise<void> => {
    await window.testoApi?.terminalStopByCommand({ commandId });
    setRuntimeByPanelId((prev) => {
      const next = { ...prev };
      Object.entries(next).forEach(([panelId, runtime]) => {
        if (runtime.commandId === commandId) {
          next[panelId] = {
            ...runtime,
            sessionId: '',
            status: 'stopped',
            errorMessage: null,
          };
          panelInputBufferRef.current[panelId] = '';
        }
      });
      return next;
    });
  }, []);

  const closePanel = React.useCallback(
    async (panelId: string): Promise<void> => {
      const runtime = runtimeByPanelId[panelId];
      if (runtime?.sessionId) {
        await window.testoApi?.terminalCloseSession(runtime.sessionId);
      }
      panelTerminalViewRef.current[panelId]?.dispose();
      delete panelTerminalViewRef.current[panelId];
      delete panelViewportRef.current[panelId];
      delete panelInputBufferRef.current[panelId];
      setRuntimeByPanelId((prev) => {
        const next = { ...prev };
        delete next[panelId];
        return next;
      });
      onDeletePanel(panelId);
    },
    [onDeletePanel, runtimeByPanelId],
  );

  const stopPanel = React.useCallback(
    async (panelId: string): Promise<void> => {
      const runtime = runtimeByPanelId[panelId];
      if (!runtime?.sessionId) {
        return;
      }
      queuedRunByPanelIdRef.current[panelId] = {
        command: '',
        commandId: runtime.commandId,
        executionFolder: runtime.executionFolder,
      };
      await window.testoApi?.terminalStopSession(runtime.sessionId);
      panelInputBufferRef.current[panelId] = '';
      setRuntimeByPanelId((prev) => ({
        ...prev,
        [panelId]: {
          ...runtime,
          sessionId: '',
          status: 'stopped',
          errorMessage: null,
        },
      }));
    },
    [runtimeByPanelId],
  );

  const confirmDeleteCommand = React.useCallback(
    async (commandId: string): Promise<void> => {
      const linkedRuntime = runtimeRefByCommandId[commandId];
      if (linkedRuntime) {
        await closePanel(linkedRuntime.panelId);
      }
      onDeleteCommand(commandId);
      setConfirmDeleteCommandId(null);
    },
    [closePanel, onDeleteCommand, runtimeRefByCommandId],
  );

  const beginDrag = React.useCallback(
    (event: React.PointerEvent, panelId: string): void => {
      event.preventDefault();
      const panel = data.panels.find((item) => item.id === panelId);
      if (!panel) {
        return;
      }
      const startX = event.clientX;
      const startY = event.clientY;
      const startPanelX = panel.x;
      const startPanelY = panel.y;
      const stopSession = startWindowPointerSession({
        bodyClassName: 'is-resizing',
        onMove: (moveEvent) => {
          onPatchPanel(panelId, {
            x: startPanelX + (moveEvent.clientX - startX) / canvasZoom,
            y: startPanelY + (moveEvent.clientY - startY) / canvasZoom,
          });
        },
        onEnd: () => {
          stopSession();
        },
      });
    },
    [canvasZoom, data.panels, onPatchPanel],
  );

  const beginResize = React.useCallback(
    (event: React.PointerEvent, panelId: string): void => {
      event.preventDefault();
      const panel = data.panels.find((item) => item.id === panelId);
      if (!panel) {
        return;
      }
      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = panel.width;
      const startHeight = panel.height;
      const stopSession = startWindowPointerSession({
        bodyClassName: 'is-resizing',
        onMove: (moveEvent) => {
          const width = clampDimension(startWidth + (moveEvent.clientX - startX) / canvasZoom, 320, 1400);
          const height = clampDimension(startHeight + (moveEvent.clientY - startY) / canvasZoom, 220, 1000);
          onPatchPanel(panelId, { width, height });
          const runtime = runtimeByPanelId[panelId];
          if (runtime?.sessionId) {
            const terminalView = panelTerminalViewRef.current[panelId];
            terminalView?.fitAddon.fit();
            void window.testoApi?.terminalResize({
              sessionId: runtime.sessionId,
              ...(terminalView
                ? { cols: terminalView.terminal.cols, rows: terminalView.terminal.rows }
                : estimateTerminalColsRows(width * canvasZoom, height * canvasZoom)),
            });
          }
        },
        onEnd: () => {
          stopSession();
        },
      });
    },
    [canvasZoom, data.panels, onPatchPanel, runtimeByPanelId],
  );

  const beginCanvasPan = React.useCallback((event: React.PointerEvent): void => {
    if (event.button !== 1) {
      return;
    }
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startOffsetX = canvasOffset.x;
    const startOffsetY = canvasOffset.y;
    const stopSession = startWindowPointerSession({
      bodyClassName: 'is-panning-terminal-canvas',
      onMove: (moveEvent) => {
        setCanvasOffset({
          x: startOffsetX + (moveEvent.clientX - startX),
          y: startOffsetY + (moveEvent.clientY - startY),
        });
      },
      onEnd: () => {
        stopSession();
      },
    });
  }, [canvasOffset.x, canvasOffset.y]);

  const setZoomAroundPoint = React.useCallback(
    (nextZoom: number, clientX: number, clientY: number, container: DOMRect): void => {
      const clampedZoom = clampZoom(nextZoom);
      const localX = clientX - container.left;
      const localY = clientY - container.top;
      const worldX = (localX - canvasOffset.x) / canvasZoom;
      const worldY = (localY - canvasOffset.y) / canvasZoom;
      setCanvasZoom(clampedZoom);
      setCanvasOffset({
        x: localX - worldX * clampedZoom,
        y: localY - worldY * clampedZoom,
      });
    },
    [canvasOffset.x, canvasOffset.y, canvasZoom],
  );

  const stepZoom = React.useCallback(
    (direction: 1 | -1, clientX: number, clientY: number, container: DOMRect): void => {
      const nearestIndex = findNearestZoomStepIndex(canvasZoom);
      const targetIndex =
        direction > 0
          ? Math.min(CANVAS_ZOOM_STEPS.length - 1, nearestIndex + 1)
          : Math.max(0, nearestIndex - 1);
      setZoomAroundPoint(CANVAS_ZOOM_STEPS[targetIndex], clientX, clientY, container);
    },
    [canvasZoom, setZoomAroundPoint],
  );

  const handleCanvasWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>): void => {
      const target = event.target;
      if (target instanceof Element && target.closest('.terminal-panel-xterm')) {
        return;
      }
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      stepZoom(event.deltaY < 0 ? 1 : -1, event.clientX, event.clientY, rect);
    },
    [stepZoom],
  );

  const adjustZoomByStep = React.useCallback(
    (direction: 1 | -1): void => {
      const shell = document.querySelector('.terminal-canvas-shell');
      if (!(shell instanceof HTMLDivElement)) {
        const nearestIndex = findNearestZoomStepIndex(canvasZoom);
        const targetIndex =
          direction > 0
            ? Math.min(CANVAS_ZOOM_STEPS.length - 1, nearestIndex + 1)
            : Math.max(0, nearestIndex - 1);
        setCanvasZoom(CANVAS_ZOOM_STEPS[targetIndex]);
        return;
      }
      const rect = shell.getBoundingClientRect();
      stepZoom(direction, rect.left + rect.width / 2, rect.top + rect.height / 2, rect);
    },
    [canvasZoom, stepZoom],
  );

  return (
    <section className="terminal-command-center">
      <header className="terminal-command-center-header">
        <div>
          <h2>{node.name}</h2>
          <p className="editor-subtitle">Editor type: {meta.label}</p>
        </div>
        <button type="button" className="terminal-create-panel" onClick={createEmptyPanel}>
          + Empty Terminal
        </button>
      </header>
      <div className="terminal-command-center-layout">
        <aside className="terminal-command-list">
          <h3>Saved Commands</h3>
          <div className="terminal-command-create">
            <input
              className="settings-input"
              placeholder="Name"
              value={newCommandName}
              onChange={(event) => setNewCommandName(event.target.value)}
            />
            <input
              className="settings-input"
              placeholder="Command"
              value={newCommandText}
              onChange={(event) => setNewCommandText(event.target.value)}
            />
            <input
              className="settings-input"
              placeholder="Execution folder"
              value={newCommandFolder}
              onChange={(event) => setNewCommandFolder(event.target.value)}
            />
            <button type="button" onClick={() => void browseExecutionFolder()}>
              Browse Folder
            </button>
            <button
              type="button"
              onClick={createCommand}
              disabled={!newCommandText.trim() || !newCommandFolder.trim()}
            >
              Add Command
            </button>
          </div>
          <div className="terminal-command-items">
            {data.commands.map((command) => {
              const linkedRuntime = runtimeRefByCommandId[command.id]?.runtime;
              const status: TerminalSessionState = linkedRuntime?.status ?? 'stopped';
              const isRunning = Boolean(linkedRuntime?.sessionId);
              return (
                <article key={command.id} className="terminal-command-row">
                  <span className={`terminal-status-chip is-${statusVisualClass(status)}`}>
                    {statusSymbol(status)}
                  </span>
                  <input
                    className="settings-input terminal-command-name"
                    value={command.name}
                    onChange={(event) =>
                      onPatchCommand(command.id, {
                        name: event.target.value,
                      })
                    }
                    title={command.command}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (isRunning) {
                        void stopByCommand(command.id);
                        return;
                      }
                      playCommand(command.id);
                    }}
                    title={isRunning ? 'Pause' : 'Play'}
                  >
                    <i className={`fa-solid ${isRunning ? 'fa-pause' : 'fa-play'}`}></i>
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => setConfirmDeleteCommandId(command.id)}
                    title="Delete"
                  >
                    <i className="fa-solid fa-trash"></i>
                  </button>
                  {confirmDeleteCommandId === command.id ? (
                    <div className="terminal-command-delete-confirm">
                      <p>Delete this command preset?</p>
                      <div className="terminal-command-delete-actions">
                        <button type="button" className="danger" onClick={() => void confirmDeleteCommand(command.id)}>
                          Confirm
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteCommandId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
            {data.commands.length === 0 ? (
              <p className="terminal-empty-help">Save commands on the left, then press play to open panels.</p>
            ) : null}
          </div>
        </aside>
        <div className="terminal-canvas-shell" onPointerDown={beginCanvasPan} onWheel={handleCanvasWheel}>
          <div className="terminal-canvas-zoom-controls">
            <button type="button" onClick={() => adjustZoomByStep(-1)} title="Zoom out">
              <i className="fa-solid fa-magnifying-glass-minus"></i>
            </button>
            <span>{Math.round(canvasZoom * 100)}%</span>
            <button type="button" onClick={() => adjustZoomByStep(1)} title="Zoom in">
              <i className="fa-solid fa-magnifying-glass-plus"></i>
            </button>
            <button type="button" onClick={() => setCanvasZoom(1)} title="Reset zoom">
              1:1
            </button>
          </div>
          <div
            className="terminal-canvas-grid"
            style={{
              backgroundPosition: `${canvasOffset.x}px ${canvasOffset.y}px`,
              backgroundSize: `${24 * canvasZoom}px ${24 * canvasZoom}px`,
            }}
          ></div>
          <div
            className="terminal-canvas-panels"
            style={{
              transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)`,
            }}
          >
            {data.panels.map((panel) => {
              const runtime = runtimeByPanelId[panel.id];
              const panelStatus = runtime?.status ?? 'idle';
              return (
                <article
                  key={panel.id}
                  className="terminal-panel"
                  style={{
                    left: panel.x * canvasZoom,
                    top: panel.y * canvasZoom,
                    width: panel.width * canvasZoom,
                    height: panel.height * canvasZoom,
                  }}
                >
                  <header className="terminal-panel-header" onPointerDown={(event) => beginDrag(event, panel.id)}>
                    {runtime?.commandId ? (
                      <span className={`terminal-status-chip terminal-chrome-status is-${statusVisualClass(panelStatus)}`}>
                        {statusSymbol(panelStatus)}
                      </span>
                    ) : (
                      <span className="terminal-panel-chrome-placeholder" aria-hidden="true"></span>
                    )}
                    <div className="terminal-panel-title-shell">
                      <input
                        className="settings-input terminal-panel-title"
                        value={panel.title}
                        onChange={(event) =>
                          onPatchPanel(panel.id, {
                            title: normalizeTerminalPanelTitle(event.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="terminal-panel-controls">
                      <button type="button" onClick={() => void stopPanel(panel.id)} title="Stop process">
                        <i className="fa-solid fa-stop"></i>
                      </button>
                      <button type="button" onClick={() => void closePanel(panel.id)} title="Close terminal">
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  </header>
                  <div className="terminal-panel-viewport">
                    <div
                      className="terminal-panel-xterm"
                      ref={(element) => {
                        panelViewportRef.current[panel.id] = element;
                      }}
                      onPointerDown={() => {
                        panelTerminalViewRef.current[panel.id]?.terminal.focus();
                      }}
                    ></div>
                  </div>
                  <button
                    type="button"
                    className="terminal-panel-resize-handle"
                    onPointerDown={(event) => beginResize(event, panel.id)}
                    title="Resize terminal"
                    aria-label="Resize terminal"
                  >
                    <i className="fa-solid fa-up-right-and-down-left-from-center"></i>
                  </button>
                  {runtime?.errorMessage ? (
                    <p className="terminal-panel-error">{runtime.errorMessage}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
