import type {
  DesignLabRun,
  DesignLabScenario,
  DesignLabVariable,
} from '../../../shared/types';

export type DesignLabResolvedVariables = Record<string, number>;

export type DesignLabCalculatorContext = {
  variables: DesignLabVariable[];
  scenarios: DesignLabScenario[];
};

export type DesignLabCalculatorRunInput = {
  scenarioId: string | null;
  at: number;
};

export type DesignLabCalculator = (
  context: DesignLabCalculatorContext,
  input: DesignLabCalculatorRunInput,
) => Omit<DesignLabRun, 'id'>;

export const resolveVariablesForScenario = (
  variables: DesignLabVariable[],
  scenario: DesignLabScenario | null,
): DesignLabResolvedVariables => {
  const resolved: DesignLabResolvedVariables = {};
  variables.forEach((variable) => {
    const override = scenario?.overridesByVariableId[variable.id];
    resolved[variable.id] =
      typeof override === 'number' && Number.isFinite(override) ? override : variable.value;
  });
  return resolved;
};
