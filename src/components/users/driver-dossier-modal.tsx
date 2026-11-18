"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  BanIcon,
  CheckCircle2Icon,
  ExpandIcon,
  FileWarningIcon,
  PauseCircleIcon,
  RotateCcwIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_PRIVATE, BUCKET_PUBLIC } from "@/lib/supabase/config";
import {
  formatAccountStatus,
  formatDateAR,
  getPermitAlertState,
  normalizeStoragePath,
} from "@/lib/format";
import { DriverBadgePill } from "@/components/badges/badge-medal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { AccountStatus, DriverWithProfile } from "@/types/taxiya";

interface ResolvedDocs {
  selfieUrl: string | null;
  licenseFrontUrl: string | null;
  licenseBackUrl: string | null;
  permitUrl: string | null;
  carPhotoUrl: string | null;
}

export function DriverDossierModal({
  driver,
  open,
  onOpenChange,
  onRequestStatusChange,
}: {
  driver: DriverWithProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestStatusChange: (
    userId: string,
    nextStatus: AccountStatus,
    driverName: string
  ) => void;
}) {
  const [docs, setDocs] = useState<ResolvedDocs>({
    selfieUrl: null,
    licenseFrontUrl: null,
    licenseBackUrl: null,
    permitUrl: null,
    carPhotoUrl: null,
  });
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [zoomedPhoto, setZoomedPhoto] = useState<{ label: string; url: string } | null>(null);

  useEffect(() => {
    if (!open || !driver) return;
    let cancelled = false;

    async function resolveUrls() {
      if (!driver) return;
      setLoadingDocs(true);
      try {
        const supabase = createClient();

        const signPrivate = async (raw: string | null): Promise<string | null> => {
          const path = normalizeStoragePath(raw, BUCKET_PRIVATE);
          if (!path) return raw || null;
          const { data, error } = await supabase.storage
            .from(BUCKET_PRIVATE)
            .createSignedUrl(path, 300);
          if (error || !data?.signedUrl) return null;
          return data.signedUrl;
        };

        const resolvePublic = (raw: string | null): string | null => {
          if (!raw) return null;
          const path = normalizeStoragePath(raw, BUCKET_PUBLIC);
          if (!path) return raw;
          const { data } = supabase.storage.from(BUCKET_PUBLIC).getPublicUrl(path);
          return data.publicUrl;
        };

        const [selfieUrl, licenseFrontUrl, licenseBackUrl, permitUrl] = await Promise.all([
          signPrivate(driver.selfie_url),
          signPrivate(driver.license_front_url),
          signPrivate(driver.license_back_url),
          signPrivate(driver.municipal_permit_url),
        ]);

        const carPhotoUrl = resolvePublic(driver.car_photo_url);

        if (!cancelled) {
          setDocs({
            selfieUrl,
            licenseFrontUrl,
            licenseBackUrl,
            permitUrl,
            carPhotoUrl,
          });
        }
      } finally {
        if (!cancelled) setLoadingDocs(false);
      }
    }

    resolveUrls();
    return () => {
      cancelled = true;
    };
  }, [open, driver]);

  if (!driver) return null;

  const profile = driver.profile;
  const status = profile?.account_status ?? "pending";
  const driverName = profile?.full_name || profile?.email || "Chofer sin nombre";
  const permitAlert = getPermitAlertState(driver.permit_expiry_date);

  const initials = driverName
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const photoItems = [
    { key: "selfie", label: "Selfie del chofer (privado)", url: docs.selfieUrl },
    { key: "front", label: "Carnet de conducir · Frente (privado)", url: docs.licenseFrontUrl },
    { key: "back", label: "Carnet de conducir · Dorso (privado)", url: docs.licenseBackUrl },
    { key: "permit", label: "Habilitación municipal (privado)", url: docs.permitUrl },
    { key: "car", label: "Foto del auto (público)", url: docs.carPhotoUrl },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] w-full sm:max-w-2xl md:max-w-3xl overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-3">
              <Avatar className="size-11">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt={driverName} />
                ) : null}
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5">
                <DialogTitle className="text-lg">{driverName}</DialogTitle>
                <DialogDescription>
                  Legajo de habilitación y documentación verificable ·{" "}
                  {driver.locality?.name ?? "Sin localidad"}
                </DialogDescription>
              </div>
              <Badge
                className="ml-auto"
                variant={
                  status === "active"
                    ? "success"
                    : status === "pending"
                      ? "warning"
                      : "destructive"
                }
              >
                {formatAccountStatus(status)}
              </Badge>
            </div>
          </DialogHeader>

          {permitAlert.state === "expired" || permitAlert.state === "expiring_soon" ? (
            <Alert variant={permitAlert.state === "expired" ? "destructive" : "default"}>
              <AlertTriangleIcon />
              <AlertTitle>
                {permitAlert.state === "expired"
                  ? "Habilitación municipal vencida"
                  : "Habilitación próxima a vencer"}
              </AlertTitle>
              <AlertDescription>
                {permitAlert.state === "expired"
                  ? `La habilitación venció el ${formatDateAR(driver.permit_expiry_date)}. No debería operar hasta presentar renovación.`
                  : `La habilitación vence el ${formatDateAR(driver.permit_expiry_date)} (quedan ${permitAlert.daysLeft} días).`}
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Datos del chofer y vehículo */}
          <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-background p-4 sm:grid-cols-2 text-sm">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Teléfono</span>
              <span className="font-medium break-words">
                {profile?.phone || "No informado"}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Correo</span>
              <span className="font-medium break-all">
                {profile?.email || "No informado"}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Modalidad</span>
              <span className="font-medium break-words">
                {driver.company ? driver.company.name : "Taxi independiente"}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Vehículo</span>
              <span className="font-medium break-words">
                {[driver.car_brand, driver.car_model, driver.car_color]
                  .filter(Boolean)
                  .join(" · ") || "Sin cargar"}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Patente</span>
              <span className="font-mono font-semibold break-all">
                {driver.plate_number || "Sin patente"}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Vencimiento habilitación</span>
              <span className="font-medium">{formatDateAR(driver.permit_expiry_date)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4 text-sm">
            <span className="text-xs font-medium text-muted-foreground">
              Insignias y nivel alcanzado
            </span>
            {driver.badges && driver.badges.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {driver.badges.map((b) => (
                  <DriverBadgePill key={b.id} badge={b} />
                ))}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                Nivel 0 — Todavía no desbloqueó insignias en su localidad.
              </span>
            )}
          </div>

          <Separator />

          {/* Documentación en Storage */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Documentación adjunta</h3>
              <span className="text-xs text-muted-foreground">
                URLs firmadas temporales (5 minutos) para archivos privados
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {photoItems.map((item) => (
                <div
                  key={item.key}
                  className="flex flex-col overflow-hidden rounded-lg border border-border bg-background"
                >
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <span className="truncate text-xs font-medium">{item.label}</span>
                    {item.url ? (
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Ampliar ${item.label}`}
                        onClick={() => setZoomedPhoto({ label: item.label, url: item.url! })}
                      >
                        <ExpandIcon />
                      </Button>
                    ) : null}
                  </div>
                  <div className="relative flex h-44 items-center justify-center bg-muted/40">
                    {loadingDocs ? (
                      <Skeleton className="h-full w-full" />
                    ) : item.url ? (
                      <img
                        src={item.url}
                        alt={item.label}
                        className="h-full w-full cursor-zoom-in object-cover"
                        onClick={() => setZoomedPhoto({ label: item.label, url: item.url! })}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 px-4 text-center text-xs text-muted-foreground">
                        <FileWarningIcon className="size-6 opacity-60" />
                        <span>Archivo sin subir</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="flex flex-wrap justify-between gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              {status === "pending" ? (
                <Button
                  type="button"
                  onClick={() => onRequestStatusChange(driver.user_id, "active", driverName)}
                >
                  <CheckCircle2Icon data-icon="inline-start" />
                  Aprobar chofer
                </Button>
              ) : null}

              {status === "active" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onRequestStatusChange(driver.user_id, "suspended", driverName)}
                >
                  <PauseCircleIcon data-icon="inline-start" />
                  Suspender temporalmente
                </Button>
              ) : null}

              {status !== "revoked" ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => onRequestStatusChange(driver.user_id, "revoked", driverName)}
                >
                  <BanIcon data-icon="inline-start" />
                  Revocar permisos
                </Button>
              ) : null}

              {status === "suspended" || status === "revoked" ? (
                <Button
                  type="button"
                  onClick={() => onRequestStatusChange(driver.user_id, "active", driverName)}
                >
                  <RotateCcwIcon data-icon="inline-start" />
                  Reactivar
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visor ampliado de documento */}
      <Dialog open={Boolean(zoomedPhoto)} onOpenChange={() => setZoomedPhoto(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{zoomedPhoto?.label}</DialogTitle>
            <DialogDescription>Vista ampliada para verificación de legajo.</DialogDescription>
          </DialogHeader>
          {zoomedPhoto ? (
            <div className="overflow-hidden rounded-lg border border-border bg-black/5">
              <img
                src={zoomedPhoto.url}
                alt={zoomedPhoto.label}
                className="max-h-[75vh] w-full object-contain"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
