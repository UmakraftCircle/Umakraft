// ── Factory ──

export type ProviderType = 'openai' | 'anthropic' | 'groq';

/**
 * Create an AI provider instance.
 *
 * Groq uses the OpenAI-compatible endpoint with key rotation.
 * Pass multiple keys as comma-separated: `GROQ_API_KEY=key1,key2,key3`
 */
export function createProvider(type: ProviderType, apiKey: string, model?: string): AIService {
  // Empty key handling: providers throw when constructed with no key. Rather than
  // crash at call sites (e.g. /ask, /agent when GROQ/OPENAI key is unset), surface
  // a clear error. In production this is a hard failure; callers decide whether to
  // fall back to a mock (dev only).
  const trimmed = Array.isArray(apiKey) ? apiKey : String(apiKey).trim();
  // eslint-disable-next-line
  if (!trimmed || (Array.isArray(trimmed) && trimmed.filter(Boolean).length === 0)) {
    throw new Error(
      `No API key configured for provider "${type}". Set GROQ_API_KEY or OPENAI_API_KEY.`
    );
  }

  switch (type) {
    case 'openai':
      return new OpenAIProvider(apiKey, model);
    case 'anthropic':
      return new AnthropicProvider(apiKey, model);
    case 'groq':
      return new OpenAIProvider(
        apiKey,
        model || 'llama-3.3-70b-versatile',
        'https://api.groq.com/openai'
      );
    default:
      throw new Error(`Unsupported provider type: ${type}`);
  }
}
