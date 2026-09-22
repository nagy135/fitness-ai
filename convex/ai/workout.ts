'use node';

import { generateText, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import {
  AddExercisesToDraftInputSchema,
  CreateExerciseInputSchema,
  DraftRowInputSchema,
  DraftSetInputSchema,
  ExerciseRangeSchema,
  GetWorkoutSchema,
  RecentWorkoutsSchema,
  ReorderExercisesInputSchema,
  SearchExercisesInputSchema,
  UpdateExerciseInputSchema,
  UpdateExerciseNotesInputSchema,
  UpdateSetInputSchema,
  workoutSystemPrompt,
} from '@fitness/ai';
import { v } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import { action } from '../_generated/server';
import { internal } from '../_generated/api';
import { refs } from './references';
import { observeAI } from './telemetry';
import { createUserModel } from './userModel';

const emptyInput = z.object({}).strict();

export const respond = action({
  args: { requestId: v.id('workoutRequests') },
  handler: async (ctx, args): Promise<{ text: string; toolCalls: string[] }> => {
    return observeAI('workout', async (trace) => {
      const started = await trace.time('begin_request', () =>
        ctx.runMutation(internal.aiMessages.beginWorkoutRequest, args),
      );
      if (!started.execute) {
        trace.status = 'reused';
        return { text: started.request.text!, toolCalls: [] };
      }
      try {
        const [profile, catalog, draft] = await Promise.all([
          trace.time('load_profile', () => ctx.runQuery(refs.profileCurrent, {})),
          trace.time('load_catalog', () => ctx.runQuery(refs.exercisesList, {})),
          trace.time('load_draft', () => ctx.runQuery(refs.draftCurrent, {})),
        ]);
        trace.settings(profile.aiSettings);
        // Repeated/parallel identical calls share the committed result. A model
        // retry must not turn a successful addition into an apparent failure.
        let addition: { input: string; result: Promise<string[]> } | undefined;
        const tools = {
          getRecentWorkouts: tool({
            description:
              'Read recent confirmed workouts only when the latest request refers to past training. Use a small limit.',
            inputSchema: RecentWorkoutsSchema,
            execute: ({ limit }) => ctx.runQuery(refs.workoutsRecent, { limit }),
          }),
          getWorkout: tool({
            description:
              'Read one confirmed workout owned by the authenticated user. This cannot edit history.',
            inputSchema: GetWorkoutSchema,
            execute: ({ workoutId }) =>
              ctx.runQuery(refs.workoutGet, { workoutId: workoutId as Id<'workouts'> }),
          }),
          getExerciseHistory: tool({
            description:
              'Read saved sessions and sets for the exercise referenced in the latest request. Retrieve only when historical context is needed; narrow the date range when possible.',
            inputSchema: ExerciseRangeSchema,
            execute: ({ exerciseId, ...range }) =>
              ctx.runQuery(refs.exerciseHistory, {
                exerciseId: exerciseId as Id<'exercises'>,
                ...range,
              }),
          }),
          getCurrentDraft: tool({
            description:
              'Read the current saved draft, including exercise row IDs and set IDs. CURRENT DRAFT already contains fresh state and IDs for corrections. Read again only after an uncertain tool result or when a needed ID is missing; do not routinely re-read before edits or after successful writes. Never replay or delete saved additions to recover from an error.',
            inputSchema: emptyInput,
            execute: () => ctx.runQuery(refs.draftCurrent, {}),
          }),
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
              'Append ONLY newly performed sets from the latest user request, in one ordered batch. Existing exercise rows are reused and supplied sets are APPENDED, never replaced. Do not resend sets already in CURRENT DRAFT or saved workout history. For corrections use updateSet/removeSet. Identical sets are valid when the user explicitly performed another set. Call once after resolving every exercise ID.',
            inputSchema: AddExercisesToDraftInputSchema,
            execute: async ({ exercises }) => {
              const input = JSON.stringify(exercises);
              if (addition) {
                if (addition.input === input) return addition.result;
                throw new Error(
                  'An addition batch has already been submitted for this request. This different batch was not applied. Read getCurrentDraft to check the saved rows; preserve them and do not undo, remove, or resend them.',
                );
              }
              const result = ctx.runMutation(refs.draftAddExercises, {
                exercises: exercises.map(({ exerciseId, ...exercise }) => ({
                  ...exercise,
                  exerciseId: exerciseId as Id<'exercises'>,
                })),
                source: 'ai',
                requestId: args.requestId,
              });
              addition = { input, result };
              try {
                return await result;
              } catch (error) {
                addition = undefined;
                throw error;
              }
            },
          }),
          removeExerciseFromDraft: tool({
            description:
              'Delete exactly one exercise row and its sets by rowId, only when the user requests that deletion. Never use for error recovery, rollback, or replacing an addition batch. History changes require the user to save the editing draft.',
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
            description:
              'Delete exactly one set by rowId and setId, only when the user requests that deletion. Never use for error recovery or rollback. The exercise row and other sets are preserved.',
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
        };

        trace.context({
          messageCount: 1,
          promptChars: started.request.prompt.length,
          catalogChars: JSON.stringify(catalog).length,
          draftChars: JSON.stringify(draft).length,
        });
        const result = await trace.time('generate_response', () =>
          generateText({
            ...trace.generation('response'),
            model: createUserModel(profile.aiSettings),
            system: `${workoutSystemPrompt}\n\nCURRENT DATE: ${new Date().toISOString().slice(0, 10)}\nCURRENT USER: ${JSON.stringify({ displayName: profile.displayName, units: profile.units })}\nEXERCISE CATALOG: ${JSON.stringify(catalog)}\nCURRENT DRAFT: ${JSON.stringify(draft)}`,
            prompt: started.request.prompt,
            tools,
            stopWhen: stepCountIs(8),
          }),
        );

        const text = result.text.trim() || 'Workout updated.';
        await trace.time('save_response', () =>
          ctx.runMutation(internal.aiMessages.finishWorkoutRequest, {
            ...args,
            text,
            failed: false,
          }),
        );
        return {
          text,
          toolCalls: result.steps.flatMap((step) => step.toolCalls.map((call) => call.toolName)),
        };
      } catch {
        trace.status = 'failed';
        const text =
          'The request did not finish. Any changes already saved are shown in your draft. This submission will not run again; describe any remaining changes in a new message.';
        await trace.time('save_response', () =>
          ctx.runMutation(internal.aiMessages.finishWorkoutRequest, {
            ...args,
            text,
            failed: true,
          }),
        );
        return { text, toolCalls: [] };
      }
    });
  },
});
