import { createLogger } from '@ai-agent-platform/shared';
const logger = createLogger('Providers');
// ── Shared HTTP client ──
async function apiPost(url, headers, body) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API request failed (${response.status}): ${errText}`);
    }
    return response.json();
}
// ── OpenAI Provider ──
export class OpenAIProvider {
    apiKey;
    model;
    constructor(apiKey, model = 'gpt-4o-mini') {
        this.apiKey = apiKey;
        this.model = model;
    }
    getCurrentModel() {
        return this.model;
    }
    async generate(options) {
        logger.info(`Calling OpenAI ${this.model} for text generation...`);
        const messages = [];
        if (options.system)
            messages.push({ role: 'system', content: options.system });
        messages.push({ role: 'user', content: options.prompt });
        const result = await apiPost('https://api.openai.com/v1/chat/completions', { Authorization: `Bearer ${this.apiKey}` }, { model: this.model, messages, temperature: 0.7 });
        return result.choices[0].message.content;
    }
    async generateStructuredOutput(options) {
        logger.info(`Calling OpenAI ${this.model} for structured output...`);
        const messages = [];
        if (options.system)
            messages.push({ role: 'system', content: options.system });
        messages.push({ role: 'user', content: options.prompt });
        const result = await apiPost('https://api.openai.com/v1/chat/completions', { Authorization: `Bearer ${this.apiKey}` }, { model: this.model, messages, temperature: 0.3, response_format: { type: 'json_object' } });
        const raw = result.choices[0].message.content;
        try {
            return JSON.parse(raw);
        }
        catch {
            logger.warn(`Failed to parse OpenAI structured output as JSON. Raw: ${raw.slice(0, 200)}`);
            throw new Error('OpenAI structured output was not valid JSON.');
        }
    }
}
// ── Anthropic Provider ──
export class AnthropicProvider {
    apiKey;
    model;
    constructor(apiKey, model = 'claude-3-5-haiku') {
        this.apiKey = apiKey;
        this.model = model;
    }
    getCurrentModel() {
        return this.model;
    }
    async generate(options) {
        logger.info(`Calling Anthropic ${this.model} for text generation...`);
        const result = await apiPost('https://api.anthropic.com/v1/messages', {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
        }, {
            model: this.model,
            max_tokens: 4096,
            system: options.system || undefined,
            messages: [{ role: 'user', content: options.prompt }]
        });
        return result.content[0].text;
    }
    async generateStructuredOutput(options) {
        logger.info(`Calling Anthropic ${this.model} for structured output...`);
        const systemPrompt = (options.system || '') + '\n\nYou MUST respond with valid JSON only. No markdown, no commentary.';
        const result = await apiPost('https://api.anthropic.com/v1/messages', {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
        }, {
            model: this.model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: options.prompt }]
        });
        const raw = result.content[0].text;
        try {
            return JSON.parse(raw);
        }
        catch {
            // Anthropic sometimes wraps JSON in markdown code blocks
            const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1].trim());
            }
            logger.warn(`Failed to parse Anthropic structured output as JSON. Raw: ${raw.slice(0, 200)}`);
            throw new Error('Anthropic structured output was not valid JSON.');
        }
    }
}
export function createProvider(type, apiKey, model) {
    switch (type) {
        case 'openai':
            return new OpenAIProvider(apiKey, model);
        case 'anthropic':
            return new AnthropicProvider(apiKey, model);
        default:
            throw new Error(`Unsupported provider type: ${type}`);
    }
}
//# sourceMappingURL=providers.js.map