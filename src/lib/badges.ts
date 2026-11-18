import type { BadgeCode, DriverBadge } from "@/types/taxiya";

export interface BadgeLevelMeta {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  material: string;
  fileSuffix: string;
  color: string;
  prioritySeconds: number;
  rewardSummary: string;
}

export interface BadgeCategoryMeta {
  code: BadgeCode;
  label: string;
  filePrefix: string;
  unit: string;
  description: string;
  defaultThresholds: [number, number, number, number, number, number];
}

export const BADGE_LEVELS: readonly BadgeLevelMeta[] = [
  {
    level: 1,
    material: "Madera",
    fileSuffix: "1_madera",
    color: "#8B5A2B",
    prioritySeconds: 2,
    rewardSummary: "Insignia visible al pasajero y +2 s de prioridad",
  },
  {
    level: 2,
    material: "Cobre",
    fileSuffix: "2_cobre",
    color: "#B87333",
    prioritySeconds: 2,
    rewardSummary: "Insignia visible al pasajero y +2 s de prioridad",
  },
  {
    level: 3,
    material: "Plata",
    fileSuffix: "3_plata",
    color: "#94A3B8",
    prioritySeconds: 5,
    rewardSummary: "Borde Plata en ficha del pasajero y +5 s de prioridad",
  },
  {
    level: 4,
    material: "Oro",
    fileSuffix: "4_oro",
    color: "#F59E0B",
    prioritySeconds: 5,
    rewardSummary: "Borde Oro en ficha del pasajero y +5 s de prioridad",
  },
  {
    level: 5,
    material: "Diamante",
    fileSuffix: "5_diamante",
    color: "#38BDF8",
    prioritySeconds: 8,
    rewardSummary: "Borde Diamante, +8 s de prioridad y estadísticas por zona (15 días)",
  },
  {
    level: 6,
    material: "Obsidiana",
    fileSuffix: "6_obsidiana",
    color: "#312E81",
    prioritySeconds: 8,
    rewardSummary: "Borde Obsidiana, +8 s de prioridad y estadísticas por zona (15 días)",
  },
] as const;

export const BADGE_CATEGORIES: readonly BadgeCategoryMeta[] = [
  {
    code: "punctual",
    label: "Conductor Puntual",
    filePrefix: "puntual",
    unit: "viajes puntuales",
    description: "Viajes completados sin demoras al recoger al pasajero.",
    defaultThresholds: [5, 15, 35, 70, 120, 200],
  },
  {
    code: "local_fav",
    label: "Favorito del Pueblo",
    filePrefix: "favorito",
    unit: "votos positivos (4-5★)",
    description: "Calificaciones de 4 o 5 estrellas recibidas de pasajeros.",
    defaultThresholds: [3, 10, 25, 50, 100, 200],
  },
  {
    code: "impeccable",
    label: "Servicio Impecable",
    filePrefix: "impecable",
    unit: "viajes sin cancelar",
    description: "Racha continua de viajes finalizados sin cancelar.",
    defaultThresholds: [5, 15, 30, 60, 100, 180],
  },
  {
    code: "night_shift",
    label: "Turno Nocturno",
    filePrefix: "nocturno",
    unit: "viajes nocturnos",
    description: "Traslados entre las 00:00 y las 06:00 hs.",
    defaultThresholds: [3, 8, 20, 40, 75, 120],
  },
  {
    code: "veteran",
    label: "Veterano Local",
    filePrefix: "veterano",
    unit: "viajes completados",
    description: "Total histórico de viajes completados en su localidad.",
    defaultThresholds: [10, 30, 75, 150, 300, 500],
  },
] as const;

export function getBadgeCategoryMeta(code: string): BadgeCategoryMeta | undefined {
  return BADGE_CATEGORIES.find((c) => c.code === code);
}

export function getBadgeLevelMeta(level: number | null | undefined): BadgeLevelMeta {
  const safe = Math.min(6, Math.max(1, Number(level || 1))) as 1 | 2 | 3 | 4 | 5 | 6;
  return BADGE_LEVELS.find((l) => l.level === safe) ?? BADGE_LEVELS[0];
}

export function getBadgeFileName(code: string, level: number | null | undefined): string {
  const cat = getBadgeCategoryMeta(code) ?? BADGE_CATEGORIES[0];
  const lvl = getBadgeLevelMeta(level);
  return `${cat.filePrefix}_${lvl.fileSuffix}.png`;
}

export function getBadgeImagePath(code: string, level: number | null | undefined): string {
  return `/badges/${getBadgeFileName(code, level)}`;
}

export function dedupeActiveDriverBadges(rows: DriverBadge[]): DriverBadge[] {
  const now = Date.now();
  const byCode = new Map<string, DriverBadge>();
  for (const row of rows) {
    if (row.expires_at && new Date(row.expires_at).getTime() <= now) continue;
    const prev = byCode.get(row.badge_code);
    const nextLvl = row.level ?? 1;
    const prevLvl = prev?.level ?? 0;
    if (!prev || nextLvl > prevLvl) {
      byCode.set(row.badge_code, row);
    }
  }
  return Array.from(byCode.values()).sort(
    (a, b) => (b.level ?? 1) - (a.level ?? 1)
  );
}
