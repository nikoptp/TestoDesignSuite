import React from 'react';

type AiPrototypeSettingsPanelProps = {
  aiHasApiKey: boolean;
  aiIsBusy: boolean;
  aiStatusMessage: string;
  aiResponse: string;
  onSaveAiApiKey: (apiKey: string) => void;
  onClearAiApiKey: () => void;
  onAskAi: (prompt: string) => void;
};

export const AiPrototypeSettingsPanel = ({
  aiHasApiKey,
  aiIsBusy,
  aiStatusMessage,
  aiResponse,
  onSaveAiApiKey,
  onClearAiApiKey,
  onAskAi,
}: AiPrototypeSettingsPanelProps): React.ReactElement => {
  const [aiKeyDraft, setAiKeyDraft] = React.useState('');
  const [aiPromptDraft, setAiPromptDraft] = React.useState('');

  return (
    <div className="settings-theme-studio">
      <div className="settings-theme-studio-header">
        <span className="settings-field-label">AI Prototype (BYOK)</span>
      </div>
      <p className="settings-theme-studio-empty">
        Status: {aiHasApiKey ? 'API key configured' : 'No API key configured'}
      </p>
      {aiStatusMessage ? <p className="settings-theme-studio-empty">{aiStatusMessage}</p> : null}
      <div className="settings-theme-row">
        <input
          className="settings-input"
          type="password"
          value={aiKeyDraft}
          placeholder="Paste OpenAI API key"
          onChange={(event) => setAiKeyDraft(event.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            onSaveAiApiKey(aiKeyDraft);
            setAiKeyDraft('');
          }}
          disabled={!aiKeyDraft.trim() || aiIsBusy}
        >
          Save Key
        </button>
        <button type="button" onClick={onClearAiApiKey} disabled={!aiHasApiKey || aiIsBusy}>
          Clear Key
        </button>
      </div>
      <label className="settings-field">
        <span className="settings-field-label">Ask</span>
        <textarea
          className="settings-input"
          rows={4}
          value={aiPromptDraft}
          placeholder="Ask for help with the active node..."
          onChange={(event) => setAiPromptDraft(event.target.value)}
        />
      </label>
      <div className="dialog-actions">
        <button
          type="button"
          onClick={() => onAskAi(aiPromptDraft)}
          disabled={!aiPromptDraft.trim() || !aiHasApiKey || aiIsBusy}
        >
          {aiIsBusy ? 'Asking...' : 'Ask AI'}
        </button>
      </div>
      {aiResponse ? (
        <pre className="settings-theme-studio-empty" style={{ whiteSpace: 'pre-wrap' }}>
          {aiResponse}
        </pre>
      ) : null}
    </div>
  );
};
