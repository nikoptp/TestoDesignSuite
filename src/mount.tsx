import './index.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';

export const mountReactApp = (): void => {
  const app = document.getElementById('app');
  if (!app) {
    throw new Error('App root element not found');
  }

  const root = createRoot(app);
  root.render(<App />);
};
