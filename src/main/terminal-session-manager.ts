import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { webContents } from 'electron';
import { createId } from '../shared/tree-utils';
import type {
  TerminalActionResult,
  TerminalCommandRequest,
  TerminalCreateSessionRequest,
  TerminalCreateSessionResult,
  TerminalOutputPayload,
  TerminalResizeRequest,
  TerminalSessionErrorCode,
  TerminalSessionStatusPayload,
  TerminalStopByCommandRequest,
  TerminalStopByCommandResult,
  TerminalWriteRequest,
} from '../shared/types';

type TerminalSessionRecord = {
  id: string;
  ownerWebContentsId: number;
  process: ReturnType<typeof spawn>;
  commandId: string | null;
  panelId: string | null;
  executionFolder: string;
};

const emitToRenderer = <TPayload>(
  ownerWebContentsId: number,
  channel: string,
  payload: TPayload,
): void => {
  const target = webContents.fromId(ownerWebContentsId);
  if (!target || target.isDestroyed()) {
    return;
  }
  target.send(channel, payload);
};

const actionOk = (): TerminalActionResult => ({ ok: true });

const actionError = (
  errorCode: TerminalSessionErrorCode,
  message: string,
): TerminalActionResult => ({
  ok: false,
  errorCode,
  message,
});

export class TerminalSessionManager {
  private readonly sessions = new Map<string, TerminalSessionRecord>();

  private terminateProcessTree(childProcess: ReturnType<typeof spawn>): void {
    const pid = childProcess.pid;
    if (!pid) {
      return;
    }

    if (process.platform === 'win32') {
      const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        windowsHide: true,
      });
      if (result.error) {
        childProcess.kill();
      }
      return;
    }

    childProcess.kill('SIGTERM');
  }

  public async createSession(
    ownerWebContentsId: number,
    request: TerminalCreateSessionRequest,
  ): Promise<TerminalCreateSessionResult> {
    const executionFolder = request.executionFolder?.trim() || process.cwd();

    try {
      const stats = await fs.stat(executionFolder);
      if (!stats.isDirectory()) {
        return {
          ok: false,
          errorCode: 'INVALID_EXECUTION_FOLDER',
          message: 'Execution folder must be an existing directory.',
        };
      }
    } catch {
      return {
        ok: false,
        errorCode: 'INVALID_EXECUTION_FOLDER',
        message: 'Execution folder does not exist.',
      };
    }

    const sessionId = createId('terminal-session');
    const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass'], {
      cwd: executionFolder,
      stdio: 'pipe',
      windowsHide: true,
    });

    const record: TerminalSessionRecord = {
      id: sessionId,
      ownerWebContentsId,
      process: child,
      commandId: request.commandId?.trim() || null,
      panelId: request.panelId?.trim() || null,
      executionFolder,
    };
    this.sessions.set(sessionId, record);

    const emitOutput = (stream: TerminalOutputPayload['stream'], chunk: string): void => {
      emitToRenderer<TerminalOutputPayload>(ownerWebContentsId, 'terminal:output', {
        sessionId,
        stream,
        chunk,
        at: Date.now(),
      });
    };

    const emitStatus = (payload: Omit<TerminalSessionStatusPayload, 'at'>): void => {
      emitToRenderer<TerminalSessionStatusPayload>(ownerWebContentsId, 'terminal:status', {
        ...payload,
        at: Date.now(),
      });
    };

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');

    child.stdout?.on('data', (chunk: string | Buffer) => {
      emitOutput('stdout', typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    });

    child.stderr?.on('data', (chunk: string | Buffer) => {
      emitOutput('stderr', typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    });

    child.on('close', (code) => {
      this.sessions.delete(sessionId);
      emitStatus({
        sessionId,
        state: 'stopped',
        commandId: record.commandId,
        panelId: record.panelId,
        exitCode: code,
      });
    });

    child.on('error', (error) => {
      emitOutput('system', `[error] ${error.message}\n`);
      emitStatus({
        sessionId,
        state: 'error',
        commandId: record.commandId,
        panelId: record.panelId,
        errorCode: 'SPAWN_FAILED',
        message: error.message,
      });
    });

    emitStatus({
      sessionId,
      state: 'idle',
      commandId: record.commandId,
      panelId: record.panelId,
      message: `Started PowerShell in ${executionFolder}`,
    });

    return {
      ok: true,
      sessionId,
      state: 'idle',
      executionFolder,
      commandId: record.commandId,
      panelId: record.panelId,
    };
  }

  public runCommand(request: TerminalCommandRequest): TerminalActionResult {
    const session = this.sessions.get(request.sessionId);
    if (!session) {
      return actionError('SESSION_NOT_FOUND', 'Terminal session not found.');
    }
    const command = request.command.trim();
    if (!command) {
      return actionOk();
    }

    session.process.stdin?.write(`${command}\r\n`);
    emitToRenderer<TerminalSessionStatusPayload>(session.ownerWebContentsId, 'terminal:status', {
      sessionId: session.id,
      commandId: session.commandId,
      panelId: session.panelId,
      state: 'running',
      at: Date.now(),
    });
    return actionOk();
  }

  public write(request: TerminalWriteRequest): TerminalActionResult {
    const session = this.sessions.get(request.sessionId);
    if (!session) {
      return actionError('SESSION_NOT_FOUND', 'Terminal session not found.');
    }

    session.process.stdin?.write(request.data);
    return actionOk();
  }

  public resize(request: TerminalResizeRequest): TerminalActionResult {
    const session = this.sessions.get(request.sessionId);
    if (!session) {
      return actionError('SESSION_NOT_FOUND', 'Terminal session not found.');
    }
    return actionOk();
  }

  public stopSession(sessionId: string): TerminalActionResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return actionError('SESSION_NOT_FOUND', 'Terminal session not found.');
    }
    this.terminateProcessTree(session.process);
    return actionOk();
  }

  public closeSession(sessionId: string): TerminalActionResult {
    const result = this.stopSession(sessionId);
    this.sessions.delete(sessionId);
    return result;
  }

  public stopByCommand(request: TerminalStopByCommandRequest): TerminalStopByCommandResult {
    const commandId = request.commandId.trim();
    const stoppedSessionIds: string[] = [];
    if (!commandId) {
      return {
        ok: false,
        errorCode: 'UNKNOWN',
        message: 'Command id is required.',
        stoppedSessionIds,
      };
    }

    for (const session of this.sessions.values()) {
      if (session.commandId !== commandId) {
        continue;
      }
      stoppedSessionIds.push(session.id);
      this.terminateProcessTree(session.process);
      this.sessions.delete(session.id);
    }

    return {
      ok: true,
      stoppedSessionIds,
    };
  }

  public dispose(): void {
    for (const session of this.sessions.values()) {
      this.terminateProcessTree(session.process);
    }
    this.sessions.clear();
  }
}
