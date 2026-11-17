"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { Locality, TaxiCompany } from "@/types/taxiya";

interface LocalityContextValue {
  localities: Locality[];
  companies: TaxiCompany[];
  selectedLocalityId: string; // "all" o UUID
  selectedLocality: Locality | null;
  setSelectedLocalityId: (id: string) => void;
  refreshReferenceData: () => Promise<void>;
  loading: boolean;
}

const LocalityContext = createContext<LocalityContextValue | null>(null);

const STORAGE_KEY = "taxiya_selected_locality";
const CHANGE_EVENT = "taxiya-locality-change";

function subscribeLocalityStore(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function readStoredLocalityId(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "all";
  } catch {
    return "all";
  }
}

export function LocalityProvider({
  initialLocalities,
  initialCompanies,
  children,
}: {
  initialLocalities: Locality[];
  initialCompanies: TaxiCompany[];
  children: React.ReactNode;
}) {
  const [localities, setLocalities] = useState<Locality[]>(initialLocalities);
  const [companies, setCompanies] = useState<TaxiCompany[]>(initialCompanies);
  const [loading, setLoading] = useState(false);

  const rawStoredId = useSyncExternalStore(
    subscribeLocalityStore,
    readStoredLocalityId,
    () => "all"
  );

  const selectedLocalityId = useMemo(() => {
    if (rawStoredId === "all") return "all";
    return localities.some((l) => l.id === rawStoredId) ? rawStoredId : "all";
  }, [rawStoredId, localities]);

  const setSelectedLocalityId = useCallback((id: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // Ignorado si localStorage no está disponible
    }
  }, []);

  const refreshReferenceData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const [locRes, compRes] = await Promise.all([
        supabase.from("localities").select("*").order("name", { ascending: true }),
        supabase.from("taxi_companies").select("*").order("name", { ascending: true }),
      ]);
      if (locRes.data) setLocalities(locRes.data as Locality[]);
      if (compRes.data) setCompanies(compRes.data as TaxiCompany[]);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectedLocality = useMemo(() => {
    if (selectedLocalityId === "all") return null;
    return localities.find((l) => l.id === selectedLocalityId) ?? null;
  }, [localities, selectedLocalityId]);

  const value = useMemo<LocalityContextValue>(
    () => ({
      localities,
      companies,
      selectedLocalityId,
      selectedLocality,
      setSelectedLocalityId,
      refreshReferenceData,
      loading,
    }),
    [
      localities,
      companies,
      selectedLocalityId,
      selectedLocality,
      setSelectedLocalityId,
      refreshReferenceData,
      loading,
    ]
  );

  return <LocalityContext value={value}>{children}</LocalityContext>;
}

export function useLocality() {
  const ctx = useContext(LocalityContext);
  if (!ctx) {
    throw new Error("useLocality debe usarse dentro de LocalityProvider");
  }
  return ctx;
}
