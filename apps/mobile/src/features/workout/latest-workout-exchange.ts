export interface WorkoutExchange {
  id: string;
  prompt: string;
  text: string;
}

/** Messages arrive newest first. Ignore a new prompt until its reply exists. */
export function latestWorkoutExchange(
  messages:
    | {
        _id: string;
        role: 'user' | 'assistant';
        text: string;
      }[]
    | undefined,
): WorkoutExchange | undefined {
  const replyIndex = messages?.findIndex((message) => message.role === 'assistant') ?? -1;
  if (!messages || replyIndex < 0) return;
  const prompt = messages.slice(replyIndex + 1).find((message) => message.role === 'user');
  if (!prompt) return;
  const reply = messages[replyIndex];
  return { id: reply._id, prompt: prompt.text, text: reply.text };
}
