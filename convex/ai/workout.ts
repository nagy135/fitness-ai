'use node';

import { generateText, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import {
  AddExercisesToDraftInputSchema,
  CreateExerciseInputSchema,
  DraftRowInputSchema,
  DraftSetInputSchema,
  ReorderExercisesInputSchema,
  SearchExercisesInputSchema,
  UpdateExerciseInputSchema,
  UpdateExerciseNotesInputSchema,
  UpdateSetInputSchema,
  createFitnessModel,
  workoutSystemPrompt,
} from '@fitness/ai';
import { v } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import { action } from '../_generated/server';
import { refs } from './references';

const emptyInput = z.object({}).strict();

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

    const [profile, catalog, draft] = await Promise.all([
      ctx.runQuery(refs.profileCurrent, {}),
      ctx.runQuery(refs.exercisesList, {}),
      ctx.runQuery(refs.draftCurrent, {}),
    ]);
    await ctx.runMutation(refs.messageAppend, { mode: 'workout', role: 'user', text: prompt });

    let additionStarted = false;
    const tools = {
      searchUserExercises: tool({
        description:
          'Search the current user personal exercise catalog before choosing or creating an exercise.',
        inputSchema: SearchExercisesInputSchema,
        execute: ({ query, limit }) => ctx.runQuery(refs.exercisesSearch, { query, limit }),
      }),
      createUserExercise: tool({
        description:
          'Create a personal exercise only after search shows no reasonable existing match.',
        inputSchema: CreateExerciseInputSchema,
        execute: (input) => ctx.runMutation(refs.exerciseCreate, input),
      }),
      updateUserExercise: tool({
        description: 'Update metadata for an exercise in this user catalog.',
        inputSchema: UpdateExerciseInputSchema,
        execute: ({ exerciseId, ...patch }) =>
          ctx.runMutation(refs.exerciseUpdate, {
            exerciseId: exerciseId as Id<'exercises'>,
            ...patch,
          }),
      }),
      addExercisesToDraft: tool({
        description:
          'Atomically add one ordered batch of complete exercises and all their sets to the active workout draft. Call this once after resolving every exercise ID.',
        inputSchema: AddExercisesToDraftInputSchema,
        execute: async ({ exercises }) => {
          if (additionStarted) {
            throw new Error('All workout additions must be made in one addExercisesToDraft call');
          }
          additionStarted = true;
          try {
            return await ctx.runMutation(refs.draftAddExercises, {
              exercises: exercises.map(({ exerciseId, ...exercise }) => ({
                ...exercise,
                exerciseId: exerciseId as Id<'exercises'>,
              })),
              source: 'ai',
            });
          } catch (error) {
            additionStarted = false;
            throw error;
          }
        },
      }),
      removeExerciseFromDraft: tool({
        description:
          'Remove one exercise row from the active draft. This never affects confirmed history.',
        inputSchema: DraftRowInputSchema,
        execute: ({ rowId }) => ctx.runMutation(refs.draftRemoveExercise, { rowId, source: 'ai' }),
      }),
      updateSet: tool({
        description: 'Correct values on a specific set in the active draft.',
        inputSchema: UpdateSetInputSchema,
        execute: ({ rowId, setId, patch }) =>
          ctx.runMutation(refs.draftUpdateSet, { rowId, setId, patch, source: 'ai' }),
      }),
      removeSet: tool({
        description: 'Remove a specific set from the active draft.',
        inputSchema: DraftSetInputSchema,
        execute: ({ rowId, setId }) =>
          ctx.runMutation(refs.draftRemoveSet, { rowId, setId, source: 'ai' }),
      }),
      updateExerciseNotes: tool({
        description: 'Replace notes on one exercise row in the active draft.',
        inputSchema: UpdateExerciseNotesInputSchema,
        execute: ({ rowId, notes }) =>
          ctx.runMutation(refs.draftUpdateNotes, { rowId, notes, source: 'ai' }),
      }),
      reorderExercises: tool({
        description: 'Reorder all exercise rows in the active draft.',
        inputSchema: ReorderExercisesInputSchema,
        execute: ({ orderedRowIds }) =>
          ctx.runMutation(refs.draftReorder, { orderedRowIds, source: 'ai' }),
      }),
      undoLastDraftAction: tool({
        description: 'Undo the most recent non-undone draft mutation.',
        inputSchema: emptyInput,
        execute: () => ctx.runMutation(refs.draftUndo, { source: 'ai' }),
      }),
    };

    const result = await generateText({
      model: modelFromEnvironment(),
      system: `${workoutSystemPrompt}\n\nCURRENT DATE: ${new Date().toISOString().slice(0, 10)}\nCURRENT USER: ${JSON.stringify({ displayName: profile.displayName, units: profile.units })}\nEXERCISE CATALOG: ${JSON.stringify(catalog)}\nCURRENT DRAFT: ${JSON.stringify(draft)}`,
      prompt,
      tools,
      stopWhen: stepCountIs(8),
    });

    const text = result.text.trim() || 'Workout updated.';
    await ctx.runMutation(refs.messageAppend, { mode: 'workout', role: 'assistant', text });
    return {
      text,
      toolCalls: result.steps.flatMap((step) => step.toolCalls.map((call) => call.toolName)),
    };
  },
});
