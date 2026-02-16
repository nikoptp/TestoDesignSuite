import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { ProjectImageAsset } from '../../shared/types';
import { ImageAssetSidebar } from '../image-asset-sidebar';

type ContextMenuState = {
  screenX: number;
  screenY: number;
} | null;

type QuickColorMenuState = {
  x: number;
  y: number;
} | null;

type TemplateDragState = {
  templateId: string;
  label: string;
  clientX: number;
  clientY: number;
} | null;

type CardContextMenuState = {
  cardId: string;
  screenX: number;
  screenY: number;
} | null;

type CursorWorldState = {
  x: number;
  y: number;
  visible: boolean;
};

type NoteboardOverlaysProps = {
  isDrawingMode: boolean;
  cardTemplates: Array<{ id: string; label: string; isCustom?: boolean }>;
  imageAssets: ProjectImageAsset[];
  editingTemplateId: string | null;
  editingTemplateName: string;
  templateDrag: TemplateDragState;
  contextMenu: ContextMenuState;
  cardContextMenu: CardContextMenuState;
  contextMenuCardColor: string | null;
  cardColorPresets: string[];
  quickColorMenu: QuickColorMenuState;
  drawingPresetColors: string[];
  drawingColor: string;
  cursorWorld: CursorWorldState;
  onSetEditingTemplateId: (value: string | null) => void;
  onSetEditingTemplateName: (value: string) => void;
  onBeginTemplateDrag: (templateId: string, label: string, clientX: number, clientY: number) => void;
  onRenameCardTemplate: (templateId: string, name: string) => void;
  onDeleteCardTemplate: (templateId: string) => void;
  onDeleteImageAsset: (relativePath: string) => void;
  onCreateCardAtContextMenu: () => void;
  onPasteTextAtContextMenu: () => void;
  onSaveCardAsTemplateFromContext: (cardId: string) => void;
  onCardColorChangeFromContext: (cardId: string, color: string) => void;
  onDeleteCardFromContext: (cardId: string) => void;
  onQuickColorEnter: (color: string) => void;
  onQuickColorLeave: (color: string) => void;
};

export const NoteboardOverlays = ({
  isDrawingMode,
  cardTemplates,
  imageAssets,
  editingTemplateId,
  editingTemplateName,
  templateDrag,
  contextMenu,
  cardContextMenu,
  contextMenuCardColor,
  cardColorPresets,
  quickColorMenu,
  drawingPresetColors,
  drawingColor,
  cursorWorld,
  onSetEditingTemplateId,
  onSetEditingTemplateName,
  onBeginTemplateDrag,
  onRenameCardTemplate,
  onDeleteCardTemplate,
  onDeleteImageAsset,
  onCreateCardAtContextMenu,
  onPasteTextAtContextMenu,
  onSaveCardAsTemplateFromContext,
  onCardColorChangeFromContext,
  onDeleteCardFromContext,
  onQuickColorEnter,
  onQuickColorLeave,
}: NoteboardOverlaysProps): React.ReactElement => {
  return (
    <>
      <AnimatePresence initial={false}>
        {!isDrawingMode ? (
          <motion.aside
            className="noteboard-template-sidebar"
            initial={{ opacity: 0, x: 14, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 12, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <section className="template-sidebar-section">
              <div className="draw-sidebar-header">
                <h3>Templates</h3>
              </div>
              <p className="template-sidebar-hint">Drag a template to the board</p>
              <div className="template-list">
                {cardTemplates.map((template) => (
                  <div key={`sidebar-${template.id}`} className="template-item-row">
                    {editingTemplateId === template.id ? (
                      <input
                        className="settings-input template-rename-input"
                        value={editingTemplateName}
                        autoFocus
                        maxLength={48}
                        onChange={(event) => onSetEditingTemplateName(event.target.value)}
                        onBlur={() => {
                          const nextName = editingTemplateName.trim();
                          if (nextName) {
                            onRenameCardTemplate(template.id, nextName);
                          }
                          onSetEditingTemplateId(null);
                          onSetEditingTemplateName('');
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            const nextName = editingTemplateName.trim();
                            if (nextName) {
                              onRenameCardTemplate(template.id, nextName);
                            }
                            onSetEditingTemplateId(null);
                            onSetEditingTemplateName('');
                          } else if (event.key === 'Escape') {
                            onSetEditingTemplateId(null);
                            onSetEditingTemplateName('');
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="template-item"
                        onPointerDown={(event) => {
                          if (template.isCustom && event.detail > 1) {
                            return;
                          }
                          onBeginTemplateDrag(
                            template.id,
                            template.label,
                            event.clientX,
                            event.clientY,
                          );
                          event.preventDefault();
                        }}
                        onDoubleClick={() => {
                          if (!template.isCustom) {
                            return;
                          }
                          onSetEditingTemplateId(template.id);
                          onSetEditingTemplateName(template.label);
                        }}
                      >
                        {template.label}
                      </button>
                    )}
                    {template.isCustom ? (
                      <button
                        type="button"
                        className="template-delete-btn"
                        onClick={() => onDeleteCardTemplate(template.id)}
                        title="Delete template"
                        aria-label="Delete template"
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
            <ImageAssetSidebar assets={imageAssets} onDeleteAsset={onDeleteImageAsset} />
            <div className="template-sidebar-end-spacer" aria-hidden="true">
              &nbsp;
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {contextMenu ? (
          <motion.div
            className="canvas-context-menu"
            style={{ left: `${contextMenu.screenX}px`, top: `${contextMenu.screenY}px` }}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
          >
            <button className="context-menu-item" onClick={onCreateCardAtContextMenu}>
              <i className="fa-solid fa-note-sticky"></i>
              <span>Create Card Here</span>
            </button>
            <button className="context-menu-item" onClick={onPasteTextAtContextMenu}>
              <i className="fa-solid fa-paste"></i>
              <span>Paste Here</span>
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {cardContextMenu ? (
          <motion.div
            className="card-context-menu"
            style={{ left: `${cardContextMenu.screenX}px`, top: `${cardContextMenu.screenY}px` }}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
          >
            <button
              className="context-menu-item"
              onClick={() => onSaveCardAsTemplateFromContext(cardContextMenu.cardId)}
            >
              <i className="fa-solid fa-bookmark"></i>
              <span>Save As Template</span>
            </button>
            <div className="card-context-colors">
              {cardColorPresets.map((presetColor, index) => (
                <button
                  key={`${cardContextMenu.cardId}-color-${index}`}
                  type="button"
                  className={`card-color-swatch ${contextMenuCardColor === presetColor ? 'active' : ''}`}
                  style={{ backgroundColor: presetColor }}
                  onClick={() => onCardColorChangeFromContext(cardContextMenu.cardId, presetColor)}
                  aria-label={`Set card color ${presetColor}`}
                  title={presetColor}
                ></button>
              ))}
            </div>
            <button
              className="context-menu-item"
              onClick={() => onDeleteCardFromContext(cardContextMenu.cardId)}
            >
              <i className="fa-solid fa-trash"></i>
              <span>Delete Card</span>
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {quickColorMenu && isDrawingMode ? (
          <motion.div
            className="color-quick-menu"
            style={{ left: `${quickColorMenu.x}px`, top: `${quickColorMenu.y}px` }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
          >
            {drawingPresetColors.map((presetColor, index) => (
              <button
                key={`${index}-${presetColor}`}
                type="button"
                className={`quick-color-swatch ${drawingColor === presetColor ? 'active' : ''}`}
                style={{ backgroundColor: presetColor }}
                onPointerEnter={() => onQuickColorEnter(presetColor)}
                onPointerLeave={() => onQuickColorLeave(presetColor)}
                aria-label={`Use color ${presetColor}`}
                title={presetColor}
              ></button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {templateDrag ? (
          <motion.div
            className="template-drag-ghost"
            style={{ left: `${templateDrag.clientX}px`, top: `${templateDrag.clientY}px` }}
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
          >
            {templateDrag.label}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {cursorWorld.visible ? (
        <div className="cursor-coordinate-hud" aria-hidden="true">
          {Math.round(cursorWorld.x)}, {Math.round(cursorWorld.y)}
        </div>
      ) : null}
    </>
  );
};
