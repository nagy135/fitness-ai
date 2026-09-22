'use node';

import { resolveAISettings, type AISettings } from '@fitness/ai/settings';

import type {
  GenerateTextStepStartEvent,
  GenerateTextStepEndEvent,
  LanguageModelCallEndEvent,
  ToolExecutionEndEvent,
  ToolExecutionStartEvent,
} from 'ai';

type Mode = 'workout' | 'analysis' | 'workoutName';
type Status = 'success' | 'failed' | 'reused' | 'skipped';
type Fields = Record<string, string | number | boolean | undefined>;
const ms = (value: number) => Math.round(value * 10) / 10;

/** Metadata only: never pass prompts, tool arguments/results, or error messages to logs. */
export async function observeAI<T>(mode: Mode, work: (trace: AITrace) => Promise<T>): Promise<T> {
  const trace = new AITrace(mode);
  try {
    return await work(trace);
  } catch (error) {
    trace.status = 'failed';
    throw error;
  } finally {
    trace.finish();
  }
}

class AITrace {
  status: Status = 'success';
  private readonly traceId = globalThis.crypto.randomUUID();
  private readonly started = performance.now();
  private modelMs = 0;
  private toolMs = 0;
  private modelCalls = 0;
  private toolCalls = 0;

  constructor(private readonly mode: Mode) {
    this.log('request_start', {
      provider: process.env.AI_PROVIDER ?? 'openrouter',
    });
  }

  private log(event: string, fields: Fields = {}) {
    // Logging must never fail a workout write or change an action's result.
    try {
      console.info(
        JSON.stringify({
          tag: 'ai_timing',
          version: 1,
          traceId: this.traceId,
          mode: this.mode,
          event,
          elapsedMs: ms(performance.now() - this.started),
          ...fields,
        }),
      );
    } catch {
      /* Best-effort diagnostics. */
    }
  }

  settings(settings?: AISettings) {
    this.log('model_settings', resolveAISettings(settings));
  }

  context(counts: Record<string, number>) {
    this.log('context', counts);
  }

  async time<T>(stage: string, work: () => Promise<T>): Promise<T> {
    const started = performance.now();
    this.log('stage_start', { stage });
    let status = 'success';
    try {
      return await work();
    } catch (error) {
      status = 'failed';
      throw error;
    } finally {
      this.log('stage_end', { stage, status, durationMs: ms(performance.now() - started) });
    }
  }

  generation(pass: string) {
    let step = 0;
    let stepStarted = performance.now();
    return {
      onStepStart: (event: Pick<GenerateTextStepStartEvent, 'stepNumber'>) => {
        step = event.stepNumber;
        stepStarted = performance.now();
        this.log('step_start', { pass, step });
      },
      onLanguageModelCallStart: () => {
        this.log('model_start', { pass, step });
      },
      onLanguageModelCallEnd: (
        event: Pick<
          LanguageModelCallEndEvent,
          'performance' | 'usage' | 'modelId' | 'provider' | 'finishReason' | 'responseId'
        >,
      ) => {
        this.modelMs += event.performance.responseTimeMs;
        this.modelCalls++;
        this.log('model_end', {
          pass,
          step,
          model: event.modelId,
          provider: event.provider,
          responseId: event.responseId,
          durationMs: ms(event.performance.responseTimeMs),
          finishReason: event.finishReason,
          inputTokens: event.usage.inputTokens,
          outputTokens: event.usage.outputTokens,
          reasoningTokens: event.usage.outputTokenDetails?.reasoningTokens,
          cachedInputTokens: event.usage.inputTokenDetails?.cacheReadTokens,
        });
      },
      onToolExecutionStart: (event: Pick<ToolExecutionStartEvent, 'toolCall'>) => {
        this.log('tool_start', { pass, step, tool: event.toolCall.toolName });
      },
      onToolExecutionEnd: (
        event: Pick<ToolExecutionEndEvent, 'toolCall' | 'toolExecutionMs' | 'toolOutput'>,
      ) => {
        this.toolMs += event.toolExecutionMs;
        this.toolCalls++;
        this.log('tool_end', {
          pass,
          step,
          tool: event.toolCall.toolName,
          durationMs: ms(event.toolExecutionMs),
          status: event.toolOutput.type === 'tool-error' ? 'failed' : 'success',
        });
      },
      onStepEnd: (event: Pick<GenerateTextStepEndEvent, 'finishReason'>) => {
        this.log('step_end', {
          pass,
          step,
          durationMs: ms(performance.now() - stepStarted),
          finishReason: event.finishReason,
        });
      },
    };
  }

  finish() {
    this.log('request_end', {
      status: this.status,
      durationMs: ms(performance.now() - this.started),
      modelMs: ms(this.modelMs),
      toolMs: ms(this.toolMs),
      modelCalls: this.modelCalls,
      toolCalls: this.toolCalls,
    });
  }
}
