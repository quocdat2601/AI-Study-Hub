export function normalizeAttachmentPayload(payload = {}) {
  const activeAttachments = Array.isArray(payload.documents) ? payload.documents : [];
  const activeIds = new Set(activeAttachments.map((attachment) => Number(attachment.id)));
  const recoverableAttachments = (Array.isArray(payload.recoverableDocuments)
    ? payload.recoverableDocuments
    : [])
    .filter((attachment) => !activeIds.has(Number(attachment.id)))
    .filter((attachment) => attachment.lifecycleStatus !== "purged");

  return {
    activeAttachments,
    recoverableAttachments,
    activeCount: activeAttachments.length,
  };
}

export function getRecoverableAttachmentPresentation(attachment, now = Date.now()) {
  const purgeDeadline = attachment?.purgeAfter
    ? new Date(attachment.purgeAfter).getTime()
    : null;
  const isPurging = attachment?.lifecycleStatus === "purging";
  const isExpired = attachment?.lifecycleStatus === "expired";
  const recoveryOpen = !Number.isFinite(purgeDeadline) || purgeDeadline > now;

  return {
    isExpired,
    isPurging,
    showRestore: attachment?.canRestore !== false && recoveryOpen && !isPurging,
    statusLabel: isPurging ? "Cleanup in progress" : isExpired ? "Expired" : "Recoverable",
  };
}
