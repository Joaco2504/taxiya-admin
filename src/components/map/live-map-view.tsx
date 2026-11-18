"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangleIcon,
  Building2Icon,
  CarTaxiFrontIcon,
  CheckCircle2Icon,
  NavigationIcon,
  RefreshCwIcon,
  UserCheckIcon,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatDateTimeAR, formatTicketStatus, formatTripStatus } from "@/lib/format";
import { useLocality } from "@/components/providers/locality-provider";
import { useEmergencies } from "@/components/providers/emergency-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  DriverDetails,
  DriverWithProfile,
  Profile,
  SupportTicket,
  Trip,
} from "@/types/taxiya";

const LiveMapboxCanvas = dynamic(
  () => import("@/components/map/live-mapbox-canvas").then((m) => m.LiveMapboxCanvas),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[520px] w-full rounded-lg" />,
  }
);

export function LiveMapView() {
  const { localities, companies, selectedLocalityId, selectedLocality } = useLocality();
  const { activeEmergencies, resolveTicket, refreshEmergencies } = useEmergencies();

  const [drivers, setDrivers] = useState<DriverWithProfile[]>([]);
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);
  const [recentTickets, setRecentTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLiveState = useCallback(async () => {
    const supabase = createClient();
    const [drvRes, profRes, tripRes, tickRes] = await Promise.all([
      supabase.from("driver_details").select("*").eq("is_online", true),
      supabase.from("profiles").select("*").eq("role", "driver"),
      supabase
        .from("trips")
        .select("*")
        .in("status", [
          "searching",
          "requested",
          "accepted",
          "arriving",
          "in_door",
          "in_progress",
          "waiting",
          "waiting_return",
        ])
        .order("created_at", { ascending: false }),
      supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    if (drvRes.error) {
      toast.error("No pudimos cargar los móviles en línea. Probá actualizar.");
    }

    const profilesById = new Map<string, Profile>(
      ((profRes.data ?? []) as Profile[]).map((p) => [p.id, p])
    );
    const companiesById = new Map(companies.map((c) => [c.id, c]));
    const localitiesById = new Map(localities.map((l) => [l.id, l]));

    const combinedDrivers: DriverWithProfile[] = ((drvRes.data ?? []) as DriverDetails[]).map(
      (d) => {
        const profile = profilesById.get(d.user_id) ?? null;
        return {
          ...d,
          profile,
          company: d.company_id ? companiesById.get(d.company_id) ?? null : null,
          locality: profile?.locality_id
            ? localitiesById.get(profile.locality_id) ?? null
            : null,
        };
      }
    );

    setDrivers(combinedDrivers);
    setActiveTrips((tripRes.data ?? []) as Trip[]);
    setRecentTickets((tickRes.data ?? []) as SupportTicket[]);
    setLoading(false);
  }, [companies, localities]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return loadLiveState();
    });

    const supabase = createClient();
    const channel = supabase
      .channel("taxiya-live-dispatch")
      .on(
        "postgres_changes",
        { event: "*", schema: "taxiya", table: "driver_details" },
        () => {
          void loadLiveState();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "taxiya", table: "trips" },
        () => {
          void loadLiveState();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "taxiya", table: "support_tickets" },
        () => {
          void loadLiveState();
          void refreshEmergencies();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [loadLiveState, refreshEmergencies]);

  const filteredDrivers = useMemo(() => {
    if (selectedLocalityId === "all") return drivers;
    return drivers.filter(
      (d) =>
        d.profile?.locality_id === selectedLocalityId ||
        d.company?.locality_id === selectedLocalityId
    );
  }, [drivers, selectedLocalityId]);

  const filteredTrips = useMemo(() => {
    if (selectedLocalityId === "all") return activeTrips;
    return activeTrips.filter((t) => t.locality_id === selectedLocalityId);
  }, [activeTrips, selectedLocalityId]);

  const filteredEmergencies = useMemo(() => {
    if (selectedLocalityId === "all") return activeEmergencies;
    return activeEmergencies.filter((t) => t.locality_id === selectedLocalityId);
  }, [activeEmergencies, selectedLocalityId]);

  const filteredTickets = useMemo(() => {
    if (selectedLocalityId === "all") return recentTickets;
    return recentTickets.filter((t) => t.locality_id === selectedLocalityId);
  }, [recentTickets, selectedLocalityId]);

  const companyDriversCount = filteredDrivers.filter((d) => Boolean(d.company_id)).length;
  const independentDriversCount = filteredDrivers.length - companyDriversCount;

  const localityNameById = useMemo(
    () => new Map(localities.map((l) => [l.id, l.name])),
    [localities]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Mapa en vivo y emergencias</h1>
          <p className="text-sm text-muted-foreground">
            Seguimiento en tiempo real de móviles habilitados, viajes en curso y tickets de auxilio en{" "}
            {selectedLocality ? selectedLocality.name : "todas las localidades"}.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadLiveState}>
          <RefreshCwIcon data-icon="inline-start" />
          Actualizar ahora
        </Button>
      </div>

      {/* KPIs en vivo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taxis en línea</CardDescription>
            <CardTitle className="flex items-center justify-between text-2xl">
              <span>{filteredDrivers.length}</span>
              <CarTaxiFrontIcon className="size-5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {companyDriversCount} de empresa · {independentDriversCount} independientes
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Viajes en curso</CardDescription>
            <CardTitle className="flex items-center justify-between text-2xl">
              <span>{filteredTrips.length}</span>
              <NavigationIcon className="size-5 text-secondary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Pedidos activos, en camino o esperando
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Emergencias abiertas</CardDescription>
            <CardTitle className="flex items-center justify-between text-2xl">
              <span className={filteredEmergencies.length > 0 ? "text-destructive" : ""}>
                {filteredEmergencies.length}
              </span>
              <AlertTriangleIcon className="size-5 text-destructive" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Prioridad máxima con aviso sonoro y visual
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Empresas operativas</CardDescription>
            <CardTitle className="flex items-center justify-between text-2xl">
              <span>
                {
                  companies.filter(
                    (c) =>
                      c.is_active &&
                      (selectedLocalityId === "all" || c.locality_id === selectedLocalityId)
                  ).length
                }
              </span>
              <Building2Icon className="size-5 text-secondary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Flotas privadas activas en la zona
          </CardContent>
        </Card>
      </div>

      {/* Mapa + panel lateral de viajes y tickets */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Mapa operativo</CardTitle>
                <CardDescription>
                  Empresas privadas por color de insignia · Independientes en ámbar · Sin señal GPS reciente en gris
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="default">Independiente</Badge>
                <Badge variant="secondary">Empresa privada</Badge>
                <Badge variant="destructive">Emergencia</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[520px] w-full rounded-lg" />
            ) : (
              <LiveMapboxCanvas
                drivers={filteredDrivers}
                trips={filteredTrips}
                emergencies={filteredEmergencies}
                selectedLocality={selectedLocality}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {/* Panel de tickets y emergencias */}
          <Card>
            <CardHeader>
              <CardTitle>Emergencias y soporte</CardTitle>
              <CardDescription>Últimos tickets recibidos por orden de llegada</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {filteredTickets.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <CheckCircle2Icon />
                    </EmptyMedia>
                    <EmptyTitle>Sin novedades de soporte</EmptyTitle>
                    <EmptyDescription>
                      No entraron alertas de emergencia ni reclamos en esta localidad.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
                  {filteredTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={ticket.is_emergency ? "destructive" : "outline"}>
                            {ticket.is_emergency ? "Emergencia" : ticket.category || "Soporte"}
                          </Badge>
                          <Badge variant="outline">
                            {localityNameById.get(ticket.locality_id ?? "") ?? "Sin zona"}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTimeAR(ticket.created_at)}
                        </span>
                      </div>
                      <p className="text-sm">
                        {ticket.description || "Ticket abierto sin descripción."}
                      </p>
                      {ticket.status === "open" ||
                      ticket.status === "in_review" ||
                      ticket.status === "in_progress" ? (
                        <Button
                          size="sm"
                          variant={ticket.is_emergency ? "destructive" : "outline"}
                          onClick={() => resolveTicket(ticket.id)}
                        >
                          <CheckCircle2Icon data-icon="inline-start" />
                          Marcar resuelto
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Estado: {formatTicketStatus(ticket.status)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Viajes activos */}
          <Card>
            <CardHeader>
              <CardTitle>Viajes activos ahora</CardTitle>
              <CardDescription>Traslados en seguimiento sin tarifa calculada</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredTrips.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <UserCheckIcon />
                    </EmptyMedia>
                    <EmptyTitle>No hay viajes activos</EmptyTitle>
                    <EmptyDescription>
                      Cuando un pasajero pida un taxi en esta zona, aparece acá al instante.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
                  {filteredTrips.map((trip) => (
                    <div
                      key={trip.id}
                      className="flex flex-col gap-1 rounded-lg border border-border bg-background p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary">{formatTripStatus(trip.status)}</Badge>
                        <span className="text-muted-foreground">
                          {formatDateTimeAR(trip.created_at)}
                        </span>
                      </div>
                      <span className="font-medium truncate">
                        Desde: {trip.origin_address || "Punto en el mapa"}
                      </span>
                      <span className="text-muted-foreground truncate">
                        Hasta: {trip.dest_address || "Destino abierto"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
