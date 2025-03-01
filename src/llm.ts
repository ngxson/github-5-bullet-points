import OpenAI from 'openai';
import { CONFIG } from '../config';
import { Stream } from 'openai/streaming.mjs';

const client = new OpenAI({
  baseURL: CONFIG.oaiCompatUrl,
  apiKey: CONFIG.oaiCompatToken,
  defaultHeaders: {
    ...CONFIG.oaiCompatExtraHeaders,
  },
});

export async function createChatCmpl(messages: { role: string; content: string }[]): Promise<string> {
  const stream = await client.chat.completions.create({
    // model: 'deepseek/deepseek-r1-distill-qwen-14b',
    messages,
    stream: true,
    temperature: 0.05,
    ...CONFIG.oaiCompatExtraBody,
  }) as any as Stream<OpenAI.Chat.Completions.ChatCompletionChunk>;
  let output = '';
  for await (const chunk of stream) {
    const chunkText = chunk.choices[0]?.delta?.content || '';
    output += chunkText;
    process.stdout.write(chunkText);
  }
  console.log();
  return output;
}
