import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardShell from "../components/dashboard/DashboardShell.jsx";
import {
  CloudStorageIcon,
  DocumentFileIcon,
  GraduationCapIcon,
  MessagesIcon,
} from "../components/dashboard/DashboardIcons.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { usePreferences } from "../contexts/PreferencesContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import useAccount from "../hooks/useAccount.js";
import useTranslation from "../hooks/useTranslation.js";
import { SUPPORTED_LANGUAGES } from "../lib/i18n.js";
import { formatFileSize } from "../lib/formatFileSize.js";
import { formatJoinDate, getUserInitials } from "../lib/userDisplay.js";
import AccountEditProfileModal from "./AccountEditProfileModal.jsx";
import AccountEmailModal from "./AccountEmailModal.jsx";
import AccountLanguageModal from "./AccountLanguageModal.jsx";
import AccountPasswordModal from "./AccountPasswordModal.jsx";

function SettingRow({ icon, title, description, action, onClick, asButton = true }) {
  const className = "flex w-full items-center gap-4 rounded-xl border-0 bg-transparent px-1 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800";

  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</strong>
        {description ? <small className="block text-xs text-slate-500 dark:text-slate-400">{description}</small> : null}
      </span>
      <span className="shrink-0 text-slate-400">{action}</span>
    </>
  );

  if (!asButton) return <div className={className}>{content}</div>;

  return (
    <button className={className} onClick={onClick} type="button">
      {content}
    </button>
  );
}

function ActivityRow({ title, time, action }) {
  const isChat = action === "chat.message.send";
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {isChat ? <MessagesIcon className="h-4 w-4" /> : <DocumentFileIcon className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <p className="m-0 text-sm font-medium text-slate-800 dark:text-slate-100">{title}</p>
        <small className="text-xs text-slate-500 dark:text-slate-400">{time}</small>
      </span>
    </div>
  );
}

function UserIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c1.5-3.5 4.5-5 7-5s5.5 1.5 7 5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.8 4 6.2 4 9s-1.5 6.2-4 9M12 3c-2.5 2.8-4 6.2-4 9s1.5 6.2 4 9" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function formatRelativeTime(value) {
  if (!value) return "Recently";
  const diffMs = Date.now() - new Date(value).getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

function languageLabel(code) {
  return SUPPORTED_LANGUAGES.find((item) => item.value === code)?.label || code;
}

export default function AccountPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { setLanguage } = usePreferences();
  const { addToast } = useToast();
  const { t } = useTranslation();
  const avatarInputRef = useRef(null);
  const [activeModal, setActiveModal] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const {
    account,
    isLoading,
    error,
    saveProfile,
    savePreferences,
    saveEmail,
    savePassword,
    saveAvatar,
    upgradeStorage,
  } = useAccount();

  const profile = account?.profile;
  const storage = account?.storage;
  const preferences = account?.preferences;
  const initials = getUserInitials({ email: profile?.email, displayName: profile?.displayName });

  const usedBytes = Number(storage?.used || 0);
  const limitBytes = Number(storage?.limit || 0);
  const usedPercent = limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0;
  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      await saveAvatar(file);
      await refreshUser();
      addToast({ type: "success", message: t("account.avatarUpdated") });
    } catch (err) {
      addToast({ type: "error", message: err.response?.data?.error || "Could not upload avatar." });
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = "";
    }
  }

  async function handleUpgradeStorage() {
    if (!storage?.nextPlan) {
      addToast({ type: "info", message: t("account.maxPlan") });
      return;
    }

    setIsUpgrading(true);
    try {
      const data = await upgradeStorage();
      await refreshUser();
      addToast({ type: "success", message: data.message || t("account.upgradeSuccess") });
    } catch (err) {
      addToast({ type: "error", message: err.response?.data?.error || "Could not upgrade storage." });
    } finally {
      setIsUpgrading(false);
    }
  }

  return (
    <DashboardShell>
      <section>
        <h1 className="m-0 text-[28px] font-bold tracking-tight text-slate-900 dark:text-slate-100">{t("account.title")}</h1>
        <p className="m-0 mt-1 text-sm text-slate-500 dark:text-slate-400">{t("account.subtitle")}</p>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</p>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.4fr)]">
        <div className="grid gap-5 content-start">
          <article className="rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
            <div className="relative mx-auto mb-4 w-fit">
              {profile?.avatarUrl ? (
                <img alt={profile.displayName} className="h-24 w-24 rounded-full object-cover shadow-[0_12px_28px_rgba(99,102,241,0.3)]" src={profile.avatarUrl} />
              ) : (
                <span className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-2xl font-bold text-white shadow-[0_12px_28px_rgba(99,102,241,0.3)]">
                  {initials}
                </span>
              )}
              <button
                className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white shadow disabled:opacity-60 dark:border-slate-900"
                aria-label={t("account.uploadAvatar")}
                disabled={isUploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
                type="button"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
                </svg>
              </button>
              <input accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} ref={avatarInputRef} type="file" />
            </div>

            <h2 className="m-0 text-xl font-bold text-slate-900 dark:text-slate-100">{isLoading ? "..." : profile?.displayName}</h2>
            <p className="m-0 mt-1 text-sm font-medium text-indigo-600 dark:text-indigo-400">{isLoading ? "..." : profile?.handle}</p>
            <p className="m-0 mt-2 text-sm text-slate-500 dark:text-slate-400">{isLoading ? "..." : profile?.email}</p>

            <div className="mt-5 grid gap-2 text-left">
              <p className="m-0 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <GraduationCapIcon className="h-4 w-4 text-slate-400" />
                {isLoading ? "..." : profile?.major}
              </p>
              <p className="m-0 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M8 3v4M16 3v4M3 11h18" />
                </svg>
                {isLoading ? "..." : formatJoinDate(profile?.createdAt)}
              </p>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-300">
                <CloudStorageIcon className="h-[18px] w-[18px]" />
              </span>
              <h3 className="m-0 text-base font-semibold text-slate-900 dark:text-slate-100">{t("account.storageUsage")}</h3>
            </div>

            <p className="m-0 text-sm font-semibold text-slate-800 dark:text-slate-100">
              {isLoading ? "..." : `${formatFileSize(usedBytes)} / ${formatFileSize(limitBytes)} used`}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <span className="block h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${usedPercent}%` }} />
            </div>
            <p className="m-0 mt-2 text-xs text-slate-500 dark:text-slate-400">{t("account.storagePercent", { percent: usedPercent })}</p>
            <p className="m-0 mt-4 text-sm text-slate-600 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-slate-100">{isLoading ? "..." : storage?.documentCount ?? 0}</strong> {t("account.uploadedDocuments")}
            </p>
            <p className="m-0 mt-2 text-xs text-slate-500 dark:text-slate-400">
              {t("account.plan")}: {storage?.plan || profile?.plan || "Student Plan"}
            </p>

            <button
              className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              disabled={isUpgrading || isLoading || !storage?.nextPlan}
              onClick={handleUpgradeStorage}
              type="button"
            >
              {isUpgrading ? t("common.saving") : storage?.nextPlan ? `${t("account.upgradeStorage")} → ${storage.nextPlan}` : t("account.maxPlan")}
            </button>
          </article>
        </div>

        <div className="grid gap-5 content-start">
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
            <h3 className="m-0 mb-2 text-base font-semibold text-slate-900 dark:text-slate-100">{t("account.settings")}</h3>

            <SettingRow action={<ChevronRightIcon />} description={t("account.editProfileDesc")} icon={<UserIcon />} onClick={() => setActiveModal("profile")} title={t("account.editProfile")} />
            <SettingRow action={<ChevronRightIcon />} description={t("account.changePasswordDesc")} icon={<LockIcon />} onClick={() => setActiveModal("password")} title={t("account.changePassword")} />
            <SettingRow action={<ChevronRightIcon />} description={profile?.email} icon={<MailIcon />} onClick={() => setActiveModal("email")} title={t("account.updateEmail")} />
            {/* /onboarding là route student-only nên admin bấm vào sẽ bị đá về /admin */}
            {profile?.role === "admin" ? null : (
              <SettingRow
                action={<ChevronRightIcon />}
                description={profile?.major}
                icon={<GraduationCapIcon className="h-5 w-5" />}
                onClick={() => navigate("/onboarding?edit=1")}
                title={t("account.studyPreferences")}
              />
            )}

            <div className="my-2 border-t border-slate-100 dark:border-slate-800" />

            <SettingRow
              action={<span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{t("common.edit")}</span>}
              description={languageLabel(preferences?.language)}
              icon={<GlobeIcon />}
              onClick={() => setActiveModal("language")}
              title={t("account.language")}
            />
          </article>

          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900">
            <h3 className="m-0 mb-2 text-base font-semibold text-slate-900 dark:text-slate-100">{t("account.recentActivity")}</h3>

            {isLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("account.loadingActivity")}</p>
            ) : account?.recentActivity?.length ? (
              account.recentActivity.map((item) => (
                <ActivityRow action={item.action} key={item.id} time={formatRelativeTime(item.createdAt)} title={item.title} />
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t("account.noActivity")}</p>
            )}

            <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M12 8v4l2 2" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              {t("account.lastLogin")}: {formatRelativeTime(profile?.lastLoginAt)}
            </div>
          </article>
        </div>
      </section>

      {activeModal === "profile" && profile ? (
        <AccountEditProfileModal
          initialValues={{ displayName: profile.displayName, handle: profile.handle?.replace(/^@/, "") }}
          onClose={() => setActiveModal("")}
          onSave={async (payload) => {
            await saveProfile(payload);
            await refreshUser();
            addToast({ type: "success", message: t("account.profileUpdated") });
          }}
        />
      ) : null}

      {activeModal === "password" ? (
        <AccountPasswordModal
          onClose={() => setActiveModal("")}
          onSave={async (payload) => {
            await savePassword(payload);
            addToast({ type: "success", message: t("account.passwordUpdated") });
          }}
        />
      ) : null}

      {activeModal === "email" && profile ? (
        <AccountEmailModal
          initialEmail={profile.email}
          onClose={() => setActiveModal("")}
          onSave={async (payload) => {
            await saveEmail(payload);
            await refreshUser();
            addToast({ type: "success", message: t("account.emailUpdated") });
          }}
        />
      ) : null}

      {activeModal === "language" ? (
        <AccountLanguageModal
          currentLanguage={preferences?.language}
          onClose={() => setActiveModal("")}
          onSave={async (payload) => {
            await savePreferences({ language: payload.language });
            setLanguage(payload.language);
            await refreshUser();
            addToast({ type: "success", message: t("account.languageUpdated") });
          }}
        />
      ) : null}
    </DashboardShell>
  );
}
