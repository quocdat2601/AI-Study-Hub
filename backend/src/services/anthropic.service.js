/**
 * anthropic.service.js
 * Handles Anthropic text generation via native fetch.
 */

async function callMessagesAPI(apiKey, model, systemPrompt, userPrompt, isStreaming) {
  const messages = [];
  if (userPrompt) {
    messages.push({ role: 'user', content: userPrompt });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: systemPrompt || undefined,
      messages,
      max_tokens: 4096,
      stream: isStreaming,
    }),
  });

  if (!response.ok) {
    let errorMsg = 'Failed API request';
    try {
      const errData = await response.json();
      errorMsg = errData.error?.message || errorMsg;
    } catch {}
    const err = new Error(errorMsg);
    err.statusCode = response.status;
    err.publicMessage = `AI provider error: ${errorMsg}`;
    throw err;
  }

  return response;
}

async function generateAnswer({ apiKey, model, systemPrompt, userPrompt }) {
  const response = await callMessagesAPI(apiKey, model, systemPrompt, userPrompt, false);
  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  
  const usageMetadata = {
    promptTokens: data.usage?.input_tokens || 0,
    completionTokens: data.usage?.output_tokens || 0,
    totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
  };

  return {
    text,
    usageMetadata,
    model,
  };
}

async function* streamAnswer({ apiKey, model, systemPrompt, userPrompt }) {
  const response = await callMessagesAPI(apiKey, model, systemPrompt, userPrompt, true);
  
  if (!response.body) throw new Error('No readable stream available');
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  let promptTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep the last incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6).trim();
        if (!dataStr) continue;
        
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
            yield { type: 'token', text: parsed.delta.text };
          } else if (parsed.type === 'message_start') {
            promptTokens = parsed.message?.usage?.input_tokens || 0;
          } else if (parsed.type === 'message_delta' && parsed.usage) {
            const completionTokens = parsed.usage.output_tokens || 0;
            yield { 
              type: 'usage', 
              usageMetadata: {
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
              }, 
              model 
            };
          }
        } catch (e) {
          // ignore malformed JSON chunks
        }
      }
    }
  }
}

module.exports = {
  generateAnswer,
  streamAnswer,
};
