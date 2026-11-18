"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { playEmergencyAlertTone, unlockEmergencyAudio } from "@/lib/emergency-audio";
import type { SupportTicket } from "@/types/taxiya";

interface EmergencyContextValue {
  activeEmergencies: SupportTicket[];
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  testSound: () => void;
  refreshEmergencies: () => Promise<void>;
  resolveTicket: (ticketId: string) => Promise<boolean>;
}

const EmergencyContext = createContext<EmergencyContextValue | null>(null);

async function fetchOpenEmergencies(): Promise<SupportTicket[] | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("is_emergency", true)
    .in("status", ["open", "in_review", "in_progress"])
    .order("created_at", { ascending: false });

  if (error || !data) return null;
  return data as SupportTicket[];
}

export function EmergencyProvider({ children }: { children: React.ReactNode }) {
  const [activeEmergencies, setActiveEmergencies] = useState<SupportTicket[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const mutedRef = useRef(isMuted);

  useEffect(() => {
    mutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const unlock = () => unlockEmergencyAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const refreshEmergencies = useCallback(async () => {
    const data = await fetchOpenEmergencies();
    if (data) setActiveEmergencies(data);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const data = await fetchOpenEmergencies();
      if (active && data) setActiveEmergencies(data);
    })();

    const supabase = createClient();
    const channel = supabase
      .channel("taxiya-emergency-tickets")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "taxiya",
          table: "support_tickets",
        },
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const row = payload.new as unknown as SupportTicket | undefined;
          if (payload.eventType === "INSERT" && row && row.is_emergency) {
            setActiveEmergencies((prev) => {
              if (prev.some((t) => t.id === row.id)) return prev;
              return [row, ...prev];
            });
            if (!mutedRef.current) {
              playEmergencyAlertTone();
            }
            toast.error("Alerta de emergencia en curso", {
              description: row.description || "Un usuario activó el botón de emergencia.",
              duration: 10000,
            });
          } else {
            void refreshEmergencies();
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [refreshEmergencies]);

  const resolveTicket = useCallback(async (ticketId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: "resolved" })
      .eq("id", ticketId);

    if (error) {
      toast.error("No pudimos cerrar el ticket. Probá de nuevo.");
      return false;
    }

    setActiveEmergencies((prev) => prev.filter((t) => t.id !== ticketId));
    toast.success("Emergencia marcada como resuelta.");
    return true;
  }, []);

  const testSound = useCallback(() => {
    unlockEmergencyAudio();
    playEmergencyAlertTone();
  }, []);

  const value = useMemo<EmergencyContextValue>(
    () => ({
      activeEmergencies,
      isMuted,
      setIsMuted,
      testSound,
      refreshEmergencies,
      resolveTicket,
    }),
    [activeEmergencies, isMuted, testSound, refreshEmergencies, resolveTicket]
  );

  return <EmergencyContext value={value}>{children}</EmergencyContext>;
}

export function useEmergencies() {
  const ctx = useContext(EmergencyContext);
  if (!ctx) {
    throw new Error("useEmergencies debe usarse dentro de EmergencyProvider");
  }
  return ctx;
}
