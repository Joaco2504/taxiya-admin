"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCwIcon, RotateCcwIcon, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { BADGE_CATEGORIES, BADGE_LEVELS } from "@/lib/badges";
import { BadgeArtwork } from "@/components/badges/badge-medal";
import { useLocality } from "@/components/providers/locality-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { BadgeCode, BadgeConfig } from "@/types/taxiya";

type ThresholdMatrix = Record<BadgeCode, [number, number, number, number, number, number]>;

function buildDefaultMatrix(): ThresholdMatrix {
  return {
    punctual: [...BADGE_CATEGORIES[0].defaultThresholds],
    local_fav: [...BADGE_CATEGORIES[1].defaultThresholds],
    impeccable: [...BADGE_CATEGORIES[2].defaultThresholds],
    night_shift: [...BADGE_CATEGORIES[3].defaultThresholds],
    veteran: [...BADGE_CATEGORIES[4].defaultThresholds],
  };
}

export function BadgeConfigsPanel() {
  const { localities, selectedLocalityId } = useLocality();
  const [targetLocalityId, setTargetLocalityId] = useState<string>("");
  const [matrix, setMatrix] = useState<ThresholdMatrix>(buildDefaultMatrix);
  const [existingRowsByCode, setExistingRowsByCode] = useState<
    Map<string, BadgeConfig>
  >(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const effectiveLocalityId = useMemo(() => {
    if (targetLocalityId) return targetLocalityId;
    if (selectedLocalityId !== "all") return selectedLocalityId;
    return localities[0]?.id ?? "";
  }, [targetLocalityId, selectedLocalityId, localities]);

  const loadConfigs = useCallback(async (localityId: string, withSpinner = true) => {
    if (!localityId) return;
    if (withSpinner) setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("badge_configs")
        .select("*")
        .eq("locality_id", localityId);

      if (error) {
        toast.error("No pudimos leer las metas guardadas; mostramos los valores base.");
        setMatrix(buildDefaultMatrix());
        setExistingRowsByCode(new Map());
        return;
      }

      const nextMatrix = buildDefaultMatrix();
      const map = new Map<string, BadgeConfig>();
      for (const row of (data ?? []) as BadgeConfig[]) {
        map.set(row.badge_code, row);
        if (row.badge_code in nextMatrix && Array.isArray(row.thresholds)) {
          const code = row.badge_code as BadgeCode;
          const fallback = nextMatrix[code];
          nextMatrix[code] = [0, 1, 2, 3, 4, 5].map((i) => {
            const v = Number(row.thresholds[i]);
            return Number.isInteger(v) && v > 0 ? v : fallback[i];
          }) as [number, number, number, number, number, number];
        }
      }
      setMatrix(nextMatrix);
      setExistingRowsByCode(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (effectiveLocalityId) {
      void Promise.resolve().then(() => {
        if (active) return loadConfigs(effectiveLocalityId, false);
      });
    }
    return () => {
      active = false;
    };
  }, [effectiveLocalityId, loadConfigs]);

  function handleCellChange(code: BadgeCode, index: number, raw: string) {
    const parsed = Number.parseInt(raw, 10);
    const val = Number.isNaN(parsed) ? 0 : Math.max(1, parsed);
    setMatrix((prev) => {
      const copy = [...prev[code]] as [number, number, number, number, number, number];
      copy[index] = val;
      return { ...prev, [code]: copy };
    });
  }

  function handleRestoreDefaults() {
    setMatrix(buildDefaultMatrix());
    toast.info("Restauramos los valores sugeridos. Tocá Guardar metas para aplicar.");
  }

  async function handleSaveAll() {
    if (!effectiveLocalityId) return;

    for (const cat of BADGE_CATEGORIES) {
      const vals = matrix[cat.code];
      for (let i = 0; i < 6; i++) {
        if (!Number.isInteger(vals[i]) || vals[i] <= 0) {
          toast.error(`Ingresá un número entero mayor a 0 en ${cat.label}.`);
          return;
        }
        if (i > 0 && vals[i] < vals[i - 1]) {
          toast.error(
            `En ${cat.label}, el nivel ${BADGE_LEVELS[i].material} debe ser mayor o igual a ${BADGE_LEVELS[i - 1].material}.`
          );
          return;
        }
      }
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const nowIso = new Date().toISOString();

      for (const cat of BADGE_CATEGORIES) {
        const thresholds = matrix[cat.code];
        const existing = existingRowsByCode.get(cat.code);
        if (existing) {
          const { error } = await supabase
            .from("badge_configs")
            .update({ thresholds, updated_at: nowIso })
            .eq("id", existing.id);
          if (error) {
            toast.error(`Error guardando ${cat.label}: ${error.message}`);
            return;
          }
        } else {
          const { error } = await supabase.from("badge_configs").insert({
            locality_id: effectiveLocalityId,
            badge_code: cat.code,
            thresholds,
            updated_at: nowIso,
          });
          if (error) {
            toast.error(`Error creando ${cat.label}: ${error.message}`);
            return;
          }
        }
      }

      toast.success("Guardamos las metas e insignias de esta localidad.");
      await loadConfigs(effectiveLocalityId);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Configurar metas e insignias (30 niveles)</CardTitle>
            <CardDescription>
              Ajustá los requisitos numéricos de Madera a Obsidiana por localidad (Belén, Andalgalá o nuevas ciudades)
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={effectiveLocalityId}
              onValueChange={setTargetLocalityId}
            >
              <SelectTrigger className="w-52" aria-label="Elegir localidad para metas">
                <SelectValue placeholder="Elegí localidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {localities.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name} · {loc.province}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadConfigs(effectiveLocalityId)}
              disabled={loading || !effectiveLocalityId}
            >
              <RefreshCwIcon data-icon="inline-start" />
              Recargar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRestoreDefaults}
            >
              <RotateCcwIcon data-icon="inline-start" />
              Valores base
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveAll}
              disabled={saving || loading || !effectiveLocalityId}
            >
              <SaveIcon data-icon="inline-start" />
              {saving ? "Guardando..." : "Guardar metas"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          BADGE_CATEGORIES.map((cat) => (
            <div
              key={cat.code}
              className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {cat.label}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {cat.description} · Unidad: {cat.unit}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {BADGE_LEVELS.map((lvl, idx) => (
                  <div
                    key={`${cat.code}-${lvl.level}`}
                    className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <BadgeArtwork code={cat.code} level={lvl.level} size={22} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold truncate">
                          {lvl.material}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Nivel {lvl.level}
                        </span>
                      </div>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      aria-label={`${cat.label} nivel ${lvl.material}`}
                      value={matrix[cat.code][idx]}
                      onChange={(e) =>
                        handleCellChange(cat.code, idx, e.target.value)
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
