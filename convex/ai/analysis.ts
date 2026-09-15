'use node';

import { generateText, stepCountIs, tool } from 'ai';
import {
  type AnalysisChart,
  CompareExercisesSchema,
  DateRangeSchema,
  ExerciseRangeSchema,
  GetWorkoutSchema,
  RecentWorkoutsSchema,
  RenderChartSchema,
  SearchExercisesInputSchema,
  SearchWorkoutsSchema,
  analysisSystemPrompt,
  createFitnessModel,
} from '@fitness/ai';
import { v } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import { action } from '../_generated/server';
import { refs } from './references';

function modelFromEnvironment() {
  const provider = process.env.AI_PROVIDER ?? 'openrouter';
  if (provider !== 'openrouter')
    throw new Error(`AI_PROVIDER ${provider} is not configured in this build`);
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');
  return createFitnessModel({
    provider,
    model: process.env.AI_MODEL ?? 'openai/gpt-5.6-luna',
    apiKey,
  });
}

export const respond = action({
  args: { prompt: v.string() },
  handler: async (ctx, args) => {
    const prompt = args.prompt.trim();
    if (!prompt) throw new Error('Prompt is required');
    const graphRequested = /\b(?:chart|draw|graph|plot|visuali[sz]e)\b/i.test(prompt);
    const [profile, catalog] = await Promise.all([
      ctx.runQuery(refs.profileCurrent, {}),
      ctx.runQuery(refs.exercisesList, {}),
    ]);
    await ctx.runMutation(refs.messageAppend, { mode: 'analysis', role: 'user', text: prompt });

    const messages = await ctx.runQuery(refs.conversation, { mode: 'analysis' });

    const exerciseRange = <T extends { exerciseId: string; from?: string; to?: string }>(
      input: T,
    ) => ({
      ...input,
      exerciseId: input.exerciseId as Id<'exercises'>,
    });
    let chart: AnalysisChart | undefined;
    const tools = {
      searchExercises: tool({
        description: 'Resolve the user wording to an exercise in their personal catalog.',
        inputSchema: SearchExercisesInputSchema,
        execute: ({ query, limit }) => ctx.runQuery(refs.exercisesSearch, { query, limit }),
      }),
      getRecentWorkouts: tool({
        description: 'Return recent confirmed workouts. This is read-only.',
        inputSchema: RecentWorkoutsSchema,
        execute: ({ limit }) => ctx.runQuery(refs.workoutsRecent, { limit }),
      }),
      getWorkout: tool({
        description: 'Return one confirmed workout owned by the authenticated user.',
        inputSchema: GetWorkoutSchema,
        execute: ({ workoutId }) =>
          ctx.runQuery(refs.workoutGet, { workoutId: workoutId as Id<'workouts'> }),
      }),
      searchWorkouts: tool({
        description: 'Search confirmed workouts by exercise name or workout notes.',
        inputSchema: SearchWorkoutsSchema,
        execute: (input) => ctx.runQuery(refs.searchWorkouts, input),
      }),
      getExerciseHistory: tool({
        description: 'Get chronological sessions and sets for one exercise.',
        inputSchema: ExerciseRangeSchema,
        execute: (input) => ctx.runQuery(refs.exerciseHistory, exerciseRange(input)),
      }),
      getExerciseStats: tool({
        description: 'Get application-calculated progression statistics for one exercise.',
        inputSchema: ExerciseRangeSchema,
        execute: (input) => ctx.runQuery(refs.exerciseStats, exerciseRange(input)),
      }),
      renderChart: tool({
        description:
          'Render arbitrary retrieved or user-provided 2D data as a native line, bar, or scatter chart. Always call this for graph requests; never substitute text or ASCII art.',
        inputSchema: RenderChartSchema,
        execute: async (input) => {
          chart = input;
          return chart;
        },
      }),
      getPersonalRecords: tool({
        description: 'Get maximum weight, reps, and estimated one-rep-max records.',
        inputSchema: ExerciseRangeSchema,
        execute: (input) => ctx.runQuery(refs.personalRecords, exerciseRange(input)),
      }),
      getWeeklyVolume: tool({
        description: 'Get volume calculated and grouped by ISO week.',
        inputSchema: DateRangeSchema,
        execute: (input) => ctx.runQuery(refs.weeklyVolume, input),
      }),
      getMonthlyVolume: tool({
        description: 'Get volume calculated and grouped by month.',
        inputSchema: DateRangeSchema,
        execute: (input) => ctx.runQuery(refs.monthlyVolume, input),
      }),
      compareExercises: tool({
        description: 'Compare progression for two to five exercises over a date range.',
        inputSchema: CompareExercisesSchema,
        execute: ({ exerciseIds, ...range }) =>
          ctx.runQuery(refs.compareExercises, {
            ...range,
            exerciseIds: exerciseIds as Id<'exercises'>[],
          }),
      }),
      getExerciseFrequency: tool({
        description: 'Get session and training-day frequency for one exercise.',
        inputSchema: ExerciseRangeSchema,
        execute: (input) => ctx.runQuery(refs.exerciseFrequency, exerciseRange(input)),
      }),
      getTrainingDays: tool({
        description: 'Get confirmed training days over a date range.',
        inputSchema: DateRangeSchema,
        execute: (input) => ctx.runQuery(refs.trainingDays, input),
      }),
    };

    const system = `${analysisSystemPrompt}\n\nCURRENT DATE: ${new Date().toISOString().slice(0, 10)}\nCURRENT USER: ${JSON.stringify({ displayName: profile.displayName, units: profile.units })}\nEXERCISE CATALOG (history is intentionally omitted): ${JSON.stringify(catalog)}`;
    const result = await generateText({
      model: modelFromEnvironment(),
      system,
      messages,
      tools,
      stopWhen: stepCountIs(8),
    });
    let chartToolCalls: string[] = [];
    if (graphRequested && !chart) {
      const retrievedData = result.steps.flatMap((step) =>
        step.toolResults
          .filter((toolResult) => toolResult.toolName !== 'renderChart')
          .map((toolResult) => ({ name: toolResult.toolName, output: toolResult.output })),
      );
      const chartResult = await generateText({
        model: modelFromEnvironment(),
        system: `${system}\n\nThis is a chart-only correction pass. You MUST call renderChart exactly once. Use only values contained in the user's request or RETRIEVED DATA. Do not invent missing points.`,
        messages: [
          ...messages,
          { role: 'user', content: `RETRIEVED DATA: ${JSON.stringify(retrievedData)}` },
        ],
        tools: { renderChart: tools.renderChart },
        toolChoice: { type: 'tool', toolName: 'renderChart' },
        stopWhen: stepCountIs(1),
      });
      chartToolCalls = chartResult.steps.flatMap((step) =>
        step.toolCalls.map((call) => call.toolName),
      );
    }
    const chartPointCount = chart
      ? 'series' in chart
        ? chart.series.reduce((total, series) => total + series.points.length, 0)
        : chart.points.length
      : 0;
    const text = graphRequested
      ? chart
        ? chartPointCount
          ? `Here is ${chart.title}.`
          : `There is no retrieved data to plot for ${chart.title}.`
        : 'I could not produce a chart from the retrieved data.'
      : result.text.trim() || 'I could not produce an analysis from the retrieved data.';
    await ctx.runMutation(refs.messageAppend, {
      mode: 'analysis',
      role: 'assistant',
      text,
      ...(chart ? { chart } : {}),
    });
    return {
      text,
      ...(chart ? { chart } : {}),
      toolCalls: [
        ...result.steps.flatMap((step) => step.toolCalls.map((call) => call.toolName)),
        ...chartToolCalls,
      ],
    };
  },
});
