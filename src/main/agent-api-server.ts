import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ApiCapabilities,
  CreateProjectNodeRequest,
  DocsReadResult,
  DocsRenameRequest,
  DocsWriteRequest,
  ProjectEditorNodeEntry,
  ProjectDocFileEntry,
} from '../shared/types';

type AgentApiServerDeps = {
  listProjectDocs: () => Promise<ProjectDocFileEntry[]>;
  readProjectDoc: (relativePath: string) => Promise<DocsReadResult>;
  writeProjectDoc: (request: DocsWriteRequest) => Promise<DocsReadResult>;
  createProjectDoc: (request: Omit<DocsWriteRequest, 'expectedHash'>) => Promise<DocsReadResult>;
  renameProjectDoc: (request: DocsRenameRequest) => Promise<{ relativePath: string }>;
  deleteProjectDoc: (relativePath: string) => Promise<void>;
  getApiCapabilities: () => ApiCapabilities;
  listEditorNodes: () => Promise<ProjectEditorNodeEntry[]>;
  createEditorNode: (
    request: CreateProjectNodeRequest,
  ) => Promise<{ createdNode: ProjectEditorNodeEntry }>;
  getUserDataPath: () => string;
};

const MAX_JSON_BODY_BYTES = 1_000_000;
const MAX_REQUESTS_PER_MINUTE = 240;

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const contentLengthRaw = request.headers['content-length'];
  if (typeof contentLengthRaw === 'string') {
    const contentLength = Number(contentLengthRaw);
    if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }
  }
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += part.length;
    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }
    chunks.push(part);
  }
  const body = Buffer.concat(chunks).toString('utf8').trim();
  if (!body) {
    return {};
  }
  return JSON.parse(body) as unknown;
};

const writeJson = (response: ServerResponse, statusCode: number, payload: unknown): void => {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
};

const isAuthorized = (authorizationHeader: string | undefined, token: string): boolean => {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return false;
  }
  const candidate = authorizationHeader.slice('Bearer '.length);
  const candidateBytes = Buffer.from(candidate, 'utf8');
  const tokenBytes = Buffer.from(token, 'utf8');
  if (candidateBytes.length !== tokenBytes.length) {
    return false;
  }
  return timingSafeEqual(candidateBytes, tokenBytes);
};

export class AgentApiServer {
  private readonly deps: AgentApiServerDeps;

  private readonly token: string;

  private server = createServer();

  private runtimeFilePath: string;

  private started = false;

  private requestWindowStartMs = Date.now();

  private requestCountInWindow = 0;

  constructor(deps: AgentApiServerDeps) {
    this.deps = deps;
    this.token = randomBytes(24).toString('base64url');
    this.runtimeFilePath = path.join(this.deps.getUserDataPath(), 'data', 'agent-api.json');
    this.server.on('request', (request: IncomingMessage, response: ServerResponse) => {
      void this.handleRequest(request, response);
    });
  }

  private async persistRuntimeInfo(port: number): Promise<void> {
    await mkdir(path.dirname(this.runtimeFilePath), { recursive: true });
    await writeFile(
      this.runtimeFilePath,
      JSON.stringify(
        {
          name: 'Testo Agent API',
          apiVersion: this.deps.getApiCapabilities().apiVersion,
          baseUrl: `http://127.0.0.1:${port}`,
          token: this.token,
          generatedAt: Date.now(),
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  private isRateLimited(): boolean {
    const now = Date.now();
    if (now - this.requestWindowStartMs >= 60_000) {
      this.requestWindowStartMs = now;
      this.requestCountInWindow = 0;
    }
    this.requestCountInWindow += 1;
    return this.requestCountInWindow > MAX_REQUESTS_PER_MINUTE;
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      if (request.method === 'OPTIONS') {
        writeJson(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'OPTIONS is not supported.' } });
        return;
      }
      if (this.isRateLimited()) {
        writeJson(response, 429, { error: { code: 'RATE_LIMITED', message: 'Too many requests.' } });
        return;
      }
      if (!isAuthorized(request.headers.authorization, this.token)) {
        writeJson(response, 401, { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid bearer token.' } });
        return;
      }
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const pathname = url.pathname;

      if (request.method === 'GET' && pathname === '/capabilities') {
        writeJson(response, 200, this.deps.getApiCapabilities());
        return;
      }
      if (request.method === 'GET' && pathname === '/docs') {
        writeJson(response, 200, await this.deps.listProjectDocs());
        return;
      }
      if (request.method === 'GET' && pathname === '/nodes') {
        writeJson(response, 200, await this.deps.listEditorNodes());
        return;
      }
      if (request.method === 'GET' && pathname === '/docs/file') {
        const relativePath = url.searchParams.get('path');
        if (!relativePath) {
          writeJson(response, 400, { error: { code: 'INVALID_ARGUMENT', message: 'Query param path is required.' } });
          return;
        }
        writeJson(response, 200, await this.deps.readProjectDoc(relativePath));
        return;
      }
      if (request.method === 'PUT' && pathname === '/docs/file') {
        const body = (await readJsonBody(request)) as DocsWriteRequest;
        writeJson(response, 200, await this.deps.writeProjectDoc(body));
        return;
      }
      if (request.method === 'POST' && pathname === '/docs/file') {
        const body = (await readJsonBody(request)) as Omit<DocsWriteRequest, 'expectedHash'>;
        writeJson(response, 200, await this.deps.createProjectDoc(body));
        return;
      }
      if (request.method === 'POST' && pathname === '/nodes/create') {
        const body = (await readJsonBody(request)) as CreateProjectNodeRequest;
        writeJson(response, 200, await this.deps.createEditorNode(body));
        return;
      }
      if (request.method === 'POST' && pathname === '/docs/rename') {
        const body = (await readJsonBody(request)) as DocsRenameRequest;
        writeJson(response, 200, await this.deps.renameProjectDoc(body));
        return;
      }
      if (request.method === 'DELETE' && pathname === '/docs/file') {
        const relativePath = url.searchParams.get('path');
        if (!relativePath) {
          writeJson(response, 400, { error: { code: 'INVALID_ARGUMENT', message: 'Query param path is required.' } });
          return;
        }
        await this.deps.deleteProjectDoc(relativePath);
        writeJson(response, 200, { ok: true });
        return;
      }

      writeJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') {
        writeJson(response, 413, {
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `Request body exceeds ${MAX_JSON_BODY_BYTES} bytes.`,
          },
        });
        return;
      }
      if (error instanceof SyntaxError) {
        writeJson(response, 400, {
          error: {
            code: 'INVALID_JSON',
            message: 'Request body must be valid JSON.',
          },
        });
        return;
      }
      writeJson(response, 500, {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Operation failed.',
        },
      });
    }
  }

  start = async (): Promise<void> => {
    if (this.started) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(0, '127.0.0.1', () => {
        this.server.off('error', reject);
        resolve();
      });
    });
    const address = this.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve Agent API server address.');
    }
    await this.persistRuntimeInfo(address.port);
    this.started = true;
  };

  stop = async (): Promise<void> => {
    if (!this.started) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
    await rm(this.runtimeFilePath, { force: true });
    this.started = false;
  };
}
