import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnimatePresence, motion } from 'motion/react';
import type { CategoryNode } from '../shared/types';
import { editorTypeMeta } from '../shared/editor-types';
import { startWindowPointerSession } from '../shared/pointer-session';

type DocTemplate = {
  id: string;
  label: string;
  markdown: string;
};

const DOC_TEMPLATES: DocTemplate[] = [
  {
    id: 'gdd',
    label: 'GDD Starter',
    markdown:
      '# Game Design Document\n\nUse this template to capture a production-ready game concept. Fill each field with concrete details and examples.\n\n## Table of Contents\n- [Project Overview](#project-overview)\n- [Vision and Pillars](#vision-and-pillars)\n- [Player Experience](#player-experience)\n- [Gameplay Systems](#gameplay-systems)\n- [Content and Progression](#content-and-progression)\n- [World and Narrative](#world-and-narrative)\n- [Audio and Visual Direction](#audio-and-visual-direction)\n- [Technical Plan](#technical-plan)\n- [Production Plan](#production-plan)\n- [Go To Market](#go-to-market)\n- [Open Questions and Risks](#open-questions-and-risks)\n\n---\n\n## Project Overview\n### Working Title\nDescription: Current project name used internally.\n- Value:\n\n### Elevator Pitch\nDescription: One or two sentences describing the fantasy, genre, and hook.\n- Value:\n\n### Genre and Format\nDescription: Define genre, camera, player count, and session style.\n- Genre:\n- Camera:\n- Mode:\n- Typical session length:\n\n### Target Platforms\nDescription: List launch and post-launch platforms.\n- Primary:\n- Secondary:\n\n### Target Release Window\nDescription: Planned release quarter/year and confidence.\n- Window:\n- Confidence (High/Medium/Low):\n\n---\n\n## Vision and Pillars\n### Product Vision\nDescription: What the game should become for players and the market.\n- Value:\n\n### Core Pillars\nDescription: 3-5 non-negotiable design truths used for feature decisions.\n- Pillar 1:\n- Pillar 2:\n- Pillar 3:\n\n### Success Metrics\nDescription: How success is measured (business + player outcomes).\n- Retention target:\n- Review target:\n- Revenue target:\n\n---\n\n## Player Experience\n### Target Audience\nDescription: Primary and secondary player segments.\n- Primary segment:\n- Secondary segment:\n\n### Player Fantasy\nDescription: What players should feel, do, and become in the game.\n- Value:\n\n### Experience Goals\nDescription: Desired emotional beats across onboarding, mid-game, and end-game.\n- First 30 minutes:\n- Mid-game:\n- End-game:\n\n---\n\n## Gameplay Systems\n### Core Gameplay Loop\nDescription: Repeatable minute-to-minute loop.\n1. Trigger:\n2. Player action:\n3. Reward:\n4. Upgrade/decision:\n\n### Meta Progression Loop\nDescription: Long-term progression and replay motivation.\n1. Short-term goal:\n2. Mid-term goal:\n3. Long-term goal:\n\n### Controls and Input\nDescription: Core actions and platform-specific control notes.\n- Move:\n- Interact:\n- Combat/primary action:\n- Special actions:\n\n### Systems Breakdown\nDescription: Explain each major system and dependencies.\n#### Combat or Interaction System\n- Purpose:\n- Inputs:\n- Tuning levers:\n- Failure states:\n\n#### Economy and Resources\n- Currencies/resources:\n- Sources/sinks:\n- Anti-inflation controls:\n\n#### AI or Encounter Design\n- Enemy/NPC archetypes:\n- Encounter pacing:\n- Difficulty scaling approach:\n\n---\n\n## Content and Progression\n### Content Structure\nDescription: How content is packaged (levels, regions, missions, acts).\n- Structure:\n\n### Progression Model\nDescription: Player power, unlock paths, and gating rules.\n- Player level/power model:\n- Unlock conditions:\n- Hard gates:\n\n### Difficulty and Balancing\nDescription: Tuning philosophy and balancing process.\n- Difficulty modes:\n- Dynamic difficulty rules:\n- Telemetry used for balance:\n\n---\n\n## World and Narrative\n### Setting Summary\nDescription: Time, place, tone, and thematic identity.\n- Value:\n\n### Narrative Structure\nDescription: Story format and delivery method.\n- Structure (linear/branching/hybrid):\n- Story delivery (cutscenes, dialogue, logs, etc.):\n\n### Key Characters or Factions\nDescription: Main cast and conflict roles.\n- Character/Faction A:\n- Character/Faction B:\n- Character/Faction C:\n\n---\n\n## Audio and Visual Direction\n### Art Direction\nDescription: Style, references, and readability rules.\n- Style keywords:\n- Reference titles:\n- Readability constraints:\n\n### UI and UX Principles\nDescription: Information hierarchy and interaction principles.\n- HUD principles:\n- Menu principles:\n- Accessibility defaults:\n\n### Audio Direction\nDescription: Music and sound goals per gameplay state.\n- Music pillars:\n- SFX pillars:\n- Voice/dialogue approach:\n\n---\n\n## Technical Plan\n### Engine and Tools\nDescription: Main technologies, pipeline tools, and key plugins.\n- Engine:\n- Toolchain:\n- Key dependencies:\n\n### Performance Targets\nDescription: Minimum acceptable performance by platform.\n- FPS target:\n- Resolution target:\n- Memory budget:\n- Load time budget:\n\n### Architecture Notes\nDescription: Technical constraints affecting design decisions.\n- Networking:\n- Save system:\n- Content pipeline:\n\n---\n\n## Production Plan\n### Team Composition\nDescription: Required disciplines and rough staffing plan.\n- Design:\n- Engineering:\n- Art:\n- Audio:\n- Production/QA:\n\n### Milestones\nDescription: Deliverables and decision gates.\n- Prototype milestone:\n- Vertical slice milestone:\n- Alpha milestone:\n- Beta milestone:\n\n### Scope Definition\nDescription: Must/should/could scope boundaries.\n- Must Have:\n- Should Have:\n- Could Have:\n- Wont Have (for this release):\n\n---\n\n## Go To Market\n### Positioning\nDescription: Competitive space and unique differentiation.\n- Comparable titles:\n- Unique selling points:\n\n### Business Model\nDescription: Pricing and monetization structure.\n- Price:\n- Monetization:\n- Post-launch content approach:\n\n### Launch Plan\nDescription: Marketing beats and publishing dependencies.\n- Announcement plan:\n- Community plan:\n- Platform/store requirements:\n\n---\n\n## Open Questions and Risks\n### Open Questions\nDescription: Unknowns requiring validation.\n- Question 1:\n- Question 2:\n- Question 3:\n\n### Risks and Mitigations\nDescription: Top production, technical, and market risks.\n| Risk | Impact | Likelihood | Mitigation |\n|---|---|---|---|\n|  |  |  |  |\n|  |  |  |  |\n\n### Assumptions to Validate\nDescription: Critical assumptions that can fail.\n- Assumption 1:\n- Assumption 2:\n- Assumption 3:\n',
  },
  {
    id: 'quest-spec',
    label: 'Quest Spec',
    markdown:
      '# Quest Spec\n\n## Summary\n\n## Prerequisites\n- \n\n## Objectives\n- [ ] \n\n## NPCs\n| Name | Role |\n|---|---|\n|  |  |\n\n## Rewards\n- XP:\n- Items:\n',
  },
  {
    id: 'lore-entry',
    label: 'Lore Entry',
    markdown:
      '# Lore Entry\n\n## Name\n\n## Origin\n\n## Factions / Connections\n- \n\n## Known Facts\n- \n\n## Open Questions\n- \n',
  },
  {
    id: 'level-brief',
    label: 'Level Brief',
    markdown:
      '# Level Brief\n\n## Intent\n\n## Player Experience Goals\n- \n\n## Key Spaces\n- \n\n## Encounter Beats\n1. \n2. \n3. \n\n## Metrics\n- Target completion:\n- Fail states:\n',
  },
];

type DocumentEditorProps = {
  node: CategoryNode;
  markdown: string;
  onMarkdownChange: (value: string, source?: 'typing' | 'quick-action') => void;
  onMarkdownEditStart: () => void;
  onMarkdownEditEnd: () => void;
};

type TocEntry = {
  id: string;
  label: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
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
    () => DOC_TEMPLATES,
    [],
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

  React.useEffect(() => {
    setMode('preview');
  }, [node.id]);

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
      onMarkdownChange(next.text, 'quick-action');
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

  const normalizeHeadingLabel = React.useCallback((value: string): string => {
    return value
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[*_~]/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const extractTextFromNode = React.useCallback((value: React.ReactNode): string => {
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map((child) => extractTextFromNode(child)).join(' ');
    }
    if (React.isValidElement(value)) {
      const props = value.props as { children?: React.ReactNode };
      return extractTextFromNode(props.children ?? '');
    }
    return '';
  }, []);

  const tocEntries = React.useMemo<TocEntry[]>(() => {
    const entries: TocEntry[] = [];
    const slugCounts = new Map<string, number>();
    const lines = markdown.split('\n');
    let inCodeFence = false;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (/^```/.test(trimmed)) {
        inCodeFence = !inCodeFence;
        return;
      }
      if (inCodeFence) {
        return;
      }

      const match = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (!match) {
        return;
      }

      const level = match[1].length as TocEntry['level'];
      const rawLabel = match[2].replace(/\s+#+\s*$/, '').trim();
      const label = normalizeHeadingLabel(rawLabel);
      if (!label) {
        return;
      }

      const baseSlug = slugifyHeading(label) || `heading-${level}`;
      const count = slugCounts.get(baseSlug) ?? 0;
      slugCounts.set(baseSlug, count + 1);
      const id = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;

      entries.push({ id, label, level });
    });

    return entries;
  }, [markdown, normalizeHeadingLabel, slugifyHeading]);

  const createMarkdownComponents = React.useCallback(() => {
    const slugCounts = new Map<string, number>();

    const headingWithAnchor = (
      level: 1 | 2 | 3 | 4 | 5 | 6,
      children: React.ReactNode,
    ): React.ReactElement => {
      const text = extractTextFromNode(children).trim();
      const baseSlug = slugifyHeading(text) || `heading-${level}`;
      const count = slugCounts.get(baseSlug) ?? 0;
      slugCounts.set(baseSlug, count + 1);
      const id = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
      const tagName = `h${level}` as `h${1 | 2 | 3 | 4 | 5 | 6}`;
      return React.createElement(tagName, { id }, children);
    };

    return {
      h1: ({ children }: { children?: React.ReactNode }) => headingWithAnchor(1, children),
      h2: ({ children }: { children?: React.ReactNode }) => headingWithAnchor(2, children),
      h3: ({ children }: { children?: React.ReactNode }) => headingWithAnchor(3, children),
      h4: ({ children }: { children?: React.ReactNode }) => headingWithAnchor(4, children),
      h5: ({ children }: { children?: React.ReactNode }) => headingWithAnchor(5, children),
      h6: ({ children }: { children?: React.ReactNode }) => headingWithAnchor(6, children),
      a: ({
        href,
        children,
        ...props
      }: {
        href?: string;
        children?: React.ReactNode;
      } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
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
    };
  }, [extractTextFromNode, slugifyHeading]);

  const onStartResize = React.useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    let cleanupSession: (() => void) | null = null;
    const onMove = (moveEvent: PointerEvent): void => {
      const nextRatio = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(clamp(nextRatio, 28, 72));
      moveEvent.preventDefault();
    };
    const onUp = (): void => {
      cleanupSession?.();
      cleanupSession = null;
    };

    cleanupSession = startWindowPointerSession({
      onMove,
      onEnd: onUp,
      passive: false,
      bodyClassName: 'is-resizing-doc-split',
    });
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

      <AnimatePresence initial={false}>
        {mode === 'edit' ? (
          <motion.div
            key="doc-toolbar-edit"
            className="document-toolbar"
            role="toolbar"
            aria-label="Markdown formatting tools"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
          >
            <button onClick={() => insertBlock('# Heading')}>H1</button>
            <button onClick={() => insertBlock('## Section')}>H2</button>
            <button onClick={() => wrapSelection('**', '**')}>Bold</button>
            <button onClick={() => wrapSelection('_', '_')}>Italic</button>
            <button onClick={() => insertBlock('- List item')}>List</button>
            <button onClick={() => insertBlock('- [ ] Task')}>Checklist</button>
            <button onClick={() => insertBlock('> Quote')}>Quote</button>
            <button onClick={() => insertBlock('```\ncode\n```')}>Code</button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        {mode === 'preview' ? (
          <motion.div
            key="doc-mode-preview"
            className="document-preview-layout"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <div className="document-preview document-preview-full">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={createMarkdownComponents()}
              >
                {markdown.trim() ? markdown : '*Preview will appear here.*'}
              </ReactMarkdown>
            </div>
            <motion.aside
              className="document-toc-sidebar"
              aria-label="Table of contents"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              <h3 className="document-toc-title">Contents</h3>
              {tocEntries.length === 0 ? (
                <p className="document-toc-empty">Add headings to generate a table of contents.</p>
              ) : (
                <nav>
                  <ul className="document-toc-list">
                    {tocEntries.map((entry) => (
                      <li key={`${entry.id}-${entry.label}`} className="document-toc-item">
                        <a
                          className={`document-toc-link level-${entry.level}`}
                          href={`#${entry.id}`}
                          style={{ paddingLeft: `${(entry.level - 1) * 10 + 6}px` }}
                        >
                          {entry.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
            </motion.aside>
          </motion.div>
        ) : (
          <motion.div
            key="doc-mode-edit"
            className="document-workspace"
            ref={containerRef}
            style={{
              gridTemplateColumns: `${splitRatio}% 8px 1fr`,
            }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
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
                onChange={(event) => onMarkdownChange(event.target.value, 'typing')}
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
                  components={createMarkdownComponents()}
                >
                  {markdown.trim() ? markdown : '*Preview will appear here.*'}
                </ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};




