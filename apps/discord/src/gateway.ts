    const primaryAI = createProvider('groq', groqKey, 'openai/gpt-oss-120b');
    const fallbackAI = createProvider('groq', groqKey, 'openai/gpt-oss-20b');