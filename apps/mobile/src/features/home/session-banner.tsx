import { Pressable, Text, View } from 'react-native';
import { ArrowUpRight } from 'lucide-react-native';
import { DisplayText } from '@/components/display-text';
import { WeightPlates } from '@/components/weight-plates';

export function SessionBanner({
  date,
  sets,
  exercises,
  busy,
  onReview,
}: {
  date: string;
  sets: number;
  exercises: number;
  busy: boolean;
  onReview: () => void;
}) {
  return (
    <View className="mt-5 overflow-hidden rounded-[24px] bg-highlight px-5 py-4">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1">
          <Text className="text-sm font-medium text-highlight-ink">{date}</Text>
          <DisplayText className="mt-1 text-[40px] leading-[46px] min-[360px]:text-[52px] min-[360px]:leading-[58px] text-highlight-ink dark:text-highlight-ink">
            {sets ? 'In session.' : 'Let’s go.'}
          </DisplayText>
        </View>
        <WeightPlates size={72} />
      </View>
      <View className="mt-3 flex-row flex-wrap items-center justify-between gap-2 border-t border-highlight-ink/20 pt-3">
        <Text className="text-sm font-medium text-highlight-ink">
          {sets
            ? `${sets} ${sets === 1 ? 'set' : 'sets'} / ${exercises} ${exercises === 1 ? 'exercise' : 'exercises'}`
            : 'Your next rep starts here'}
        </Text>
        {sets > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Review workout"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onReview}
            className={`min-h-11 flex-row items-center gap-2 rounded-full bg-highlight-ink px-4 ${busy ? 'opacity-50' : 'active:opacity-80'}`}
          >
            <Text className="text-sm font-bold text-white">Review</Text>
            <ArrowUpRight color="#FFFFFF" size={17} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
