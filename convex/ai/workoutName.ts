'use node';

import { generateText, Output } from 'ai';
import { WorkoutNameSuggestionSchema, workoutNameSystemPrompt } from '@fitness/ai';
import { v } from 'convex/values';
import { action } from '../_generated/server';
import { internal } from '../_generated/api';
import { observeAI } from './telemetry';
import { createUserModel } from './userModel';

export const suggest = action({
  args: { draftId: v.id('workoutDrafts') },
  handler: async (ctx, args): Promise<string> =>
    observeAI('workoutName', async (trace) => {
      // Resolve identity and retrieve only this user's context before calling the model.
      const { aiSettings, ...context } = await trace.time('load_naming_context', () =>
        ctx.runQuery(internal.workouts.namingContext, args),
      );
      trace.settings(aiSettings);
      trace.context({ contextChars: JSON.stringify(context).length });
      if (
        !context.exercises.length ||
        !context.previousWorkouts.some((workout) => workout.name.trim())
      ) {
        trace.status = 'skipped';
        return '';
      }
      const result = await trace.time('generate_name', () =>
        generateText({
          ...trace.generation('name'),
          model: createUserModel(aiSettings),
          system: workoutNameSystemPrompt,
          prompt: JSON.stringify(context),
          output: Output.object({ schema: WorkoutNameSuggestionSchema }),
          abortSignal: AbortSignal.timeout(15_000),
          maxRetries: 0,
        }),
      );
      return WorkoutNameSuggestionSchema.parse(result.output).name;
    }),
});
