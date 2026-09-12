// Adapter interface to strictly constrain the Gemini footprint
export type GeminiGenerateContentMethod = (systemPrompt: string, userPrompt: string) => Promise<string>;
