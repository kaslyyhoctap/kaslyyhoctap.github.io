/**
 * lib/ai/client.ts — Google Generative AI client singleton.
 *
 * Server-side only.  Never import this module from a client component; the
 * client components talk to the AI via the API routes in `app/api/ai/*`.
 *
 * Uses the Gemini Developer API (Google AI Studio free tier: 1000 req/day).
 */
import { GoogleGenAI } from '@google/genai';

let client: GoogleGenAI | null = null;

/**
 * Returns a lazily-initialised singleton `GoogleGenAI` instance.
 * The API key is read from `GOOGLE_AI_API_KEY` (server env only).
 */
export function getAIClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });
  }
  return client;
}

/** Free-tier model — Gemini 2.0 Flash (no charge for the free tier). */
export const AI_MODEL = 'gemini-2.0-flash';

/**
 * Generate content with the AI model.
 * Returns the raw text response (already concatenated by the SDK).
 */
export async function generateText(
  prompt: string,
  model: string = AI_MODEL,
): Promise<string> {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });
  return response.text ?? '';
}
