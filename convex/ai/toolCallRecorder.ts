import type { ToolExecutionStartEvent, ToolExecutionEndEvent } from 'ai';
import type { ToolCallRecord } from '@fitness/ai';

type Start = Pick<ToolExecutionStartEvent, 'toolCall'>;
type End = Pick<ToolExecutionEndEvent, 'toolCall' | 'toolOutput' | 'toolExecutionMs'>;

function payload(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, item: unknown) =>
    item instanceof Error ? { name: item.name, message: item.message } : item,
  );
}

/** Collect executed calls, including partial work if a later model step fails. */
export class ToolCallRecorder {
  readonly calls: ToolCallRecord[] = [];
  private byId = new Map<string, ToolCallRecord>();

  generation<
    T extends {
      onToolExecutionStart: (event: Start) => void;
      onToolExecutionEnd: (event: End) => void;
    },
  >(observer: T) {
    return {
      ...observer,
      onToolExecutionStart: (event: Start) => {
        this.record(event);
        observer.onToolExecutionStart(event);
      },
      onToolExecutionEnd: (event: End) => {
        const call = this.record(event);
        if (event.toolOutput.type === 'tool-error') {
          call.error = payload(event.toolOutput.error);
        } else {
          call.output = payload(event.toolOutput.output);
        }
        observer.onToolExecutionEnd(event);
      },
    };
  }

  private record({ toolCall }: Start) {
    const existing = this.byId.get(toolCall.toolCallId);
    if (existing) return existing;
    const call: ToolCallRecord = {
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      input: payload(toolCall.input),
    };
    this.byId.set(call.toolCallId, call);
    this.calls.push(call);
    return call;
  }
}
