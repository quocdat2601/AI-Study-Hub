/**
 * openai.service.js
 * Handles OpenAI and Grok (xAI) text generation via native fetch.
 */

async function callChatCompletion(apiKey, baseURL, model, systemPrompt, userPrompt, isStreaming) {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  if (userPrompt) {
    messages.push({ role: 'user', content: userPrompt });
  }

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
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

function extractUsage(usage) {
  if (!usage) return null;
  return {
    promptTokens: usage.prompt_tokens || 0,
    completionTokens: usage.completion_tokens || 0,
    totalTokens: usage.total_tokens || 0,
  };
}

async function generateAnswer({ apiKey, baseURL, model, systemPrompt, userPrompt }) {
  const response = await callChatCompletion(apiKey, baseURL, model, systemPrompt, userPrompt, false);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';
  return {
    text,
    usageMetadata: extractUsage(data.usage),
    model,
  };
}

async function* streamAnswer({ apiKey, baseURL, model, systemPrompt, userPrompt }) {
  const response = await callChatCompletion(apiKey, baseURL, model, systemPrompt, userPrompt, true);
  
  if (!response.body) throw new Error('No readable stream available');
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep the last incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        const dataStr = line.slice(6).trim();
        if (!dataStr) continue;
        
        try {
          const parsed = JSON.parse(dataStr);
          const chunkText = parsed.choices?.[0]?.delta?.content;
          if (chunkText) {
            yield { type: 'token', text: chunkText };
          }
          if (parsed.usage) {
            yield { type: 'usage', usageMetadata: extractUsage(parsed.usage), model };
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
