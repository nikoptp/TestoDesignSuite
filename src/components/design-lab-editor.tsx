import React from 'react';
import type { CategoryNode, DesignLabRun, NodeWorkspaceData } from '../shared/types';
import { editorTypeMeta } from '../shared/editor-types';
import { runCoreLoopSimulator } from '../features/design-lab/calculators/core-loop-simulator';
import type { DesignLabCalculator } from '../features/design-lab/calculators/types';

type DesignLabEditorProps = {
  node: CategoryNode;
  designLab: NodeWorkspaceData['designLab'] | null;
  onCreateVariable: (name: string) => void;
  onVariableValueChange: (variableId: string, value: number) => void;
  onDeleteVariable: (variableId: string) => void;
  onCreateScenario: (name: string) => void;
  onRenameScenario: (scenarioId: string, name: string) => void;
  onDeleteScenario: (scenarioId: string) => void;
  onSetActiveScenario: (scenarioId: string) => void;
  onScenarioOverrideChange: (scenarioId: string, variableId: string, value: number) => void;
  onRunCalculator: (calculator: DesignLabCalculator) => void;
};

const formatMetric = (value: number | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-';

const formatDelta = (value: number | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) < 0.01) {
    return '0.00';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
};

const CORE_LOOP_VARIABLE_IDS = {
  friction: 'v-friction',
  challengeTime: 'v-challenge-time',
  rewardIntensity: 'v-reward-intensity',
  actionTime: 'v-action-time',
  rewardTime: 'v-reward-time',
} as const;

const CORE_LOOP_PRESETS: Array<{
  label: string;
  description: string;
  values: Record<string, number>;
}> = [
  {
    label: 'Balanced',
    description: 'General-purpose baseline for readable pacing.',
    values: {
      [CORE_LOOP_VARIABLE_IDS.friction]: 45,
      [CORE_LOOP_VARIABLE_IDS.challengeTime]: 3.4,
      [CORE_LOOP_VARIABLE_IDS.rewardIntensity]: 62,
      [CORE_LOOP_VARIABLE_IDS.actionTime]: 1.7,
      [CORE_LOOP_VARIABLE_IDS.rewardTime]: 1.1,
    },
  },
  {
    label: 'Arcade Fast',
    description: 'Short loop with fast challenge and strong reward.',
    values: {
      [CORE_LOOP_VARIABLE_IDS.friction]: 30,
      [CORE_LOOP_VARIABLE_IDS.challengeTime]: 2.4,
      [CORE_LOOP_VARIABLE_IDS.rewardIntensity]: 78,
      [CORE_LOOP_VARIABLE_IDS.actionTime]: 1.2,
      [CORE_LOOP_VARIABLE_IDS.rewardTime]: 0.7,
    },
  },
  {
    label: 'Tactical Slow',
    description: 'Longer challenge and downtime, lower reward pulse.',
    values: {
      [CORE_LOOP_VARIABLE_IDS.friction]: 62,
      [CORE_LOOP_VARIABLE_IDS.challengeTime]: 5.8,
      [CORE_LOOP_VARIABLE_IDS.rewardIntensity]: 54,
      [CORE_LOOP_VARIABLE_IDS.actionTime]: 2.5,
      [CORE_LOOP_VARIABLE_IDS.rewardTime]: 1.9,
    },
  },
];

const RunSummary = ({ run }: { run: DesignLabRun }): React.ReactElement => (
  <article className="kanban-card">
    <h3 className="kanban-card-title">{run.summary}</h3>
    <p className="editor-subtitle">Run at {new Date(run.createdAt).toLocaleTimeString()}</p>
    <div className="kanban-details-meta">
      <span>Engagement: {formatMetric(run.metricsByKey.engagementScore)}</span>
      <span>Loop(s): {formatMetric(run.metricsByKey.totalLoopTimeSec)}</span>
      <span>Reward/min: {formatMetric(run.metricsByKey.rewardPerMinute)}</span>
    </div>
  </article>
);

const valueWithScenarioOverride = (
  designLab: NonNullable<NodeWorkspaceData['designLab']>,
  variableId: string,
): number => {
  const variable = designLab.variables.find((item) => item.id === variableId);
  if (!variable) {
    return 0;
  }
  const activeScenario =
    designLab.scenarios.find((scenario) => scenario.id === designLab.activeScenarioId) ?? null;
  return activeScenario?.overridesByVariableId[variableId] ?? variable.value;
};

const CoreLoopStageField = ({
  title,
  caption,
  value,
  min,
  max,
  step,
  onChange,
}: {
  title: string;
  caption: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}): React.ReactElement => (
  <article className="design-lab-stage">
    <h3>{title}</h3>
    <p>{caption}</p>
    <div className="design-lab-stage-value">{formatMetric(value)}</div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
    <label className="kanban-details-field">
      <span>Exact value</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  </article>
);

const CORE_LOOP_GUIDE_STEPS: Array<{ title: string; description: string }> = [
  {
    title: '1) Write your loop in plain words',
    description: 'Example: Spawn -> Fight -> Loot -> Upgrade -> Repeat.',
  },
  {
    title: '2) Map each step to a generic stage',
    description: 'Fight = Challenge, Loot = Reward, Upgrade/Menu = Downtime.',
  },
  {
    title: '3) Estimate one average loop',
    description: 'Use rough timing and intensity values first, then iterate.',
  },
  {
    title: '4) Run simulation and compare deltas',
    description: 'Change one input at a time and watch Engagement, Loop Time, Reward/min.',
  },
];

export const DesignLabEditor = ({
  node,
  designLab,
  onCreateVariable,
  onVariableValueChange,
  onDeleteVariable,
  onCreateScenario,
  onRenameScenario,
  onDeleteScenario,
  onSetActiveScenario,
  onScenarioOverrideChange,
  onRunCalculator,
}: DesignLabEditorProps): React.ReactElement => {
  const meta = editorTypeMeta(node.editorType);
  const [newVariableName, setNewVariableName] = React.useState('');
  const [newScenarioName, setNewScenarioName] = React.useState('');

  const activeScenario =
    designLab?.scenarios.find((scenario) => scenario.id === designLab.activeScenarioId) ?? null;

  if (!designLab) {
    return (
      <section className="document-editor">
        <header className="document-editor-header">
          <div>
            <h2>{node.name}</h2>
            <p className="editor-subtitle">Editor type: {meta.label}</p>
          </div>
        </header>
        <div className="content-placeholder">Preparing design lab workspace...</div>
      </section>
    );
  }

  const isCoreLoop = node.editorType === 'core-loop-simulator';
  const latestRun = designLab.runs[0] ?? null;
  const previousRun = designLab.runs[1] ?? null;

  return (
    <section className="document-editor">
      <header className="document-editor-header">
        <div>
          <h2>{node.name}</h2>
          <p className="editor-subtitle">Editor type: {meta.label}</p>
        </div>
      </header>

      {isCoreLoop ? (
        <div className="design-lab-layout">
          <section className="design-lab-main">
            <div className="design-lab-toolbar">
              <label className="kanban-details-field">
                <span>Active scenario</span>
                <select
                  value={designLab.activeScenarioId ?? ''}
                  onChange={(event) => onSetActiveScenario(event.target.value)}
                >
                  {designLab.scenarios.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="kanban-details-field">
                <span>New scenario</span>
                <div className="design-lab-inline-controls">
                  <input
                    value={newScenarioName}
                    placeholder="Scenario name"
                    onChange={(event) => setNewScenarioName(event.target.value)}
                  />
                  <button
                    onClick={() => {
                      onCreateScenario(newScenarioName);
                      setNewScenarioName('');
                    }}
                  >
                    + Add
                  </button>
                </div>
              </label>
            </div>

            <div className="design-lab-presets">
              {CORE_LOOP_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  className="design-lab-preset-button"
                  onClick={() => {
                    const targetScenarioId = designLab.activeScenarioId ?? null;
                    Object.entries(preset.values).forEach(([variableId, value]) => {
                      if (targetScenarioId) {
                        onScenarioOverrideChange(targetScenarioId, variableId, value);
                        return;
                      }
                      onVariableValueChange(variableId, value);
                    });
                  }}
                >
                  <strong>{preset.label}</strong>
                  <span>{preset.description}</span>
                </button>
              ))}
            </div>

            <article className="design-lab-guide">
              <h3>How to translate your loop</h3>
              <p>
                This editor is intentionally abstract. Convert your game-specific steps into these
                three reusable concepts: <strong>Challenge</strong>, <strong>Reward</strong>, and{' '}
                <strong>Downtime</strong>.
              </p>
              <ul>
                {CORE_LOOP_GUIDE_STEPS.map((step) => (
                  <li key={step.title}>
                    <strong>{step.title}</strong>
                    <span>{step.description}</span>
                  </li>
                ))}
              </ul>
            </article>

            <div className="design-lab-flow">
              <CoreLoopStageField
                title="1. Setup Friction"
                caption="How much setup/entry friction exists before the challenge."
                min={0}
                max={100}
                step={1}
                value={valueWithScenarioOverride(designLab, CORE_LOOP_VARIABLE_IDS.friction)}
                onChange={(value) => {
                  if (activeScenario) {
                    onScenarioOverrideChange(activeScenario.id, CORE_LOOP_VARIABLE_IDS.friction, value);
                    return;
                  }
                  onVariableValueChange(CORE_LOOP_VARIABLE_IDS.friction, value);
                }}
              />
              <CoreLoopStageField
                title="2. Challenge Time"
                caption="Average time spent in the main challenge step."
                min={0.5}
                max={20}
                step={0.1}
                value={valueWithScenarioOverride(designLab, CORE_LOOP_VARIABLE_IDS.challengeTime)}
                onChange={(value) => {
                  if (activeScenario) {
                    onScenarioOverrideChange(
                      activeScenario.id,
                      CORE_LOOP_VARIABLE_IDS.challengeTime,
                      value,
                    );
                    return;
                  }
                  onVariableValueChange(CORE_LOOP_VARIABLE_IDS.challengeTime, value);
                }}
              />
              <CoreLoopStageField
                title="3. Reward Intensity"
                caption="How impactful the reward feels after challenge completion."
                min={0}
                max={100}
                step={1}
                value={valueWithScenarioOverride(designLab, CORE_LOOP_VARIABLE_IDS.rewardIntensity)}
                onChange={(value) => {
                  if (activeScenario) {
                    onScenarioOverrideChange(
                      activeScenario.id,
                      CORE_LOOP_VARIABLE_IDS.rewardIntensity,
                      value,
                    );
                    return;
                  }
                  onVariableValueChange(CORE_LOOP_VARIABLE_IDS.rewardIntensity, value);
                }}
              />
              <CoreLoopStageField
                title="4. Decision Time"
                caption="Player decision/planning time between challenge and restart."
                min={0.2}
                max={10}
                step={0.1}
                value={valueWithScenarioOverride(designLab, CORE_LOOP_VARIABLE_IDS.actionTime)}
                onChange={(value) => {
                  if (activeScenario) {
                    onScenarioOverrideChange(activeScenario.id, CORE_LOOP_VARIABLE_IDS.actionTime, value);
                    return;
                  }
                  onVariableValueChange(CORE_LOOP_VARIABLE_IDS.actionTime, value);
                }}
              />
              <CoreLoopStageField
                title="5. Downtime"
                caption="Cooldown/re-entry delay before the next challenge cycle."
                min={0.1}
                max={10}
                step={0.1}
                value={valueWithScenarioOverride(designLab, CORE_LOOP_VARIABLE_IDS.rewardTime)}
                onChange={(value) => {
                  if (activeScenario) {
                    onScenarioOverrideChange(activeScenario.id, CORE_LOOP_VARIABLE_IDS.rewardTime, value);
                    return;
                  }
                  onVariableValueChange(CORE_LOOP_VARIABLE_IDS.rewardTime, value);
                }}
              />
            </div>
          </section>

          <aside className="design-lab-sidebar">
            <header className="kanban-details-header">
              <h3>Simulation Insights</h3>
            </header>
            <button onClick={() => onRunCalculator(runCoreLoopSimulator)}>
              Run Core Loop Simulation
            </button>

            <article className="kanban-card">
              <h3 className="kanban-card-title">Latest result</h3>
              {latestRun ? (
                <div className="design-lab-metrics-grid">
                  <p>
                    <span>Engagement</span>
                    <strong>{formatMetric(latestRun.metricsByKey.engagementScore)}</strong>
                    <em>
                      {formatDelta(
                        latestRun.metricsByKey.engagementScore -
                          (previousRun?.metricsByKey.engagementScore ?? latestRun.metricsByKey.engagementScore),
                      )}
                    </em>
                  </p>
                  <p>
                    <span>Loop Time</span>
                    <strong>{formatMetric(latestRun.metricsByKey.totalLoopTimeSec)}s</strong>
                    <em>
                      {formatDelta(
                        latestRun.metricsByKey.totalLoopTimeSec -
                          (previousRun?.metricsByKey.totalLoopTimeSec ?? latestRun.metricsByKey.totalLoopTimeSec),
                      )}
                    </em>
                  </p>
                  <p>
                    <span>Reward/min</span>
                    <strong>{formatMetric(latestRun.metricsByKey.rewardPerMinute)}</strong>
                    <em>
                      {formatDelta(
                        latestRun.metricsByKey.rewardPerMinute -
                          (previousRun?.metricsByKey.rewardPerMinute ?? latestRun.metricsByKey.rewardPerMinute),
                      )}
                    </em>
                  </p>
                  <p>
                    <span>Flow Balance</span>
                    <strong>{formatMetric(latestRun.metricsByKey.flowBalance)}</strong>
                    <em>
                      {formatDelta(
                        latestRun.metricsByKey.flowBalance -
                          (previousRun?.metricsByKey.flowBalance ?? latestRun.metricsByKey.flowBalance),
                      )}
                    </em>
                  </p>
                </div>
              ) : (
                <p className="editor-subtitle">Run your first simulation to see metrics.</p>
              )}
            </article>

            <div className="kanban-column-cards">
              {designLab.runs.length === 0 ? (
                <p className="editor-subtitle">No runs yet.</p>
              ) : (
                designLab.runs.slice(0, 8).map((run) => <RunSummary key={run.id} run={run} />)
              )}
            </div>
          </aside>
        </div>
      ) : (
        <div className="kanban-workspace">
          <div className="kanban-columns">
            <section className="kanban-column">
              <header className="kanban-column-header">
                <h3>Variables</h3>
              </header>
              <div className="kanban-column-cards">
                {designLab.variables.map((variable) => (
                  <article key={variable.id} className="kanban-card">
                    <h3 className="kanban-card-title">{variable.name}</h3>
                    <label className="kanban-details-field">
                      <span>Value</span>
                      <input
                        type="number"
                        value={variable.value}
                        min={variable.min}
                        max={variable.max}
                        step="0.1"
                        onChange={(event) =>
                          onVariableValueChange(variable.id, Number(event.target.value))
                        }
                      />
                    </label>
                    <button className="kanban-details-delete" onClick={() => onDeleteVariable(variable.id)}>
                      Remove
                    </button>
                  </article>
                ))}
                <article className="kanban-card">
                  <label className="kanban-details-field">
                    <span>New Variable</span>
                    <input
                      value={newVariableName}
                      placeholder="Variable name"
                      onChange={(event) => setNewVariableName(event.target.value)}
                    />
                  </label>
                  <button
                    onClick={() => {
                      onCreateVariable(newVariableName);
                      setNewVariableName('');
                    }}
                  >
                    + Add Variable
                  </button>
                </article>
              </div>
            </section>

            <section className="kanban-column">
              <header className="kanban-column-header">
                <h3>Scenarios</h3>
              </header>
              <div className="kanban-column-cards">
                <article className="kanban-card">
                  <label className="kanban-details-field">
                    <span>Active Scenario</span>
                    <select
                      value={designLab.activeScenarioId ?? ''}
                      onChange={(event) => onSetActiveScenario(event.target.value)}
                    >
                      {designLab.scenarios.map((scenario) => (
                        <option key={scenario.id} value={scenario.id}>
                          {scenario.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </article>
                {designLab.scenarios.map((scenario) => (
                  <article key={scenario.id} className="kanban-card">
                    <label className="kanban-details-field">
                      <span>Scenario Name</span>
                      <input
                        value={scenario.name}
                        onChange={(event) => onRenameScenario(scenario.id, event.target.value)}
                      />
                    </label>
                    <button
                      className="kanban-details-delete"
                      disabled={designLab.scenarios.length <= 1}
                      onClick={() => onDeleteScenario(scenario.id)}
                    >
                      Delete Scenario
                    </button>
                  </article>
                ))}
                {activeScenario
                  ? designLab.variables.map((variable) => (
                      <article key={`${activeScenario.id}:${variable.id}`} className="kanban-card">
                        <h3 className="kanban-card-title">{variable.name}</h3>
                        <label className="kanban-details-field">
                          <span>Override ({activeScenario.name})</span>
                          <input
                            type="number"
                            value={
                              activeScenario.overridesByVariableId[variable.id] ?? variable.value
                            }
                            step="0.1"
                            onChange={(event) =>
                              onScenarioOverrideChange(
                                activeScenario.id,
                                variable.id,
                                Number(event.target.value),
                              )
                            }
                          />
                        </label>
                      </article>
                    ))
                  : null}
                <article className="kanban-card">
                  <label className="kanban-details-field">
                    <span>New Scenario</span>
                    <input
                      value={newScenarioName}
                      placeholder="Scenario name"
                      onChange={(event) => setNewScenarioName(event.target.value)}
                    />
                  </label>
                  <button
                    onClick={() => {
                      onCreateScenario(newScenarioName);
                      setNewScenarioName('');
                    }}
                  >
                    + Add Scenario
                  </button>
                </article>
              </div>
            </section>
          </div>

          <aside className="kanban-details-sidebar">
            <header className="kanban-details-header">
              <h3>Run Log</h3>
            </header>
            <button disabled>Calculator is not wired yet</button>
            <div className="kanban-column-cards">
              {designLab.runs.length === 0 ? (
                <p className="editor-subtitle">No runs yet.</p>
              ) : (
                designLab.runs.slice(0, 10).map((run) => <RunSummary key={run.id} run={run} />)
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
};
