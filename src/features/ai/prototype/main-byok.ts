import type { IpcMain } from 'electron';
import { access, mkdir, readFile, rename, writeFile, copyFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

type AiConfig = {
  openAiApiKey: string;
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const createBackupPath = (backupDir: string, filePath: string): string => {
  const parsed = path.parse(filePath);
  return path.join(backupDir, `${parsed.base}.${Date.now()}.bak`);
};

const maybeBackupFile = async (filePath: string, backupDir: string): Promise<void> => {
  if (!(await fileExists(filePath))) {
    return;
  }
  await mkdir(backupDir, { recursive: true });
  const backupPath = createBackupPath(backupDir, filePath);
  await copyFile(filePath, backupPath);
};

const safeWriteFile = async (
  filePath: string,
  content: string | Uint8Array,
  backupDir: string,
): Promise<void> => {
  const folderPath = path.dirname(filePath);
  await mkdir(folderPath, { recursive: true });
  await maybeBackupFile(filePath, backupDir);
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, content);
  await rename(tempPath, filePath);
};

const findNewestBackup = async (
  filePath: string,
  backupDir: string,
): Promise<string | null> => {
  if (!(await fileExists(backupDir))) {
    return null;
  }
  const base = path.parse(filePath).base;
  const entries = await readdir(backupDir, { withFileTypes: true });
  const candidates = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(`${base}.`) && entry.name.endsWith('.bak'))
    .map((entry) => path.join(backupDir, entry.name));
  if (candidates.length === 0) {
    return null;
  }
  let newest: { filePath: string; mtime: number } | null = null;
  for (const candidate of candidates) {
    const metadata = await stat(candidate);
    if (!newest || metadata.mtimeMs > newest.mtime) {
      newest = {
        filePath: candidate,
        mtime: metadata.mtimeMs,
      };
    }
  }
  return newest?.filePath ?? null;
};

const loadJsonWithBackup = async <T>(
  filePath: string,
  backupDir: string,
): Promise<T | null> => {
  try {
    const contents = await readFile(filePath, 'utf-8');
    return JSON.parse(contents) as T;
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      return null;
    }

    const backupPath = await findNewestBackup(filePath, backupDir);
    if (!backupPath) {
      throw error;
    }

    const backupContents = await readFile(backupPath, 'utf-8');
    return JSON.parse(backupContents) as T;
  }
};

const collectTextFromResponseOutput = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (!Array.isArray(value)) {
    return '';
  }
  const chunks: string[] = [];
  value.forEach((item) => {
    if (typeof item !== 'object' || item === null) {
      return;
    }
    const outputItem = item as { content?: unknown };
    if (!Array.isArray(outputItem.content)) {
      return;
    }
    outputItem.content.forEach((contentItem) => {
      if (typeof contentItem !== 'object' || contentItem === null) {
        return;
      }
      const textValue = (contentItem as { text?: unknown }).text;
      if (typeof textValue === 'string' && textValue.trim()) {
        chunks.push(textValue.trim());
      }
    });
  });
  return chunks.join('\n\n');
};

export const registerByokAiPrototypeIpc = ({
  ipcMain,
  dataDir,
}: {
  ipcMain: IpcMain;
  dataDir: string;
}): void => {
  const aiConfigPath = path.join(dataDir, 'ai-config.json');
  const backupDir = path.join(dataDir, 'backups');

  const loadAiConfig = async (): Promise<AiConfig | null> => {
    const loaded = await loadJsonWithBackup<AiConfig>(aiConfigPath, backupDir);
    if (!loaded || typeof loaded.openAiApiKey !== 'string') {
      return null;
    }
    const openAiApiKey = loaded.openAiApiKey.trim();
    if (!openAiApiKey) {
      return null;
    }
    return { openAiApiKey };
  };

  const saveAiConfig = async (config: AiConfig): Promise<void> => {
    await safeWriteFile(aiConfigPath, JSON.stringify(config, null, 2), backupDir);
  };

  const clearAiConfig = async (): Promise<void> => {
    if (!(await fileExists(aiConfigPath))) {
      return;
    }
    await rename(aiConfigPath, `${aiConfigPath}.deleted-${Date.now()}`);
  };

  const askAiWithByok = async (input: {
    prompt: string;
    context?: string;
  }): Promise<{ text: string }> => {
    const prompt = input.prompt.trim();
    if (!prompt) {
      throw new Error('Prompt is required.');
    }
    const aiConfig = await loadAiConfig();
    if (!aiConfig) {
      throw new Error('No API key found. Add your key in Settings.');
    }

    const contextText = typeof input.context === 'string' ? input.context.trim() : '';
    const userMessage = contextText
      ? `Context:\n${contextText}\n\nRequest:\n${prompt}`
      : prompt;
    const fetchFn = globalThis.fetch as
      | ((url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<Response>)
      | undefined;
    if (typeof fetchFn !== 'function') {
      throw new Error('Fetch API is unavailable in this runtime.');
    }

    const response = await fetchFn('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${aiConfig.openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content:
              'You are an assistant inside a game design editor. Keep answers concise and actionable.',
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
        max_output_tokens: 700,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const safeBody = errorBody.slice(0, 240);
      throw new Error(`AI request failed (${response.status}): ${safeBody}`);
    }

    const data = (await response.json()) as {
      output_text?: unknown;
      output?: unknown;
    };
    const text =
      (typeof data.output_text === 'string' ? data.output_text.trim() : '') ||
      collectTextFromResponseOutput(data.output).trim();
    if (!text) {
      throw new Error('AI returned an empty response.');
    }
    return { text };
  };

  ipcMain.handle('ai:key-status', async () => {
    const config = await loadAiConfig();
    return { hasApiKey: Boolean(config?.openAiApiKey) };
  });
  ipcMain.handle('ai:set-api-key', async (_event, apiKey: string) => {
    const trimmed = typeof apiKey === 'string' ? apiKey.trim() : '';
    if (!trimmed) {
      throw new Error('API key is required.');
    }
    await saveAiConfig({ openAiApiKey: trimmed });
  });
  ipcMain.handle('ai:clear-api-key', async () => {
    await clearAiConfig();
  });
  ipcMain.handle(
    'ai:ask',
    async (
      _event,
      input: {
        prompt: string;
        context?: string;
      },
    ) => askAiWithByok(input),
  );
};
