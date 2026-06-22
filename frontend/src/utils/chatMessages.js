function messageKey(message) {
  if (message?.id === undefined || message?.id === null) return null;
  return String(message.id);
}

function isTemporaryMessage(message) {
  const id = String(message?.id || '');
  return id.startsWith('user-') || id.startsWith('assistant-stream-');
}

export function mergeMessagesById(existing = [], incoming = []) {
  const merged = [];
  const positions = new Map();
  for (const message of [...existing, ...incoming]) {
    const key = messageKey(message);
    if (!key) {
      merged.push(message);
      continue;
    }
    if (positions.has(key)) {
      const index = positions.get(key);
      merged[index] = { ...merged[index], ...message };
    } else {
      positions.set(key, merged.length);
      merged.push(message);
    }
  }
  return merged;
}

export function reconcilePersistedAsk(existing, {
  optimisticUserId,
  optimisticAssistantId,
  persistedUser,
  persistedAssistant,
}) {
  const replacements = new Map([
    [String(optimisticUserId), persistedUser],
    [String(optimisticAssistantId), persistedAssistant],
  ]);
  const replaced = (existing || []).flatMap((message) => {
    const persisted = replacements.get(String(message.id));
    return persisted ? [persisted] : [message];
  });
  return mergeMessagesById(
    replaced,
    [persistedUser, persistedAssistant].filter(Boolean)
  );
}

export function hasAssistantAfterUser(messages, userContent) {
  const normalizedContent = String(userContent || '').trim();
  let latestUserIndex = -1;
  for (let index = 0; index < (messages || []).length; index += 1) {
    const message = messages[index];
    if (message.role === 'user' && String(message.content || '').trim() === normalizedContent) {
      latestUserIndex = index;
    }
  }
  return latestUserIndex >= 0
    && messages.slice(latestUserIndex + 1).some((message) => message.role === 'assistant');
}

export function mergePendingHistory(authoritative, cached, userContent) {
  const hasPersistedUser = (authoritative || []).some((message) => (
    message.role === 'user'
    && String(message.content || '').trim() === String(userContent || '').trim()
  ));
  const optimistic = (cached || []).filter((message) => {
    const id = String(message.id || '');
    if (message.role === 'assistant') return id.startsWith('assistant-stream-');
    if (message.role === 'user') return id.startsWith('user-') && !hasPersistedUser;
    return false;
  });
  return mergeMessagesById(authoritative, optimistic);
}

export function mergeAuthoritativeHistory(authoritative, cached) {
  const stableCachedMessages = (cached || []).filter((message) => !isTemporaryMessage(message));
  return mergeMessagesById(stableCachedMessages, authoritative);
}
