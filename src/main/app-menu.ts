import { Menu, app, type MenuItemConstructorOptions } from 'electron';

type AppMenuActions = {
  onNewProject: () => void;
  onOpenProjectFile: () => void;
  onSaveProjectFile: () => void;
  onSaveProjectFileAs: () => void;
  onOpenSettings: () => void;
  onCheckForUpdates: () => void;
};

export const buildAppMenu = (actions: AppMenuActions): void => {
  const viewMenu: MenuItemConstructorOptions['submenu'] = app.isPackaged
    ? [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ]
    : [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ];

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: actions.onNewProject,
        },
        { type: 'separator' },
        {
          label: 'Open Project File...',
          accelerator: 'CmdOrCtrl+O',
          click: actions.onOpenProjectFile,
        },
        {
          label: 'Save Project File',
          accelerator: 'CmdOrCtrl+S',
          click: actions.onSaveProjectFile,
        },
        {
          label: 'Save Project File As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: actions.onSaveProjectFileAs,
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: actions.onOpenSettings,
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: viewMenu,
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: actions.onCheckForUpdates,
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};
