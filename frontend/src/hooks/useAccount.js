import { useCallback, useEffect, useState } from "react";
import {
  getAccount,
  updateAccountEmail,
  updateAccountPassword,
  updateAccountPreferences,
  updateAccountProfile,
  uploadAccountAvatar,
  upgradeAccountStorage,
} from "../services/accountApi.js";

export default function useAccount() {
  const [account, setAccount] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAccount = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const data = await getAccount();
      setAccount(data);
      return data;
    } catch (err) {
      setAccount(null);
      const message = err.response?.data?.error || "Could not load account data.";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccount().catch(() => {});
  }, [loadAccount]);

  async function saveProfile(payload) {
    const data = await updateAccountProfile(payload);
    setAccount(data);
    return data;
  }

  async function savePreferences(payload) {
    const data = await updateAccountPreferences(payload);
    setAccount((current) => ({
      ...current,
      preferences: data.preferences,
    }));
    return data;
  }

  async function saveEmail(payload) {
    const data = await updateAccountEmail(payload);
    await loadAccount();
    return data;
  }

  async function savePassword(payload) {
    return updateAccountPassword(payload);
  }

  async function saveAvatar(file) {
    const data = await uploadAccountAvatar(file);
    await loadAccount();
    return data;
  }

  async function upgradeStorage() {
    const data = await upgradeAccountStorage();
    if (data.account) setAccount(data.account);
    return data;
  }

  return {
    account,
    isLoading,
    error,
    loadAccount,
    saveProfile,
    savePreferences,
    saveEmail,
    savePassword,
    saveAvatar,
    upgradeStorage,
  };
}
