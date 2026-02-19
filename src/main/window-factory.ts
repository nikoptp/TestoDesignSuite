import { BrowserWindow, app, nativeImage } from 'electron';

type CreateMainWindowInput = {
  windowEntry: string;
  preloadEntry: string;
  windowIconPath: string;
};

export const createMainWindow = ({
  windowEntry,
  preloadEntry,
  windowIconPath,
}: CreateMainWindowInput): BrowserWindow => {
  const windowIcon = nativeImage.createFromPath(windowIconPath);
  const mainWindow = new BrowserWindow({
    height: 1080,
    width: 1920,
    icon: windowIcon.isEmpty() ? undefined : windowIcon,
    webPreferences: {
      preload: preloadEntry,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.loadURL(windowEntry);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  return mainWindow;
};

export const applyMacDockIcon = (windowIconPath: string): void => {
  const windowIcon = nativeImage.createFromPath(windowIconPath);
  if (process.platform === 'darwin' && !windowIcon.isEmpty()) {
    app.dock.setIcon(windowIcon);
  }
};
