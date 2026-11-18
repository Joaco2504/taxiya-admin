import type {
  AccountStatus,
  LandmarkStatus,
  SubscriptionTier,
  TicketStatus,
  TripStatus,
} from "@/types/taxiya";

const AR_TIMEZONE = "America/Argentina/Catamarca";

export function formatDateAR(value: string | Date | null | undefined): string {
  if (!value) return "Sin fecha";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Fecha inválida";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: AR_TIMEZONE,
  }).format(date);
}

export function formatDateTimeAR(value: string | Date | null | undefined): string {
  if (!value) return "Sin fecha";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Fecha inválida";
  const fecha = formatDateAR(date);
  const hora = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: AR_TIMEZONE,
  }).format(date);
  return `${fecha} · ${hora} hs`;
}

export function formatTimeAR(value: string | Date | null | undefined): string {
  if (!value) return "--:--";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "--:--";
  const hora = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: AR_TIMEZONE,
  }).format(date);
  return `${hora} hs`;
}

export function daysUntilDate(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  return Math.ceil((startOfTarget - startOfToday) / (1000 * 60 * 60 * 24));
}

export type PermitAlertState = "missing" | "expired" | "expiring_soon" | "valid";

export function getPermitAlertState(permitExpiryDate: string | null | undefined): {
  state: PermitAlertState;
  daysLeft: number | null;
} {
  const daysLeft = daysUntilDate(permitExpiryDate);
  if (daysLeft === null) return { state: "missing", daysLeft: null };
  if (daysLeft < 0) return { state: "expired", daysLeft };
  if (daysLeft <= 15) return { state: "expiring_soon", daysLeft };
  return { state: "valid", daysLeft };
}

export function normalizeStoragePath(
  urlOrPath: string | null | undefined,
  bucketName: "taxiya_public" | "taxiya_private"
): string | null {
  if (!urlOrPath) return null;
  const trimmed = urlOrPath.trim();
  if (!trimmed) return null;

  // Si ya es ruta relativa al bucket
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return trimmed.replace(new RegExp(`^/?${bucketName}/`), "").replace(/^\/+/, "");
  }

  // Si es URL completa de Supabase Storage, extraemos el path interno
  const marker = `/${bucketName}/`;
  const idx = trimmed.indexOf(marker);
  if (idx !== -1) {
    const afterBucket = trimmed.slice(idx + marker.length);
    return afterBucket.split("?")[0] || null;
  }

  return null;
}

export function formatAccountStatus(status: AccountStatus): string {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "active":
      return "Activo";
    case "suspended":
      return "Suspendido";
    case "revoked":
      return "Revocado";
  }
}

export function formatSubscriptionTier(tier: SubscriptionTier): string {
  switch (tier) {
    case "free":
      return "Gratuito ($ 0)";
    case "no_ads":
      return "Sin publicidad ($ 2 USD/mes)";
    case "premium":
      return "Premium ($ 3 USD/mes)";
  }
}

export function formatLandmarkStatus(status: LandmarkStatus): string {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "approved":
      return "Aprobado";
    case "rejected":
      return "Rechazado";
  }
}

export function formatTripStatus(status: TripStatus): string {
  switch (status) {
    case "searching":
    case "requested":
      return "Buscando taxi";
    case "accepted":
      return "Aceptado";
    case "arriving":
      return "En camino al origen";
    case "in_door":
      return "En la puerta";
    case "in_progress":
      return "En curso";
    case "waiting":
    case "waiting_return":
      return "En espera (ida y vuelta)";
    case "completed":
      return "Completado";
    case "cancelled":
      return "Cancelado";
  }
}

export function formatTicketStatus(status: TicketStatus): string {
  switch (status) {
    case "open":
      return "Abierto";
    case "in_review":
      return "En revisión";
    case "in_progress":
      return "En proceso";
    case "resolved":
      return "Resuelto";
    case "closed":
      return "Cerrado";
  }
}

export const LANDMARK_CATEGORIES = [
  "Plaza",
  "Hospital / CAPS",
  "Escuela",
  "Terminal / Parada",
  "Comercio",
  "Edificio público",
  "Barrio",
  "Otro",
] as const;

export function sanitizeWhatsAppDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54")) return `549${digits.slice(2)}`;
  if (digits.startsWith("0")) return `549${digits.slice(1)}`;
  return `549${digits}`;
}

export function buildWhatsAppTarget(phone: string, message: string): string {
  const digits = sanitizeWhatsAppDigits(phone);
  const text = message.trim();
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function parseWhatsAppTarget(target: string): { phone: string; message: string } {
  if (!target) return { phone: "", message: "" };
  try {
    if (target.startsWith("http")) {
      const url = new URL(target);
      const pathDigits = url.pathname.replace(/\D/g, "");
      const msg = url.searchParams.get("text") ?? "";
      return { phone: pathDigits ? `+${pathDigits}` : "", message: msg };
    }
  } catch {
    // Fallback abajo
  }
  return { phone: target, message: "" };
}

export function addDaysToISODate(dateStr: string, days: number): string {
  const base = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(base.getTime())) return dateStr;
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

export function todayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
