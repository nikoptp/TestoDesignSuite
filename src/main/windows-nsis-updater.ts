import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { ReleaseAsset } from './update-utils';
import { parseChecksumManifest } from './update-utils';

type DownloadAssetInput = {
  asset: ReleaseAsset;
  userAgent: string;
  destinationDir: string;
};

type DownloadedAsset = {
  asset: ReleaseAsset;
  localPath: string;
};

const safeFileName = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'download.bin';
  }
  return trimmed.replace(/[\\/:*?"<>|]/g, '_');
};

const sha256ForFile = async (filePath: string): Promise<string> => {
  const buffer = await readFile(filePath);
  return createHash('sha256').update(buffer).digest('hex');
};

export const downloadReleaseAsset = async ({
  asset,
  userAgent,
  destinationDir,
}: DownloadAssetInput): Promise<DownloadedAsset> => {
  await mkdir(destinationDir, { recursive: true });
  const response = await fetch(asset.downloadUrl, {
    headers: {
      Accept: 'application/octet-stream',
      'User-Agent': userAgent,
    },
  });

  if (!response.ok) {
    throw new Error(`Asset download failed (${response.status}): ${asset.name}`);
  }

  const bytes = await response.arrayBuffer();
  const localPath = path.join(destinationDir, safeFileName(asset.name));
  await writeFile(localPath, Buffer.from(bytes));
  return {
    asset,
    localPath,
  };
};

export const verifyDownloadedInstallerChecksum = async (
  installerPath: string,
  checksumManifestPath: string,
): Promise<void> => {
  const manifestContent = await readFile(checksumManifestPath, 'utf8');
  const expectedHash = parseChecksumManifest(manifestContent);
  if (!expectedHash) {
    throw new Error('Checksum manifest is invalid.');
  }
  const actualHash = await sha256ForFile(installerPath);
  if (actualHash !== expectedHash) {
    throw new Error('Installer checksum mismatch.');
  }
};

export const launchSilentWindowsInstaller = async (installerPath: string): Promise<void> => {
  const installerPathForCmd = installerPath.replace(/"/g, '""');
  const launcherPath = path.join(path.dirname(installerPath), 'run-installer-update.cmd');
  const launcherScript = [
    '@echo off',
    'setlocal',
    'timeout /t 2 /nobreak >nul',
    `start "" "${installerPathForCmd}" /S`,
  ].join('\r\n');

  await writeFile(launcherPath, launcherScript, 'utf8');

  const commandShell = process.env.ComSpec ?? 'cmd.exe';
  const runner = spawn(commandShell, ['/c', launcherPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  runner.unref();
};
