import { ToolDefinition, createLogger } from '@ai-agent-platform/shared';

const logger = createLogger('SkillTools:browser-extract');

// PII patterns for the pre-storage gate (agent-performed; no external AIDefence MCP).
const PII_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'email', re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { label: 'phone', re: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g },
  { label: 'token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36}|sk-[A-Za-z0-9]{20,}|Bearer\s+[\w.-]{20,}|AKIA[0-9A-Z]{16})\b/g },
];

const INSTRUCTION_MARKERS = [
  'ignore previous instructions',
  'ignore all previous',
  'system prompt',
  'you are now',
  'as an ai',
  '[offtopic]',
];

function redact(text: string): { text: string; redactions: string[] } {
  const redactions: string[] = [];
  let out = text;
  for (const { label, re } of PII_PATTERNS) {
    out = out.replace(re, (m) => {
      redactions.push(`${label}:${m}`);
      return '[REDACTED]';
    });
  }
  return { text: out, redactions };
}

function detectInjection(text: string): boolean {
  const lower = text.toLowerCase();
  return INSTRUCTION_MARKERS.some((m) => lower.includes(m));
}

export const browserExtractTool: ToolDefinition = {
  slug: 'browser-extract',
  name: 'Browser Extract',
  description:
    'Sanitize and gate extracted web content: redact PII (emails, phones, tokens), flag instruction-like (prompt-injection) strings, and return a safe structured payload with a manifest of redactions. Treats scraped text as untrusted data, never as instructions.',
  parameters: {
    content: { type: 'string', description: 'The raw extracted text to gate', required: true },
    host: { type: 'string', description: 'Source host for template scoping', required: false },
  },
  handler: async (args) => {
    const raw = String(args['content'] ?? '');
    const host = String(args['host'] ?? '');
    logger.info(`browser-extract host=${host} chars=${raw.length}`);

    const { text, redactions } = redact(raw);
    const injectionDetected = detectInjection(raw);

    return {
      success: true,
      host,
      safe: !injectionDetected,
      text: injectionDetected ? '' : text,
      redactions,
      piiRedactionCount: redactions.length,
      injectionDetected,
      note: injectionDetected
        ? 'Instruction-like content detected; extracted text quarantined and returned empty.'
        : undefined,
    };
  },
};
