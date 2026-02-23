import { describe, expect, it } from 'vitest';
import { runCoreLoopSimulator } from '../../src/features/design-lab/calculators/core-loop-simulator';
import { ensureDesignLabData } from '../../src/features/app/app-model';
import type { PersistedTreeState } from '../../src/shared/types';

const stateWithNode = (): PersistedTreeState => ({
  nodes: [
    {
      id: 'node-1',
      name: 'Core Loop',
      editorType: 'core-loop-simulator',
      children: [],
    },
  ],
  selectedNodeId: 'node-1',
  nextNodeNumber: 2,
  nodeDataById: {
    'node-1': {},
  },
});

describe('design lab core loop foundation', () => {
  it('initializes default design-lab data for core loop simulator nodes', () => {
    const next = ensureDesignLabData(stateWithNode(), 'node-1', 'core-loop-simulator');
    const payload = next.nodeDataById['node-1']?.designLab;

    expect(payload?.kind).toBe('core-loop-simulator');
    expect(payload?.variables.length).toBeGreaterThan(0);
    expect(payload?.scenarios.length).toBe(1);
    expect(payload?.activeScenarioId).toBe(payload?.scenarios[0]?.id);
  });

  it('produces stable core loop run metrics', () => {
    const result = runCoreLoopSimulator(
      {
        variables: [
          { id: 'v-action-time', name: 'A', value: 2, defaultValue: 2 },
          { id: 'v-challenge-time', name: 'C', value: 4, defaultValue: 4 },
          { id: 'v-reward-time', name: 'R', value: 1, defaultValue: 1 },
          { id: 'v-friction', name: 'F', value: 40, defaultValue: 40 },
          { id: 'v-reward-intensity', name: 'I', value: 70, defaultValue: 70 },
        ],
        scenarios: [],
      },
      {
        scenarioId: null,
        at: 1,
      },
    );

    expect(result.metricsByKey.totalLoopTimeSec).toBeCloseTo(7, 3);
    expect(result.metricsByKey.engagementScore).toBeGreaterThan(0);
    expect(result.summary).toContain('Engagement');
  });
});
