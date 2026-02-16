import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CategoryNode, EditorType } from '../shared/types';
import { editorTypeMeta } from '../shared/editor-types';

type DocTemplate = {
  id: string;
  label: string;
  markdown: string;
  editorTypes?: EditorType[];
};

const DOC_TEMPLATES: DocTemplate[] = [
  {
    id: 'gdd',
    label: 'GDD Starter',
    markdown:
      '# Game Design Document\n\n## Elevator Pitch\n\n## Core Pillars\n- \n- \n- \n\n## Core Loop\n1. \n2. \n3. \n\n## Target Audience\n\n## Platforms\n\n## Scope (MVP)\n- Must Have:\n- Nice to Have:\n\n## Risks\n- \n',
    editorTypes: ['story-document', 'level-design'],
  },
  {
    id: 'quest-spec',
    label: 'Quest Spec',
    markdown:
      '# Quest Spec\n\n## Summary\n\n## Prerequisites\n- \n\n## Objectives\n- [ ] \n\n## NPCs\n| Name | Role |\n|---|---|\n|  |  |\n\n## Rewards\n- XP:\n- Items:\n',
    editorTypes: ['story-document', 'lore-document'],
  },
  {
    id: 'lore-entry',
    label: 'Lore Entry',
    markdown:
      '# Lore Entry\n\n## Name\n\n## Origin\n\n## Factions / Connections\n- \n\n## Known Facts\n- \n\n## Open Questions\n- \n',
    editorTypes: ['lore-document', 'story-document'],
  },
  {
    id: 'level-brief',
    label: 'Level Brief',
    markdown:
      '# Level Brief\n\n## Intent\n\n## Player Experience Goals\n- \n\n## Key Spaces\n- \n\n## Encounter Beats\n1. \n2. \n3. \n\n## Metrics\n- Target completion:\n- Fail states:\n',
    editorTypes: ['level-design', 'map-sketch'],
  },
];

type DocumentEditorProps = {
  node: CategoryNode;
  markdown: string;
  onMarkdownChange: (value: string) => void;
  onMarkdownEditStart: () => void;
  onMarkdownEditEnd: () => void;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const DocumentEditor = ({
  node,
  markdown,
  onMarkdownChange,
  onMarkdownEditStart,
  onMarkdownEditEnd,
}: DocumentEditorProps): React.ReactElement => {
  const [mode, setMode] = React.useState<'preview' | 'edit'>('preview');
  const [splitRatio, setSplitRatio] = React.useState(50);
  const [templateId, setTemplateId] = React.useState('gdd');
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const availableTemplates = React.useMemo(
    () =>
      DOC_TEMPLATES.filter(
        (template) =>
          !template.editorTypes || template.editorTypes.length === 0 || template.editorTypes.includes(node.editorType),
      ),
    [node.editorType],
  );

  React.useEffect(() => {
    if (availableTemplates.length === 0) {
      setTemplateId('');
      return;
    }
    if (!availableTemplates.some((template) => template.id === templateId)) {
      setTemplateId(availableTemplates[0].id);
    }
  }, [availableTemplates, templateId]);

  const applyMarkdownEdit = React.useCallback(
    (
      transform: (source: string, selectionStart: number, selectionEnd: number) => {
        text: string;
        selectionStart: number;
        selectionEnd: number;
      },
    ): void => {
      const textarea = textareaRef.current;
      const source = markdown;
      const start = textarea?.selectionStart ?? source.length;
      const end = textarea?.selectionEnd ?? source.length;
      const next = transform(source, start, end);
      onMarkdownChange(next.text);
      window.requestAnimationFrame(() => {
        const element = textareaRef.current;
        if (!element) {
          return;
        }
        element.focus();
        element.setSelectionRange(next.selectionStart, next.selectionEnd);
      });
    },
    [markdown, onMarkdownChange],
  );

  const wrapSelection = React.useCallback(
    (prefix: string, suffix: string): void => {
      applyMarkdownEdit((source, start, end) => {
        const selected = source.slice(start, end);
        const text = `${source.slice(0, start)}${prefix}${selected}${suffix}${source.slice(end)}`;
        return {
          text,
          selectionStart: start + prefix.length,
          selectionEnd: start + prefix.length + selected.length,
        };
      });
    },
    [applyMarkdownEdit],
  );

  const insertBlock = React.useCallback(
    (block: string): void => {
      applyMarkdownEdit((source, start, end) => {
        const before = source.slice(0, start);
        const after = source.slice(end);
        const needsLeadingBreak = before.length > 0 && !before.endsWith('\n');
        const needsTrailingBreak = after.length > 0 && !after.startsWith('\n');
        const injected = `${needsLeadingBreak ? '\n' : ''}${block}${needsTrailingBreak ? '\n' : ''}`;
        const text = `${before}${injected}${after}`;
        const caret = before.length + injected.length;
        return {
          text,
          selectionStart: caret,
          selectionEnd: caret,
        };
      });
    },
    [applyMarkdownEdit],
  );

  const onInsertTemplate = React.useCallback(() => {
    const template = availableTemplates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }
    insertBlock(template.markdown);
  }, [availableTemplates, insertBlock, templateId]);

  const slugifyHeading = React.useCallback((value: string): string => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }, []);

  const headingWithAnchor = React.useCallback(
    (
      level: 1 | 2 | 3 | 4 | 5 | 6,
      children: React.ReactNode,
    ): React.ReactElement => {
      const text = React.Children.toArray(children)
        .map((child) => (typeof child === 'string' ? child : ''))
        .join(' ');
      const id = slugifyHeading(text) || `heading-${level}`;
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      return (
        <Tag id={id}>
          {children}
        </Tag>
      );
    },
    [slugifyHeading],
  );

  const onStartResize = React.useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    const onMove = (moveEvent: PointerEvent): void => {
      const nextRatio = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(clamp(nextRatio, 28, 72));
      moveEvent.preventDefault();
    };
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.classList.remove('is-resizing-doc-split');
    };

    document.body.classList.add('is-resizing-doc-split');
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp, { passive: false });
    event.preventDefault();
  }, []);

  return (
    <section className="document-editor">
      <header className="document-editor-header">
        <div>
          <h2>{node.name}</h2>
          <p className="editor-subtitle">Editor type: {editorTypeMeta(node.editorType).label}</p>
        </div>
        {mode === 'preview' ? (
          <button onClick={() => setMode('edit')}>Edit</button>
        ) : (
          <div className="document-template-controls">
            <select
              className="settings-input"
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
            >
              {availableTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </select>
            <button onClick={onInsertTemplate} disabled={!templateId}>
              Insert Template
            </button>
            <button onClick={() => setMode('preview')}>Done</button>
          </div>
        )}
      </header>

      {mode === 'edit' ? (
        <div
          className="document-toolbar"
          role="toolbar"
          aria-label="Markdown formatting tools"
        >
          <button onClick={() => insertBlock('# Heading')}>H1</button>
          <button onClick={() => insertBlock('## Section')}>H2</button>
          <button onClick={() => wrapSelection('**', '**')}>Bold</button>
          <button onClick={() => wrapSelection('_', '_')}>Italic</button>
          <button onClick={() => insertBlock('- List item')}>List</button>
          <button onClick={() => insertBlock('- [ ] Task')}>Checklist</button>
          <button onClick={() => insertBlock('> Quote')}>Quote</button>
          <button onClick={() => insertBlock('```\ncode\n```')}>Code</button>
        </div>
      ) : null}

      {mode === 'preview' ? (
        <div className="document-preview document-preview-full">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => headingWithAnchor(1, children),
              h2: ({ children }) => headingWithAnchor(2, children),
              h3: ({ children }) => headingWithAnchor(3, children),
              h4: ({ children }) => headingWithAnchor(4, children),
              h5: ({ children }) => headingWithAnchor(5, children),
              h6: ({ children }) => headingWithAnchor(6, children),
              a: ({ href, children, ...props }) => {
                const safeHref = typeof href === 'string' ? href.trim() : '';
                if (!safeHref) {
                  return <>{children}</>;
                }
                if (safeHref.startsWith('#')) {
                  return (
                    <a {...props} href={safeHref}>
                      {children}
                    </a>
                  );
                }
                return (
                  <a {...props} href={safeHref} target="_blank" rel="noreferrer">
                    {children}
                  </a>
                );
              },
            }}
          >
            {markdown.trim() ? markdown : '*Preview will appear here.*'}
          </ReactMarkdown>
        </div>
      ) : (
        <div
          className="document-workspace"
          ref={containerRef}
          style={{
            gridTemplateColumns: `${splitRatio}% 8px 1fr`,
          }}
        >
          <div className="document-pane">
            <div className="document-pane-title">Markdown</div>
            <textarea
              ref={textareaRef}
              className="document-textarea"
              value={markdown}
              placeholder="Start writing markdown..."
              onFocus={onMarkdownEditStart}
              onBlur={onMarkdownEditEnd}
              onChange={(event) => onMarkdownChange(event.target.value)}
            />
          </div>

          <div
            className="document-splitter"
            role="separator"
            aria-label="Resize editor and preview panes"
            onPointerDown={onStartResize}
          ></div>

          <div className="document-pane">
            <div className="document-pane-title">Preview</div>
            <div className="document-preview">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => headingWithAnchor(1, children),
                  h2: ({ children }) => headingWithAnchor(2, children),
                  h3: ({ children }) => headingWithAnchor(3, children),
                  h4: ({ children }) => headingWithAnchor(4, children),
                  h5: ({ children }) => headingWithAnchor(5, children),
                  h6: ({ children }) => headingWithAnchor(6, children),
                  a: ({ href, children, ...props }) => {
                    const safeHref = typeof href === 'string' ? href.trim() : '';
                    if (!safeHref) {
                      return <>{children}</>;
                    }
                    if (safeHref.startsWith('#')) {
                      return (
                        <a {...props} href={safeHref}>
                          {children}
                        </a>
                      );
                    }
                    return (
                      <a {...props} href={safeHref} target="_blank" rel="noreferrer">
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {markdown.trim() ? markdown : '*Preview will appear here.*'}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
