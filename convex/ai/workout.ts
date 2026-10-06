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
  SearchWorkoutsSchema,
  UpdateExerciseInputSchema,
  UpdateExerciseNotesInputSchema,
  UpdateSetInputSchema,
  workoutSystemPrompt,
  type ToolCallRecord,
} from '@fitness/ai';
import { v } from 'convex/values';
import type { Id } from '../_generated/dataModel';
import { action } from '../_generated/server';
import { internal } from '../_generated/api';
import { refs } from './references';
import { observeAI } from './telemetry';
import { createUserModel } from './userModel';
import { ToolCallRecorder } from './toolCallRecorder';

const emptyInput = z.object({}).strict();

export const respond = action({
  args: { requestId: v.id('workoutRequests') },
  handler: async (ctx, args): Promise<{ text: string; toolCalls: ToolCallRecord[] }> => {
    return observeAI('workout', async (trace) => {
      const started = await trace.time('begin_request', () =>
        ctx.runMutation(internal.aiMessages.beginWorkoutRequest, args),
      );
      if (!started.execute) {
        trace.status = 'reused';
        return { text: started.request.text!, toolCalls: started.request.toolCalls ?? [] };
      }
      const toolCalls = new ToolCallRecorder();
      try {
        const [profile, catalog, draft, conversation] = await Promise.all([
          trace.time('load_profile', () => ctx.runQuery(refs.profileCurrent, {})),
          trace.time('load_catalog', () => ctx.runQuery(refs.exercisesList, {})),
          trace.time('load_draft', () => ctx.runQuery(refs.draftCurrent, {})),
          trace.time('load_conversation', () => ctx.runQuery(refs.workoutContext, args)),
        ]);
        const messages = [
          ...conversation,
          { role: 'user' as const, content: started.request.prompt },
        ];
        trace.settings(profile.aiSettings);
        // Repeated/parallel identical calls share the committed result. A model
        // retry must not turn a successful addition into an apparent failure.
        let addition: { input: string; result: Promise<string[]> } | undefined;
        const tools = {
          getRecentWorkouts: tool({
            description:
              'Read recent confirmed workouts when the current request refers to past training. Use a small limit.',
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
          searchWorkouts: tool({
            description:
              'Find confirmed workouts by exercise name, workout name, or notes, optionally within a date range. Resolve references from the current conversation. This is read-only.',
            inputSchema: SearchWorkoutsSchema,
            execute: (input) => ctx.runQuery(refs.searchWorkouts, input),
          }),
          getExerciseRecords: tool({
            description:
              'Read the previous saved session with ALL sets and reps plus all-time maximum measurements for one exercise. Use for "what did I log last time on this exercise?", "log previous record", "same as last time", or maximum questions. Resolve "this exercise" from the current conversation and draft. Previous session excludes the workout currently being edited; maximums include all saved workouts. Questions are read-only; copy sets with addExercisesToDraft only when the user explicitly asks to log or repeat them.',
            inputSchema: z.object({ exerciseId: z.string() }).strict(),
            execute: ({ exerciseId }) =>
              ctx.runQuery(refs.exerciseRecords, { exerciseId: exerciseId as Id<'exercises'> }),
          }),
          getExerciseHistory: tool({
            description:
              'Read all saved sessions and sets for one exercise. Resolve the exercise from the current conversation or catalog. Omit the date range for its full history.',
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
              'Search the current user personal exercise catalog when CURRENT DRAFT and EXERCISE CATALOG do not already resolve a matching exercise. Reuse an existing exercise ID whenever a reasonable match exists. Search before creating an exercise.',
            inputSchema: SearchExercisesInputSchema,
            execute: ({ query, limit }) => ctx.runQuery(refs.exercisesSearch, { query, limit }),
          }),
          createUserExercise: tool({
            description:
              'Create a personal exercise only when CURRENT DRAFT, EXERCISE CATALOG, and searchUserExercises show no reasonable existing match. Reuse existing exercises for equivalent names or aliases and different set measurements. If the match is ambiguous, ask which existing exercise the user means instead of creating a duplicate.',
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
              'Append ONLY newly performed sets from the current request, including earlier measurements that the latest message clarifies, in one ordered batch. Existing exercise rows are reused and supplied sets are APPENDED, never replaced. Do not resend already handled additions from earlier turns, even if they were later edited or deleted. Copy saved historical sets only when the current request explicitly asks to repeat them. For corrections use updateSet/removeSet. Identical sets are valid when the user explicitly performed another set. Call once after resolving every exercise ID.',
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
          messageCount: messages.length,
          conversationChars: JSON.stringify(messages).length,
          promptChars: started.request.prompt.length,
          catalogChars: JSON.stringify(catalog).length,
          draftChars: JSON.stringify(draft).length,
        });
        const result = await trace.time('generate_response', () =>
          generateText({
            ...toolCalls.generation(trace.generation('response')),
            model: createUserModel(profile.aiSettings),
            system: `${workoutSystemPrompt}\n\nCURRENT DATE: ${new Date().toISOString().slice(0, 10)}\nCURRENT USER: ${JSON.stringify({ displayName: profile.displayName, units: profile.units })}\nEXERCISE CATALOG: ${JSON.stringify(catalog)}\nCURRENT DRAFT: ${JSON.stringify(draft)}`,
            messages,
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
            toolCalls: toolCalls.calls,
          }),
        );
        return {
          text,
          toolCalls: toolCalls.calls,
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
            toolCalls: toolCalls.calls,
          }),
        );
        return { text, toolCalls: toolCalls.calls };
      }
    });
  },
});
