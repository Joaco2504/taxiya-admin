"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangleIcon,
  BanIcon,
  CheckCircle2Icon,
  FileTextIcon,
  PauseCircleIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  formatAccountStatus,
  formatDateAR,
  formatSubscriptionTier,
  getPermitAlertState,
} from "@/lib/format";
import { dedupeActiveDriverBadges } from "@/lib/badges";
import { useLocality } from "@/components/providers/locality-provider";
import { BadgeConfigsPanel } from "@/components/badges/badge-configs-panel";
import { DriverBadgePill } from "@/components/badges/badge-medal";
import { DriverDossierModal } from "@/components/users/driver-dossier-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  AccountStatus,
  DriverBadge,
  DriverDetails,
  DriverWithProfile,
  Profile,
  SubscriptionTier,
} from "@/types/taxiya";

interface PendingStatusChange {
  userId: string;
  nextStatus: AccountStatus;
  userName: string;
  roleLabel: "chofer" | "pasajero";
}

function statusBadgeVariant(status: AccountStatus) {
  switch (status) {
    case "active":
      return "success" as const;
    case "pending":
      return "warning" as const;
    case "suspended":
    case "revoked":
      return "destructive" as const;
  }
}

export function UsersManagementView() {
  const { localities, companies, selectedLocalityId } = useLocality();

  const [drivers, setDrivers] = useState<DriverWithProfile[]>([]);
  const [passengers, setPassengers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros Taxistas
  const [driverStatusFilter, setDriverStatusFilter] = useState<string>("all");
  const [modalityFilter, setModalityFilter] = useState<string>("all"); // all | company | independent | company:<id>
  const [driverQuery, setDriverQuery] = useState("");

  // Filtros Pasajeros
  const [passengerStatusFilter, setPassengerStatusFilter] = useState<string>("all");
  const [passengerTierFilter, setPassengerTierFilter] = useState<string>("all");
  const [passengerQuery, setPassengerQuery] = useState("");

  // Modales
  const [selectedDriver, setSelectedDriver] = useState<DriverWithProfile | null>(null);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [confirmChange, setConfirmChange] = useState<PendingStatusChange | null>(null);

  const localityById = useMemo(
    () => new Map(localities.map((l) => [l.id, l])),
    [localities]
  );
  const companyById = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies]
  );

  const fetchUsersData = useCallback(async (withSpinner: boolean) => {
    if (withSpinner) setLoading(true);
    try {
      const supabase = createClient();
      const [profRes, drvRes, badgeRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .in("role", ["driver", "passenger"])
          .order("created_at", { ascending: false }),
        supabase.from("driver_details").select("*"),
        supabase.from("driver_badges").select("*"),
      ]);

      if (profRes.error) {
        toast.error("No pudimos cargar los usuarios porque falló la consulta. Probá recargar.");
        return;
      }

      const allProfiles = (profRes.data ?? []) as Profile[];
      const driverProfiles = allProfiles.filter((p) => p.role === "driver");
      const passengerProfiles = allProfiles.filter((p) => p.role === "passenger");

      const detailsByUserId = new Map<string, DriverDetails>(
        ((drvRes.data ?? []) as DriverDetails[]).map((d) => [d.user_id, d])
      );
      const badgesByDriverId = new Map<string, DriverBadge[]>();
      for (const row of (badgeRes.data ?? []) as DriverBadge[]) {
        const list = badgesByDriverId.get(row.driver_id) ?? [];
        list.push(row);
        badgesByDriverId.set(row.driver_id, list);
      }

      // Unimos perfiles de taxistas con su detalle (aunque aún no hayan cargado driver_details)
      const mergedDrivers: DriverWithProfile[] = driverProfiles.map((prof) => {
        const d = detailsByUserId.get(prof.id);
        const base: DriverDetails = d ?? {
          user_id: prof.id,
          company_id: null,
          car_brand: null,
          car_model: null,
          car_color: null,
          plate_number: null,
          car_photo_url: null,
          selfie_url: null,
          license_front_url: null,
          license_back_url: null,
          municipal_permit_url: null,
          permit_expiry_date: null,
          is_online: false,
          current_location: null,
          last_location_at: null,
          rating_avg: null,
          total_trips: 0,
          updated_at: prof.updated_at,
        };
        return {
          ...base,
          profile: prof,
          company: base.company_id ? companyById.get(base.company_id) ?? null : null,
          locality: prof.locality_id ? localityById.get(prof.locality_id) ?? null : null,
          badges: dedupeActiveDriverBadges(badgesByDriverId.get(prof.id) ?? []),
        };
      });

      setDrivers(mergedDrivers);
      setPassengers(passengerProfiles);
    } finally {
      setLoading(false);
    }
  }, [companyById, localityById]);

  const loadUsers = useCallback(() => fetchUsersData(true), [fetchUsersData]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchUsersData(false);
    });
    return () => {
      active = false;
    };
  }, [fetchUsersData]);

  async function applyAccountStatus(
    userId: string,
    nextStatus: AccountStatus,
    userName: string
  ) {
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        account_status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      toast.error(`No pudimos actualizar a ${userName}: ${error.message}`);
      return;
    }

    // Si se suspende o revoca un chofer, lo desconectamos de inmediato
    if (nextStatus === "suspended" || nextStatus === "revoked") {
      await supabase
        .from("driver_details")
        .update({ is_online: false })
        .eq("user_id", userId);
    }

    const actionLabels: Record<AccountStatus, string> = {
      active: `${userName} quedó activo.`,
      pending: `${userName} volvió a estado pendiente.`,
      suspended: `${userName} fue suspendido temporalmente.`,
      revoked: `Se revocaron los permisos de ${userName}.`,
    };
    toast.success(actionLabels[nextStatus]);

    await loadUsers();
    if (selectedDriver?.user_id === userId) {
      setDossierOpen(false);
    }
  }

  function requestStatusChange(
    userId: string,
    nextStatus: AccountStatus,
    userName: string,
    roleLabel: "chofer" | "pasajero"
  ) {
    if (nextStatus === "suspended" || nextStatus === "revoked") {
      setConfirmChange({ userId, nextStatus, userName, roleLabel });
      return;
    }
    applyAccountStatus(userId, nextStatus, userName);
  }

  const filteredDrivers = useMemo(() => {
    const q = driverQuery.trim().toLowerCase();
    return drivers.filter((d) => {
      const prof = d.profile;
      if (selectedLocalityId !== "all" && prof?.locality_id !== selectedLocalityId) {
        return false;
      }
      if (driverStatusFilter !== "all" && prof?.account_status !== driverStatusFilter) {
        return false;
      }
      if (modalityFilter === "independent" && d.company_id !== null) {
        return false;
      }
      if (modalityFilter === "company" && d.company_id === null) {
        return false;
      }
      if (modalityFilter.startsWith("company:")) {
        const targetCompany = modalityFilter.slice("company:".length);
        if (d.company_id !== targetCompany) return false;
      }
      if (q) {
        const haystack = [
          prof?.full_name,
          prof?.phone,
          prof?.email,
          d.plate_number,
          d.car_brand,
          d.car_model,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [drivers, selectedLocalityId, driverStatusFilter, modalityFilter, driverQuery]);

  const filteredPassengers = useMemo(() => {
    const q = passengerQuery.trim().toLowerCase();
    return passengers.filter((p) => {
      if (selectedLocalityId !== "all" && p.locality_id !== selectedLocalityId) {
        return false;
      }
      if (passengerStatusFilter !== "all" && p.account_status !== passengerStatusFilter) {
        return false;
      }
      if (passengerTierFilter !== "all" && p.subscription_tier !== passengerTierFilter) {
        return false;
      }
      if (q) {
        const haystack = [p.full_name, p.phone, p.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [passengers, selectedLocalityId, passengerStatusFilter, passengerTierFilter, passengerQuery]);

  const availableCompanies = useMemo(() => {
    if (selectedLocalityId === "all") return companies;
    return companies.filter((c) => c.locality_id === selectedLocalityId);
  }, [companies, selectedLocalityId]);

  const expiringDriversCount = useMemo(() => {
    return filteredDrivers.filter((d) => {
      const alert = getPermitAlertState(d.permit_expiry_date);
      return alert.state === "expiring_soon" || alert.state === "expired";
    }).length;
  }, [filteredDrivers]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Usuarios y legajos</h1>
          <p className="text-sm text-muted-foreground">
            Verificación de habilitaciones municipales, documentación privada de taxistas y moderación de pasajeros.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {expiringDriversCount > 0 ? (
            <Badge variant="warning">
              <AlertTriangleIcon />
              {expiringDriversCount}{" "}
              {expiringDriversCount === 1
                ? "habilitación por vencer o vencida"
                : "habilitaciones por vencer o vencidas"}
            </Badge>
          ) : null}
          <Button variant="outline" size="sm" onClick={loadUsers}>
            <RefreshCwIcon data-icon="inline-start" />
            Actualizar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="drivers" className="flex flex-col gap-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="drivers">
            Taxistas ({filteredDrivers.length})
          </TabsTrigger>
          <TabsTrigger value="passengers">
            Pasajeros ({filteredPassengers.length})
          </TabsTrigger>
          <TabsTrigger value="badges">
            Configurar metas e insignias
          </TabsTrigger>
        </TabsList>

        {/* PESTAÑA TAXISTAS */}
        <TabsContent value="drivers">
          <Card>
            <CardHeader>
              <CardTitle>Bandeja de taxistas</CardTitle>
              <CardDescription>
                Filtrá por estado, modalidad de flota y revisá el legajo antes de aprobar.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <InputGroup className="md:col-span-2">
                  <InputGroupAddon>
                    <SearchIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="search"
                    placeholder="Buscar por nombre, patente o teléfono"
                    value={driverQuery}
                    onChange={(e) => setDriverQuery(e.target.value)}
                  />
                </InputGroup>

                <Select value={driverStatusFilter} onValueChange={setDriverStatusFilter}>
                  <SelectTrigger aria-label="Filtrar taxistas por estado">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="pending">Pendientes</SelectItem>
                      <SelectItem value="active">Activos</SelectItem>
                      <SelectItem value="suspended">Suspendidos</SelectItem>
                      <SelectItem value="revoked">Revocados</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <Select value={modalityFilter} onValueChange={setModalityFilter}>
                  <SelectTrigger aria-label="Filtrar por modalidad">
                    <SelectValue placeholder="Modalidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">Todas las modalidades</SelectItem>
                      <SelectItem value="independent">Independiente</SelectItem>
                      <SelectItem value="company">Todas las empresas</SelectItem>
                      {availableCompanies.map((c) => (
                        <SelectItem key={c.id} value={`company:${c.id}`}>
                          Empresa: {c.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : filteredDrivers.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <UsersIcon />
                    </EmptyMedia>
                    <EmptyTitle>No hay taxistas con estos filtros</EmptyTitle>
                    <EmptyDescription>
                      Cuando se registre un chofer o cambies los filtros de estado y localidad, aparece acá.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Chofer</TableHead>
                        <TableHead>Localidad</TableHead>
                        <TableHead>Modalidad</TableHead>
                        <TableHead>Vehículo y patente</TableHead>
                        <TableHead>Insignias</TableHead>
                        <TableHead>Vencimiento habilitación</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDrivers.map((d) => {
                        const prof = d.profile;
                        const status: AccountStatus = prof?.account_status ?? "pending";
                        const name = prof?.full_name || prof?.email || "Sin nombre";
                        const permit = getPermitAlertState(d.permit_expiry_date);

                        return (
                          <TableRow key={d.user_id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {prof?.phone || prof?.email || "Sin contacto"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{d.locality?.name ?? "Sin zona"}</TableCell>
                            <TableCell>
                              {d.company ? (
                                <Badge variant="secondary">{d.company.name}</Badge>
                              ) : (
                                <Badge variant="outline">Independiente</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col text-xs">
                                <span className="font-medium">
                                  {[d.car_brand, d.car_model].filter(Boolean).join(" ") ||
                                    "Vehículo sin datos"}
                                </span>
                                <span className="font-mono text-muted-foreground">
                                  {d.plate_number || "Sin patente"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {d.badges && d.badges.length > 0 ? (
                                <div className="flex max-w-52 flex-wrap gap-1">
                                  {d.badges.slice(0, 2).map((b) => (
                                    <DriverBadgePill key={b.id} badge={b} compact />
                                  ))}
                                  {d.badges.length > 2 ? (
                                    <Badge variant="outline">+{d.badges.length - 2}</Badge>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Nivel 0
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="text-xs">
                                  {formatDateAR(d.permit_expiry_date)}
                                </span>
                                {permit.state === "expired" ? (
                                  <Badge variant="destructive">
                                    <AlertTriangleIcon />
                                    Vencida
                                  </Badge>
                                ) : null}
                                {permit.state === "expiring_soon" ? (
                                  <Badge variant="warning">
                                    <AlertTriangleIcon />
                                    {permit.daysLeft === 0
                                      ? "Vence hoy"
                                      : `Vence en ${permit.daysLeft} d`}
                                  </Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusBadgeVariant(status)}>
                                {formatAccountStatus(status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedDriver(d);
                                    setDossierOpen(true);
                                  }}
                                >
                                  <FileTextIcon data-icon="inline-start" />
                                  Legajo
                                </Button>

                                {status === "pending" ? (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      requestStatusChange(d.user_id, "active", name, "chofer")
                                    }
                                  >
                                    <CheckCircle2Icon data-icon="inline-start" />
                                    Aprobar
                                  </Button>
                                ) : null}

                                {status === "active" ? (
                                  <Button
                                    size="icon-sm"
                                    variant="outline"
                                    title="Suspender temporalmente"
                                    aria-label={`Suspender a ${name}`}
                                    onClick={() =>
                                      requestStatusChange(d.user_id, "suspended", name, "chofer")
                                    }
                                  >
                                    <PauseCircleIcon />
                                  </Button>
                                ) : null}

                                {status === "suspended" || status === "revoked" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      requestStatusChange(d.user_id, "active", name, "chofer")
                                    }
                                  >
                                    <RotateCcwIcon data-icon="inline-start" />
                                    Reactivar
                                  </Button>
                                ) : null}

                                {status !== "revoked" ? (
                                  <Button
                                    size="icon-sm"
                                    variant="destructive"
                                    title="Revocar permisos"
                                    aria-label={`Revocar permisos de ${name}`}
                                    onClick={() =>
                                      requestStatusChange(d.user_id, "revoked", name, "chofer")
                                    }
                                  >
                                    <BanIcon />
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PESTAÑA PASAJEROS */}
        <TabsContent value="passengers">
          <Card>
            <CardHeader>
              <CardTitle>Pasajeros registrados</CardTitle>
              <CardDescription>
                Estado de cuenta, plan de suscripción (Gratuito, Sin publicidad o Premium) y controles de moderación.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <InputGroup className="md:col-span-2">
                  <InputGroupAddon>
                    <SearchIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    type="search"
                    placeholder="Buscar pasajero por nombre, correo o teléfono"
                    value={passengerQuery}
                    onChange={(e) => setPassengerQuery(e.target.value)}
                  />
                </InputGroup>

                <Select value={passengerStatusFilter} onValueChange={setPassengerStatusFilter}>
                  <SelectTrigger aria-label="Filtrar pasajeros por estado">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="active">Activos</SelectItem>
                      <SelectItem value="pending">Pendientes</SelectItem>
                      <SelectItem value="suspended">Suspendidos</SelectItem>
                      <SelectItem value="revoked">Revocados</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <Select value={passengerTierFilter} onValueChange={setPassengerTierFilter}>
                  <SelectTrigger aria-label="Filtrar por suscripción">
                    <SelectValue placeholder="Plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">Todos los planes</SelectItem>
                      <SelectItem value="free">Gratuito ($ 0)</SelectItem>
                      <SelectItem value="no_ads">Sin publicidad ($ 2 USD/mes)</SelectItem>
                      <SelectItem value="premium">Premium ($ 3 USD/mes)</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {loading ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : filteredPassengers.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <UsersIcon />
                    </EmptyMedia>
                    <EmptyTitle>No hay pasajeros con estos filtros</EmptyTitle>
                    <EmptyDescription>
                      Todavía no hay pasajeros cargados en esta localidad o con el plan seleccionado.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pasajero</TableHead>
                        <TableHead>Localidad</TableHead>
                        <TableHead>Suscripción</TableHead>
                        <TableHead>Vencimiento abono</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Moderación</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPassengers.map((p) => {
                        const name = p.full_name || p.email || "Sin nombre";
                        const tier: SubscriptionTier = p.subscription_tier ?? "free";

                        return (
                          <TableRow key={p.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {p.phone || p.email || "Sin contacto"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {localityById.get(p.locality_id ?? "")?.name ?? "Sin zona"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  tier === "premium"
                                    ? "default"
                                    : tier === "no_ads"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {formatSubscriptionTier(tier)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {p.subscription_expires_at
                                ? formatDateAR(p.subscription_expires_at)
                                : "No aplica"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusBadgeVariant(p.account_status)}>
                                {formatAccountStatus(p.account_status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {p.account_status === "active" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      requestStatusChange(p.id, "suspended", name, "pasajero")
                                    }
                                  >
                                    <PauseCircleIcon data-icon="inline-start" />
                                    Suspender
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      requestStatusChange(p.id, "active", name, "pasajero")
                                    }
                                  >
                                    <RotateCcwIcon data-icon="inline-start" />
                                    Reactivar
                                  </Button>
                                )}

                                {p.account_status !== "revoked" ? (
                                  <Button
                                    size="icon-sm"
                                    variant="destructive"
                                    title="Revocar cuenta"
                                    aria-label={`Revocar cuenta de ${name}`}
                                    onClick={() =>
                                      requestStatusChange(p.id, "revoked", name, "pasajero")
                                    }
                                  >
                                    <BanIcon />
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PESTAÑA METAS E INSIGNIAS */}
        <TabsContent value="badges">
          <BadgeConfigsPanel />
        </TabsContent>
      </Tabs>

      {/* Modal de legajo */}
      <DriverDossierModal
        driver={selectedDriver}
        open={dossierOpen}
        onOpenChange={setDossierOpen}
        onRequestStatusChange={(userId, nextStatus, userName) =>
          requestStatusChange(userId, nextStatus, userName, "chofer")
        }
      />

      {/* Confirmación de suspensión / revocación */}
      <AlertDialog open={Boolean(confirmChange)} onOpenChange={() => setConfirmChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmChange?.nextStatus === "revoked"
                ? `¿Revocar permisos de ${confirmChange.userName}?`
                : `¿Suspender temporalmente a ${confirmChange?.userName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmChange?.nextStatus === "revoked"
                ? `Vas a revocar la habilitación de ${confirmChange.userName}. No va a poder usar TaxiYa como ${confirmChange.roleLabel} hasta que lo reactives desde este panel.`
                : `Vas a suspender la cuenta de ${confirmChange?.userName}. Mientras siga suspendido no podrá pedir ni tomar viajes.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmChange) {
                  applyAccountStatus(
                    confirmChange.userId,
                    confirmChange.nextStatus,
                    confirmChange.userName
                  );
                  setConfirmChange(null);
                }
              }}
            >
              {confirmChange?.nextStatus === "revoked" ? "Sí, revocar" : "Sí, suspender"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
