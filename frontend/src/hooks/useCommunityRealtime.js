import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase.js";

const DEFAULT_DEBOUNCE_MS = 450;

export default function useCommunityRealtime({
  channelKey,
  filter,
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  getDebounceMs,
  onSignal,
}) {
  const onSignalRef = useRef(onSignal);
  const timeoutRef = useRef(null);

  useEffect(() => {
    onSignalRef.current = onSignal;
  }, [onSignal]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled || !channelKey) {
      return undefined;
    }

    const scheduleRefresh = (payload) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const resolvedDebounceMs = typeof getDebounceMs === "function"
        ? getDebounceMs(payload)
        : debounceMs;

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        onSignalRef.current?.(payload);
      }, Math.max(0, Number(resolvedDebounceMs ?? debounceMs) || 0));
    };

    const channel = supabase
      .channel(channelKey)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "community_live_events",
        ...(filter ? { filter } : {}),
      }, scheduleRefresh)
      .subscribe();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      supabase.removeChannel(channel);
    };
  }, [channelKey, debounceMs, enabled, filter, getDebounceMs]);
}
