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
import { internal } from '../_generated/api';
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
  args: { requestId: v.id('workoutRequests') },
  handler: async (ctx, args): Promise<{ text: string; toolCalls: string[] }> => {
    const started = await ctx.runMutation(internal.aiMessages.beginWorkoutRequest, args);
    if (!started.execute) return { text: started.request.text!, toolCalls: [] };
    try {
      const [profile, catalog, draft, messages] = await Promise.all([
        ctx.runQuery(refs.profileCurrent, {}),
        ctx.runQuery(refs.exercisesList, {}),
        ctx.runQuery(refs.draftCurrent, {}),
        ctx.runQuery(refs.conversation, { mode: 'workout' }),
      ]);
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
            'Append ONLY newly performed sets from the latest user request, in one ordered batch. Existing exercise rows are reused and supplied sets are APPENDED, never replaced. Do not resend sets already in CURRENT DRAFT or earlier conversation. For corrections use updateSet/removeSet. Identical sets are valid when the user explicitly performed another set. Call once after resolving every exercise ID.',
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
                requestId: args.requestId,
              });
            } catch (error) {
              additionStarted = false;
              throw error;
            }
          },
        }),
        removeExerciseFromDraft: tool({
          description:
            'Remove one exercise row from the active draft. History changes require the user to save the editing draft.',
          inputSchema: DraftRowInputSchema,
          execute: ({ rowId }) =>
            ctx.runMutation(refs.draftRemoveExercise, {
              rowId,
              source: 'ai',
              requestId: args.requestId,
            }),
        }),
        updateSet: tool({
          description: 'Correct values on a specific set in the active draft.',
          inputSchema: UpdateSetInputSchema,
          execute: ({ rowId, setId, patch }) =>
            ctx.runMutation(refs.draftUpdateSet, {
              rowId,
              setId,
              patch,
              source: 'ai',
              requestId: args.requestId,
            }),
        }),
        removeSet: tool({
          description: 'Remove a specific set from the active draft.',
          inputSchema: DraftSetInputSchema,
          execute: ({ rowId, setId }) =>
            ctx.runMutation(refs.draftRemoveSet, {
              rowId,
              setId,
              source: 'ai',
              requestId: args.requestId,
            }),
        }),
        updateExerciseNotes: tool({
          description: 'Replace notes on one exercise row in the active draft.',
          inputSchema: UpdateExerciseNotesInputSchema,
          execute: ({ rowId, notes }) =>
            ctx.runMutation(refs.draftUpdateNotes, {
              rowId,
              notes,
              source: 'ai',
              requestId: args.requestId,
            }),
        }),
        reorderExercises: tool({
          description: 'Reorder all exercise rows in the active draft.',
          inputSchema: ReorderExercisesInputSchema,
          execute: ({ orderedRowIds }) =>
            ctx.runMutation(refs.draftReorder, {
              orderedRowIds,
              source: 'ai',
              requestId: args.requestId,
            }),
        }),
        undoLastDraftAction: tool({
          description: 'Undo the most recent non-undone draft mutation.',
          inputSchema: emptyInput,
          execute: () =>
            ctx.runMutation(refs.draftUndo, { source: 'ai', requestId: args.requestId }),
        }),
      };

      const result = await generateText({
        model: modelFromEnvironment(),
        system: `${workoutSystemPrompt}\n\nCURRENT DATE: ${new Date().toISOString().slice(0, 10)}\nCURRENT USER: ${JSON.stringify({ displayName: profile.displayName, units: profile.units })}\nEXERCISE CATALOG: ${JSON.stringify(catalog)}\nCURRENT DRAFT: ${JSON.stringify(draft)}`,
        messages,
        tools,
        stopWhen: stepCountIs(8),
      });

      const text = result.text.trim() || 'Workout updated.';
      await ctx.runMutation(internal.aiMessages.finishWorkoutRequest, {
        ...args,
        text,
        failed: false,
      });
      return {
        text,
        toolCalls: result.steps.flatMap((step) => step.toolCalls.map((call) => call.toolName)),
      };
    } catch {
      const text =
        'The request did not finish. Any changes already saved are shown in your draft. This submission will not run again; describe any remaining changes in a new message.';
      await ctx.runMutation(internal.aiMessages.finishWorkoutRequest, {
        ...args,
        text,
        failed: true,
      });
      return { text, toolCalls: [] };
    }
  },
});
