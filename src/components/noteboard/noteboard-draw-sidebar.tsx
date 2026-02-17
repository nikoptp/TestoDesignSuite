import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { NoteboardBrushType } from '../../shared/types';

const MAX_DRAW_SIZE = 64;

type NoteboardDrawSidebarProps = {
  isDrawingMode: boolean;
  drawingTool: 'pen' | 'brush' | 'eraser';
  drawingBrush: NoteboardBrushType;
  drawingSize: number;
  drawingOpacity: number;
  drawingColor: string;
  drawingPresetColors: string[];
  onCloseDrawingSidebar: () => void;
  onDrawingToolChange: (tool: 'pen' | 'brush' | 'eraser') => void;
  onDrawingBrushChange: (brush: NoteboardBrushType) => void;
  onDrawingColorChange: (color: string) => void;
  onDrawingSizeChange: (size: number) => void;
  onDrawingOpacityChange: (opacity: number) => void;
  onDrawingPresetColorChange: (index: number, color: string) => void;
};

export const NoteboardDrawSidebar = ({
  isDrawingMode,
  drawingTool,
  drawingBrush,
  drawingSize,
  drawingOpacity,
  drawingColor,
  drawingPresetColors,
  onCloseDrawingSidebar,
  onDrawingToolChange,
  onDrawingBrushChange,
  onDrawingColorChange,
  onDrawingSizeChange,
  onDrawingOpacityChange,
  onDrawingPresetColorChange,
}: NoteboardDrawSidebarProps): React.ReactElement => {
  const colorInputRefs = React.useRef<Array<HTMLInputElement | null>>([]);

  return (
    <AnimatePresence initial={false}>
      {isDrawingMode ? (
        <motion.aside
          className="noteboard-draw-sidebar"
          initial={{ opacity: 0, x: 14, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 12, scale: 0.98 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          <div className="draw-sidebar-header">
            <h3>Drawing</h3>
            <button onClick={onCloseDrawingSidebar}>Close</button>
          </div>

          <label className="settings-field">
            <span className="settings-field-label">Tool</span>
            <div className="tool-style-grid">
              <button
                type="button"
                className={`tool-style-option ${drawingTool === 'pen' ? 'active' : ''}`}
                onClick={() => {
                  onDrawingToolChange('pen');
                }}
              >
                <span className="tool-style-icon">
                  <i className="fa-solid fa-pen-nib"></i>
                </span>
                <span className="tool-style-name">Pen</span>
              </button>
              <button
                type="button"
                className={`tool-style-option ${drawingTool === 'brush' ? 'active' : ''}`}
                onClick={() => {
                  onDrawingToolChange('brush');
                  if (drawingBrush === 'pen') {
                    onDrawingBrushChange('marker');
                  }
                }}
              >
                <span className="tool-style-icon">
                  <i className="fa-solid fa-paintbrush"></i>
                </span>
                <span className="tool-style-name">Brush</span>
              </button>
              <button
                type="button"
                className={`tool-style-option ${drawingTool === 'eraser' ? 'active' : ''}`}
                onClick={() => onDrawingToolChange('eraser')}
              >
                <span className="tool-style-icon">
                  <i className="fa-solid fa-eraser"></i>
                </span>
                <span className="tool-style-name">Eraser</span>
              </button>
            </div>
          </label>

          {drawingTool !== 'eraser' ? (
            <>
              {drawingTool === 'brush' ? (
                <label className="settings-field">
                  <span className="settings-field-label">Brush Style</span>
                  <div className="brush-style-grid">
                    {(
                      [
                        { value: 'ink', label: 'Ink', className: 'ink' },
                        { value: 'marker', label: 'Marker', className: 'marker' },
                        { value: 'charcoal', label: 'Charcoal', className: 'charcoal' },
                      ] as Array<{
                        value: NoteboardBrushType;
                        label: string;
                        className: string;
                      }>
                    ).map((brushOption) => (
                      <button
                        key={brushOption.value}
                        type="button"
                        className={`brush-style-option ${
                          drawingBrush === brushOption.value ? 'active' : ''
                        }`}
                        onClick={() => onDrawingBrushChange(brushOption.value)}
                      >
                        <span className="brush-style-name">{brushOption.label}</span>
                        <svg className="brush-preview" viewBox="0 0 64 20" aria-hidden="true">
                          <path
                            className={`brush-preview-path ${brushOption.className}`}
                            d="M 6 14 C 16 2, 28 18, 42 6 C 50 0, 58 10, 62 8"
                            fill="none"
                          />
                        </svg>
                      </button>
                    ))}
                  </div>
                </label>
              ) : null}
              <label className="settings-field">
                <span className="settings-field-label">Preset Colors</span>
                <div className="preset-color-grid">
                  {drawingPresetColors.map((presetColor, index) => (
                    <React.Fragment key={`${index}-${presetColor}`}>
                      <button
                        type="button"
                        className={`preset-color-swatch ${drawingColor === presetColor ? 'active' : ''}`}
                        style={{ backgroundColor: presetColor }}
                        aria-label={`Use preset color ${index + 1}`}
                        title={`${presetColor} (double-click to edit)`}
                        onClick={() => onDrawingColorChange(presetColor)}
                        onDoubleClick={() => colorInputRefs.current[index]?.click()}
                      ></button>
                      <input
                        ref={(element) => {
                          colorInputRefs.current[index] = element;
                        }}
                        className="preset-color-hidden-input"
                        type="color"
                        value={presetColor}
                        onChange={(event) => {
                          onDrawingPresetColorChange(index, event.target.value);
                          onDrawingColorChange(event.target.value);
                        }}
                        aria-label={`Edit preset color ${index + 1}`}
                        tabIndex={-1}
                      />
                    </React.Fragment>
                  ))}
                </div>
              </label>
            </>
          ) : null}

          <label className="settings-field">
            <span className="settings-field-label">Size ({Math.round(drawingSize)})</span>
            <input
              className="settings-input"
              type="range"
              min={2}
              max={MAX_DRAW_SIZE}
              step={1}
              value={drawingSize}
              onChange={(event) => onDrawingSizeChange(Number(event.target.value))}
            />
          </label>

          {drawingTool !== 'eraser' ? (
            <label className="settings-field">
              <span className="settings-field-label">
                Opacity ({Math.round(drawingOpacity * 100)}%)
              </span>
              <input
                className="settings-input"
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={drawingOpacity}
                onChange={(event) => onDrawingOpacityChange(Number(event.target.value))}
              />
            </label>
          ) : null}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
};
