import { loadEnvFile } from 'node:process';
import { it } from 'vitest';
import { generateText, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import { createFitnessModel } from './model';
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
} from './schemas';

it.runIf(process.env.RUN_LIVE_AI_DIAGNOSTICS === '1')(
  'diagnoses the full GPT-6 workout tool request',
  async () => {
    loadEnvFile('.env.local');
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('Local OpenRouter key is missing');
    const tools = {
      getRecentWorkouts: tool({ inputSchema: RecentWorkoutsSchema }),
      getWorkout: tool({ inputSchema: GetWorkoutSchema }),
      getExerciseHistory: tool({ inputSchema: ExerciseRangeSchema }),
      getCurrentDraft: tool({ inputSchema: z.object({}).strict() }),
      searchUserExercises: tool({ inputSchema: SearchExercisesInputSchema }),
      createUserExercise: tool({ inputSchema: CreateExerciseInputSchema }),
      updateUserExercise: tool({ inputSchema: UpdateExerciseInputSchema }),
      addExercisesToDraft: tool({ inputSchema: AddExercisesToDraftInputSchema }),
      removeExerciseFromDraft: tool({ inputSchema: DraftRowInputSchema }),
      updateSet: tool({ inputSchema: UpdateSetInputSchema }),
      removeSet: tool({ inputSchema: DraftSetInputSchema }),
      updateExerciseNotes: tool({ inputSchema: UpdateExerciseNotesInputSchema }),
      reorderExercises: tool({ inputSchema: ReorderExercisesInputSchema }),
    };
    try {
      const result = await generateText({
        model: createFitnessModel({ provider: 'openrouter', apiKey, model: 'openai/gpt-6-sol' }),
        system: 'You are a workout tracker. Use tools only when needed.',
        prompt: 'Reply OK.',
        tools,
        stopWhen: stepCountIs(1),
        maxRetries: 0,
      });
      process.stdout.write(
        JSON.stringify({ result: result.text, calls: result.toolCalls.length }) + '\n',
      );
    } catch (error) {
      const candidate = error as Error & { statusCode?: number; cause?: Error };
      process.stdout.write(
        JSON.stringify({
          name: candidate.name,
          message: candidate.message,
          statusCode: candidate.statusCode,
          cause: candidate.cause?.message,
        }) + '\n',
      );
      throw error;
    }
  },
);
