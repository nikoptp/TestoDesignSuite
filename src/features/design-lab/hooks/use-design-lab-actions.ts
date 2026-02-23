import React from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  DesignLabKind,
  DesignLabRun,
  DesignLabScenario,
  DesignLabVariable,
  PersistedTreeState,
} from '../../../shared/types';
import { ensureDesignLabData } from '../../app/app-model';
import { updateNodeWorkspaceData } from '../../app/workspace-node-updaters';
import type { DesignLabCalculator } from '../calculators/types';

type UseDesignLabActionsOptions = {
  nodeId: string;
  editorType: DesignLabKind;
  setState: Dispatch<SetStateAction<PersistedTreeState>>;
  pushHistory: () => void;
};

type DesignLabActions = {
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

const createVariableId = (): string =>
  `var-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const createScenarioId = (): string =>
  `scenario-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const createRunId = (): string =>
  `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useDesignLabActions = ({
  nodeId,
  editorType,
  setState,
  pushHistory,
}: UseDesignLabActionsOptions): DesignLabActions => {
  const onCreateVariable = React.useCallback((name: string): void => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    pushHistory();
    setState((prev) => {
      const next = ensureDesignLabData(prev, nodeId, editorType);
      const designLab = next.nodeDataById[nodeId]?.designLab;
      if (!designLab) {
        return prev;
      }
      const variable: DesignLabVariable = {
        id: createVariableId(),
        name: trimmed.slice(0, 64),
        value: 0,
        defaultValue: 0,
      };
      return updateNodeWorkspaceData(next, nodeId, (workspace) => ({
        ...workspace,
        designLab: {
          ...designLab,
          variables: [...designLab.variables, variable],
        },
      }));
    });
  }, [editorType, nodeId, pushHistory, setState]);

  const onVariableValueChange = React.useCallback((variableId: string, value: number): void => {
    if (!Number.isFinite(value)) {
      return;
    }
    setState((prev) => {
      const next = ensureDesignLabData(prev, nodeId, editorType);
      const designLab = next.nodeDataById[nodeId]?.designLab;
      if (!designLab) {
        return prev;
      }
      return updateNodeWorkspaceData(next, nodeId, (workspace) => ({
        ...workspace,
        designLab: {
          ...designLab,
          variables: designLab.variables.map((variable) =>
            variable.id === variableId
              ? {
                  ...variable,
                  value:
                    typeof variable.min === 'number' && value < variable.min
                      ? variable.min
                      : typeof variable.max === 'number' && value > variable.max
                        ? variable.max
                        : value,
                }
              : variable,
          ),
        },
      }));
    });
  }, [editorType, nodeId, setState]);

  const onDeleteVariable = React.useCallback((variableId: string): void => {
    pushHistory();
    setState((prev) => {
      const next = ensureDesignLabData(prev, nodeId, editorType);
      const designLab = next.nodeDataById[nodeId]?.designLab;
      if (!designLab) {
        return prev;
      }
      return updateNodeWorkspaceData(next, nodeId, (workspace) => ({
        ...workspace,
        designLab: {
          ...designLab,
          variables: designLab.variables.filter((variable) => variable.id !== variableId),
          scenarios: designLab.scenarios.map((scenario) => {
            const { [variableId]: removedValue, ...rest } = scenario.overridesByVariableId;
            void removedValue;
            return {
              ...scenario,
              overridesByVariableId: rest,
            };
          }),
        },
      }));
    });
  }, [editorType, nodeId, pushHistory, setState]);

  const onCreateScenario = React.useCallback((name: string): void => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    pushHistory();
    setState((prev) => {
      const next = ensureDesignLabData(prev, nodeId, editorType);
      const designLab = next.nodeDataById[nodeId]?.designLab;
      if (!designLab) {
        return prev;
      }
      const now = Date.now();
      const scenario: DesignLabScenario = {
        id: createScenarioId(),
        name: trimmed.slice(0, 64),
        overridesByVariableId: {},
        createdAt: now,
        updatedAt: now,
      };
      return updateNodeWorkspaceData(next, nodeId, (workspace) => ({
        ...workspace,
        designLab: {
          ...designLab,
          scenarios: [...designLab.scenarios, scenario],
          activeScenarioId: scenario.id,
        },
      }));
    });
  }, [editorType, nodeId, pushHistory, setState]);

  const onSetActiveScenario = React.useCallback((scenarioId: string): void => {
    setState((prev) => {
      const next = ensureDesignLabData(prev, nodeId, editorType);
      const designLab = next.nodeDataById[nodeId]?.designLab;
      if (!designLab || !designLab.scenarios.some((scenario) => scenario.id === scenarioId)) {
        return prev;
      }
      return updateNodeWorkspaceData(next, nodeId, (workspace) => ({
        ...workspace,
        designLab: {
          ...designLab,
          activeScenarioId: scenarioId,
        },
      }));
    });
  }, [editorType, nodeId, setState]);

  const onRenameScenario = React.useCallback((scenarioId: string, name: string): void => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setState((prev) => {
      const next = ensureDesignLabData(prev, nodeId, editorType);
      const designLab = next.nodeDataById[nodeId]?.designLab;
      if (!designLab) {
        return prev;
      }
      return updateNodeWorkspaceData(next, nodeId, (workspace) => ({
        ...workspace,
        designLab: {
          ...designLab,
          scenarios: designLab.scenarios.map((scenario) =>
            scenario.id === scenarioId
              ? { ...scenario, name: trimmed.slice(0, 64), updatedAt: Date.now() }
              : scenario,
          ),
        },
      }));
    });
  }, [editorType, nodeId, setState]);

  const onDeleteScenario = React.useCallback((scenarioId: string): void => {
    pushHistory();
    setState((prev) => {
      const next = ensureDesignLabData(prev, nodeId, editorType);
      const designLab = next.nodeDataById[nodeId]?.designLab;
      if (!designLab) {
        return prev;
      }
      const scenarios = designLab.scenarios.filter((scenario) => scenario.id !== scenarioId);
      const nextActive =
        designLab.activeScenarioId === scenarioId
          ? scenarios[0]?.id
          : designLab.activeScenarioId;
      return updateNodeWorkspaceData(next, nodeId, (workspace) => ({
        ...workspace,
        designLab: {
          ...designLab,
          scenarios,
          runs: designLab.runs.filter((run) => run.scenarioId !== scenarioId),
          activeScenarioId: nextActive,
        },
      }));
    });
  }, [editorType, nodeId, pushHistory, setState]);

  const onScenarioOverrideChange = React.useCallback((
    scenarioId: string,
    variableId: string,
    value: number,
  ): void => {
    if (!Number.isFinite(value)) {
      return;
    }
    setState((prev) => {
      const next = ensureDesignLabData(prev, nodeId, editorType);
      const designLab = next.nodeDataById[nodeId]?.designLab;
      if (!designLab) {
        return prev;
      }
      return updateNodeWorkspaceData(next, nodeId, (workspace) => ({
        ...workspace,
        designLab: {
          ...designLab,
          scenarios: designLab.scenarios.map((scenario) =>
            scenario.id === scenarioId
              ? {
                  ...scenario,
                  overridesByVariableId: {
                    ...scenario.overridesByVariableId,
                    [variableId]: value,
                  },
                  updatedAt: Date.now(),
                }
              : scenario,
          ),
        },
      }));
    });
  }, [editorType, nodeId, setState]);

  const onRunCalculator = React.useCallback((calculator: DesignLabCalculator): void => {
    pushHistory();
    setState((prev) => {
      const next = ensureDesignLabData(prev, nodeId, editorType);
      const designLab = next.nodeDataById[nodeId]?.designLab;
      if (!designLab) {
        return prev;
      }
      const runInput = {
        scenarioId: designLab.activeScenarioId ?? null,
        at: Date.now(),
      };
      const calculated = calculator(
        {
          variables: designLab.variables,
          scenarios: designLab.scenarios,
        },
        runInput,
      );
      const run: DesignLabRun = {
        id: createRunId(),
        ...calculated,
      };
      return updateNodeWorkspaceData(next, nodeId, (workspace) => ({
        ...workspace,
        designLab: {
          ...designLab,
          runs: [run, ...designLab.runs].slice(0, 100),
        },
      }));
    });
  }, [editorType, nodeId, pushHistory, setState]);

  return {
    onCreateVariable,
    onVariableValueChange,
    onDeleteVariable,
    onCreateScenario,
    onRenameScenario,
    onDeleteScenario,
    onSetActiveScenario,
    onScenarioOverrideChange,
    onRunCalculator,
  };
};
