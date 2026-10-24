/** JSON payloads keep tool inputs/results portable between the SDK, storage, and UI. */
export interface ToolCallRecord {
  toolCallId: string;
  toolName: string;
  input: string;
  output?: string;
  error?: string;
}

/** Restore user clarifications from receipts, including partially failed generations. */
export function answeredQuestions(calls?: readonly ToolCallRecord[]) {
  return (calls ?? []).flatMap((call): { question: string; answer: string }[] => {
    if (call.toolName !== 'askUser' || call.error || !call.output) return [];
    try {
      const output: unknown = JSON.parse(call.output);
      if (
        typeof output === 'object' &&
        output !== null &&
        'status' in output &&
        output.status === 'answered' &&
        'question' in output &&
        typeof output.question === 'string' &&
        'answer' in output &&
        typeof output.answer === 'string'
      )
        return [{ question: output.question, answer: output.answer }];
    } catch {
      // Old or incomplete payloads must not break an otherwise readable chat.
    }
    return [];
  });
}
