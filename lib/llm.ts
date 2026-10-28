import { GoogleGenAI } from '@google/genai';

export interface CallOptions {
  temperature?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
  [key: string]: any;
}

function isRateLimitError(err: any): boolean {
  if (!err) return false;
  if (err.status === 429 || err.code === 429) return true;
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted')
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function callLLM(prompt: string, options?: CallOptions): Promise<string> {
  if (typeof window !== 'undefined') {
    throw new Error('callLLM can only be called on the server.');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing environment variable: GEMINI_API_KEY');
  }

  const model = process.env.GEMINI_MODEL;
  if (!model) {
    throw new Error('Missing environment variable: GEMINI_MODEL');
  }

  const ai = new GoogleGenAI({ apiKey });

  const executeCall = async () => {
    const config = options ? { ...options } : undefined;
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      ...(config ? { config } : {}),
    });

    const text = response.text;
    if (typeof text !== 'string') {
      throw new Error('No text returned from Gemini API response');
    }
    return text.trim();
  };

  try {
    return await executeCall();
  } catch (err: any) {
    if (isRateLimitError(err)) {
      // Wait a few seconds and retry once
      await wait(3000);
      try {
        return await executeCall();
      } catch (retryErr: any) {
        if (isRateLimitError(retryErr)) {
          throw new Error('Rate limit reached, try again shortly');
        }
        throw new Error(`Gemini API error: ${retryErr.message || 'Unknown error'}`);
      }
    }

    throw new Error(`Gemini API error: ${err.message || 'Unknown error'}`);
  }
}
