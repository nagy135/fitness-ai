/** JSON payloads keep tool inputs/results portable between the SDK, storage, and UI. */
export interface ToolCallRecord {
  toolCallId: string;
  toolName: string;
  input: string;
  output?: string;
  error?: string;
}
