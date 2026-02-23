import type { DesignLabCalculator } from './types';
import { resolveVariablesForScenario } from './types';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const runCoreLoopSimulator: DesignLabCalculator = (context, input) => {
  const scenario =
    input.scenarioId === null
      ? null
      : context.scenarios.find((item) => item.id === input.scenarioId) ?? null;
  const values = resolveVariablesForScenario(context.variables, scenario);

  const actionTime = Math.max(0.01, values['v-action-time'] ?? 1.8);
  const challengeTime = Math.max(0.01, values['v-challenge-time'] ?? 3.5);
  const rewardTime = Math.max(0.01, values['v-reward-time'] ?? 1.2);
  const friction = clamp(values['v-friction'] ?? 48, 0, 100);
  const rewardIntensity = clamp(values['v-reward-intensity'] ?? 62, 0, 100);

  const totalLoopTimeSec = actionTime + challengeTime + rewardTime;
  const flowBalance = clamp(100 - Math.abs(challengeTime - (actionTime + rewardTime) * 0.9) * 14, 0, 100);
  const engagementScore = clamp(
    rewardIntensity * 0.52 + flowBalance * 0.28 + (100 - friction) * 0.2,
    0,
    100,
  );
  const rewardPerMinute = rewardIntensity / (totalLoopTimeSec / 60);
  const bottleneckStage =
    challengeTime >= actionTime && challengeTime >= rewardTime
      ? 'challenge'
      : actionTime >= rewardTime
        ? 'action'
        : 'reward';

  return {
    scenarioId: scenario?.id ?? null,
    createdAt: input.at,
    summary: `Engagement ${engagementScore.toFixed(1)} / 100, bottleneck: ${bottleneckStage}`,
    metricsByKey: {
      engagementScore,
      totalLoopTimeSec,
      rewardPerMinute,
      friction,
      rewardIntensity,
      flowBalance,
    },
  };
};
