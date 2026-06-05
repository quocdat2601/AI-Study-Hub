import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BellIcon } from "./dashboard/DashboardIcons.jsx";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationApi.js";

function formatNotificationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getNotificationLabel(type) {
  if (type === "share") return "Document shared";
  return "Notification";
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const panelRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const data = await listNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      setNotifications([]);
      setUnreadCount(0);
      setError(err.response?.data?.error || "Could not load notifications.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(intervalId);
  }, [loadNotifications]);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleClickOutside(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  async function handleOpenPanel() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) await loadNotifications();
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((current) =>
        current.map((item) => ({ ...item, is_read: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      setError(err.response?.data?.error || "Could not mark all as read.");
    }
  }

  async function handleNotificationClick(notification) {
    try {
      if (!notification.is_read) {
        await markNotificationRead(notification.id);
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id ? { ...item, is_read: true } : item
          )
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      }
    } catch {
      // Still navigate even if mark-read fails.
    }

    setIsOpen(false);
    navigate("/documents");
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 cursor-pointer transition hover:border-slate-300 hover:text-indigo-600"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        onClick={handleOpenPanel}
        type="button"
      >
        <BellIcon className="h-5 w-5" />

        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl border border-[#e5e9ef] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.14)]">
          <div className="flex items-center justify-between border-b border-[#e5e9ef] px-4 py-3">
            <div>
              <strong className="text-sm text-[#172033]">Notifications</strong>
              {unreadCount > 0 ? (
                <p className="m-0 mt-0.5 text-xs text-[#66758a]">{unreadCount} unread</p>
              ) : null}
            </div>
            {unreadCount > 0 ? (
              <button
                className="border-0 bg-transparent text-xs font-bold text-[#4648d4] cursor-pointer"
                onClick={handleMarkAllRead}
                type="button"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-6 text-sm text-[#66758a]">Loading...</p>
            ) : error ? (
              <p className="px-4 py-6 text-sm font-bold text-[#b42318]">{error}</p>
            ) : notifications.length ? (
              <ul className="m-0 list-none p-0">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <button
                      className={`flex w-full items-start gap-3 border-0 px-4 py-3 text-left cursor-pointer transition hover:bg-[#f8faff] ${notification.is_read ? "bg-white" : "bg-[#f0f4ff]"}`}
                      onClick={() => handleNotificationClick(notification)}
                      type="button"
                    >
                      <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#e8f0ff] text-xs font-black text-[#4648d4]">
                        {notification.type === "share" ? "S" : "N"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block text-sm text-[#172033]">
                          {getNotificationLabel(notification.type)}
                        </strong>
                        <span className="mt-1 block text-sm text-[#66758a]">
                          {notification.message}
                        </span>
                        <span className="mt-1 block text-xs text-[#94a3b8]">
                          {formatNotificationTime(notification.created_at)}
                        </span>
                      </span>
                      {!notification.is_read ? (
                        <span className="mt-2 h-2 w-2 flex-none rounded-full bg-[#4648d4]" />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="m-0 text-sm font-bold text-[#172033]">No notifications yet</p>
                <p className="m-0 mt-1 text-xs text-[#66758a]">
                  You will see alerts here when someone shares a document with you.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
