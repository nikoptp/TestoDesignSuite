export const NOTEBOARD_OVERLAY_BLOCKED_SELECTORS = [
  '.noteboard-toolbar',
  '.noteboard-draw-sidebar',
  '.noteboard-template-sidebar',
  '.canvas-context-menu',
  '.card-context-menu',
  '.color-quick-menu',
].join(', ');

export const NOTEBOARD_CARD_BLOCKED_SELECTORS = `${NOTEBOARD_OVERLAY_BLOCKED_SELECTORS}, .noteboard-card, .card-textarea`;

export const NOTEBOARD_CANVAS_POINTER_BLOCKED_SELECTORS = [
  '.noteboard-card',
  '.noteboard-toolbar',
  '.noteboard-draw-sidebar',
  '.noteboard-template-sidebar',
  '.canvas-context-menu',
  '.color-quick-menu',
].join(', ');

export const NOTEBOARD_TEMPLATE_DROP_BLOCKED_SELECTORS = [
  '.noteboard-toolbar',
  '.noteboard-draw-sidebar',
  '.noteboard-template-sidebar',
  '.canvas-context-menu',
  '.noteboard-card',
  '.card-textarea',
].join(', ');
