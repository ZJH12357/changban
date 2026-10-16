"use client";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PET, parsePetPreferences, type PetPreferences } from "@/lib/pet";

export function usePetPreferences(username: string | null) {
  const key = username ? `changban-pet-v2:${username}` : null;
  const [stored, setStored] = useState<{ key: string | null; value: PetPreferences }>({ key: null, value: DEFAULT_PET });
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    if (!key) return;
    try { setStored({ key, value: parsePetPreferences(JSON.parse(localStorage.getItem(key) || "null")) }); }
    catch { setStored({ key, value: parsePetPreferences(null) }); }
    const sync = (e: StorageEvent) => {
      if (e.key === key) { try { setStored({ key, value: parsePetPreferences(JSON.parse(e.newValue || "null")) }); } catch { /* Keep the last valid preferences. */ } }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key]);
  const update = useCallback((patch: Partial<PetPreferences>) => {
    setStored(previous => {
      const value = parsePetPreferences({ ...(previous.key === key ? previous.value : DEFAULT_PET), ...patch });
      if (key) { try { localStorage.setItem(key, JSON.stringify(value)); setStorageError(false); } catch { setStorageError(true); } }
      return { key, value };
    });
  }, [key]);
  return { preferences: stored.key === key ? stored.value : DEFAULT_PET, ready: !!key && stored.key === key, update, storageError };
}
