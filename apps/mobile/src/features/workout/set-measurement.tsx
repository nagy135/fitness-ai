import { Text } from 'react-native';
import type { WorkoutSet } from '@fitness/domain';
import { formatNumber } from './history-format';

export function SetMeasurement({
  set,
  compact = false,
  className,
}: {
  set: WorkoutSet;
  compact?: boolean;
  className?: string;
}) {
  const measures = [
    { value: set.weightKg, unit: 'kg', isWeight: true },
    { value: set.reps, unit: 'reps', isWeight: false },
    { value: set.durationSeconds, unit: 'sec', isWeight: false },
    { value: set.distanceMeters, unit: 'm', isWeight: false },
  ].filter((measure): measure is { value: number; unit: string; isWeight: boolean } =>
    measure.value !== undefined,
  );

  if (!measures.length) {
    return (
      <Text className={`text-muted dark:text-muted-dark ${className ?? ''}`}>No measurements</Text>
    );
  }

  return (
    <Text className={className} style={{ fontVariant: ['tabular-nums'] }}>
      {measures.map(({ value, unit, isWeight }, index) => {
        const primary = isWeight || (index === 0 && set.weightKg === undefined);
        return (
          <Text key={unit}>
            {index > 0 ? (
              <Text className={compact ? 'text-muted dark:text-muted-dark' : 'text-base text-muted dark:text-muted-dark'}>
                {'  ×  '}
              </Text>
            ) : null}
            <Text
              className={
                primary
                  ? compact
                    ? 'text-[15px] font-bold text-ink dark:text-ink-dark'
                    : 'text-[28px] font-bold text-ink dark:text-ink-dark'
                  : compact
                    ? 'text-sm font-medium text-muted dark:text-muted-dark'
                    : 'text-xl font-medium text-muted dark:text-muted-dark'
              }
            >
              {formatNumber(value)}
            </Text>
            <Text
              className={
                primary
                  ? compact
                    ? 'text-[15px] font-semibold text-ink dark:text-ink-dark'
                    : 'text-lg font-semibold text-ink dark:text-ink-dark'
                  : compact
                    ? 'text-sm text-muted dark:text-muted-dark'
                    : 'text-base text-muted dark:text-muted-dark'
              }
            >
              {' '}{unit}
            </Text>
          </Text>
        );
      })}
    </Text>
  );
}
