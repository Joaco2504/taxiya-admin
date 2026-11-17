"use client";

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3Icon,
  CalendarIcon,
  CarTaxiFrontIcon,
  ClockIcon,
  MapPinIcon,
  RefreshCwIcon,
  StarIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  formatDateAR,
  formatDateTimeAR,
  formatSubscriptionTier,
  todayISODate,
  addDaysToISODate,
} from "@/lib/format";
import { useLocality } from "@/components/providers/locality-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Profile, Rating, Trip } from "@/types/taxiya";

const AR_TIMEZONE = "America/Argentina/Catamarca";

function getHourInCatamarca(iso: string): number {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 0;
  const hourStr = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    timeZone: AR_TIMEZONE,
  }).format(date);
  return Number(hourStr) % 24;
}

export function AnalyticsDashboardView() {
  const { selectedLocalityId, selectedLocality } = useLocality();
  const [rangePreset, setRangePreset] = useState<string>("30");
  const [fromDate, setFromDate] = useState<string>(() => addDaysToISODate(todayISODate(), -30));
  const [toDate, setToDate] = useState<string>(() => todayISODate());

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [lowRatings, setLowRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  function handlePresetChange(preset: string) {
    setRangePreset(preset);
    if (preset !== "custom") {
      const days = Number(preset);
      const end = todayISODate();
      setToDate(end);
      setFromDate(addDaysToISODate(end, -days));
    }
  }

  const fetchAnalyticsData = useCallback(async (withSpinner: boolean) => {
    if (withSpinner) setLoading(true);
    try {
      const supabase = createClient();
      const fromIso = `${fromDate}T00:00:00.000Z`;
      const toIso = `${toDate}T23:59:59.999Z`;

      const [profRes, tripsRes, ratingsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, role, account_status, locality_id, subscription_tier, created_at")
          .in("role", ["driver", "passenger"]),
        supabase
          .from("trips")
          .select("*")
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at", { ascending: false }),
        supabase
          .from("ratings")
          .select("*")
          .lt("stars", 3)
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at", { ascending: false }),
      ]);

      if (profRes.error || tripsRes.error || ratingsRes.error) {
        toast.error("No pudimos cargar todas las estadísticas. Probá actualizar.");
      }

      setProfiles((profRes.data ?? []) as Profile[]);
      setTrips((tripsRes.data ?? []) as Trip[]);
      setLowRatings((ratingsRes.data ?? []) as Rating[]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  const loadAnalytics = useCallback(() => fetchAnalyticsData(true), [fetchAnalyticsData]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchAnalyticsData(false);
    });
    return () => {
      active = false;
    };
  }, [fetchAnalyticsData]);

  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles]
  );

  const filteredProfiles = useMemo(() => {
    if (selectedLocalityId === "all") return profiles;
    return profiles.filter((p) => p.locality_id === selectedLocalityId);
  }, [profiles, selectedLocalityId]);

  const filteredTrips = useMemo(() => {
    if (selectedLocalityId === "all") return trips;
    return trips.filter((t) => t.locality_id === selectedLocalityId);
  }, [trips, selectedLocalityId]);

  const filteredLowRatings = useMemo(() => {
    if (selectedLocalityId === "all") return lowRatings;
    const tripLocalityMap = new Map(trips.map((t) => [t.id, t.locality_id]));
    return lowRatings.filter((r) => {
      const tripLoc = tripLocalityMap.get(r.trip_id);
      if (tripLoc) return tripLoc === selectedLocalityId;
      const drvLoc = profileMap.get(r.driver_id)?.locality_id;
      return drvLoc === selectedLocalityId;
    });
  }, [lowRatings, trips, profileMap, selectedLocalityId]);

  // 1. Usuarios activos y planes
  const activeDriversCount = filteredProfiles.filter(
    (p) => p.role === "driver" && p.account_status === "active"
  ).length;
  const activePassengersCount = filteredProfiles.filter(
    (p) => p.role === "passenger" && p.account_status === "active"
  ).length;

  const userMixData = useMemo(() => {
    const freeCount = filteredProfiles.filter(
      (p) => p.role === "passenger" && p.account_status === "active" && p.subscription_tier === "free"
    ).length;
    const noAdsCount = filteredProfiles.filter(
      (p) => p.role === "passenger" && p.account_status === "active" && p.subscription_tier === "no_ads"
    ).length;
    const premiumCount = filteredProfiles.filter(
      (p) => p.role === "passenger" && p.account_status === "active" && p.subscription_tier === "premium"
    ).length;

    return [
      { name: "Taxistas activos", total: activeDriversCount, color: "var(--chart-1)" },
      { name: "Pasajeros Gratis", total: freeCount, color: "var(--chart-2)" },
      { name: "Sin publicidad", total: noAdsCount, color: "var(--chart-3)" },
      { name: "Premium", total: premiumCount, color: "var(--chart-4)" },
    ].filter((item) => item.total > 0);
  }, [filteredProfiles, activeDriversCount]);

  // 2. Horarios pico de demanda
  const hourlyDemandData = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      hourLabel: `${String(hour).padStart(2, "0")} hs`,
      viajes: 0,
      isNightShift: hour >= 0 && hour < 6,
    }));

    filteredTrips.forEach((trip) => {
      const hour = getHourInCatamarca(trip.created_at);
      if (buckets[hour]) buckets[hour].viajes += 1;
    });

    return buckets;
  }, [filteredTrips]);

  // 3. Puntos de referencia más solicitados
  const topDestinationsData = useMemo(() => {
    const counts = new Map<string, number>();
    filteredTrips.forEach((t) => {
      const label = (t.dest_address || t.origin_address || "").trim();
      if (!label) return;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([destino, pedidos]) => ({
        destino: destino.length > 26 ? `${destino.slice(0, 26)}…` : destino,
        pedidos,
      }))
      .sort((a, b) => b.pedidos - a.pedidos)
      .slice(0, 8);
  }, [filteredTrips]);

  // 4. Motivos de cancelación
  const cancellationData = useMemo(() => {
    const counts = new Map<string, number>();
    filteredTrips
      .filter((t) => t.status === "cancelled")
      .forEach((t) => {
        const reason = (t.cancel_reason || "Sin motivo especificado").trim();
        counts.set(reason, (counts.get(reason) ?? 0) + 1);
      });

    return Array.from(counts.entries())
      .map(([motivo, cantidad]) => ({
        motivo: motivo.length > 24 ? `${motivo.slice(0, 24)}…` : motivo,
        cantidad,
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 6);
  }, [filteredTrips]);

  const completedTripsCount = filteredTrips.filter((t) => t.status === "completed").length;
  const cancelledTripsCount = filteredTrips.filter((t) => t.status === "cancelled").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado y filtro por fecha */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Estadísticas</h1>
          <p className="text-sm text-muted-foreground">
            Demanda horaria, puntos más pedidos, cancelaciones y calidad de servicio en{" "}
            {selectedLocality ? selectedLocality.name : "todas las localidades"}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={rangePreset} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-44" aria-label="Rango de fechas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="7">Últimos 7 días</SelectItem>
                <SelectItem value="30">Últimos 30 días</SelectItem>
                <SelectItem value="90">Últimos 90 días</SelectItem>
                <SelectItem value="custom">Rango manual</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5">
            <CalendarIcon className="size-4 text-muted-foreground" />
            <Input
              type="date"
              aria-label="Fecha desde"
              value={fromDate}
              onChange={(e) => {
                setRangePreset("custom");
                setFromDate(e.target.value);
              }}
              className="w-36"
            />
            <span className="text-xs text-muted-foreground">al</span>
            <Input
              type="date"
              aria-label="Fecha hasta"
              value={toDate}
              onChange={(e) => {
                setRangePreset("custom");
                setToDate(e.target.value);
              }}
              className="w-36"
            />
          </div>

          <Button variant="outline" size="sm" onClick={loadAnalytics}>
            <RefreshCwIcon data-icon="inline-start" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* KPIs resumen */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Usuarios activos</CardDescription>
            <CardTitle className="flex items-center justify-between text-2xl">
              <span>{activePassengersCount + activeDriversCount}</span>
              <UsersIcon className="size-5 text-secondary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {activePassengersCount} pasajeros · {activeDriversCount} taxistas habilitados
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Viajes en el período</CardDescription>
            <CardTitle className="flex items-center justify-between text-2xl">
              <span>{filteredTrips.length}</span>
              <CarTaxiFrontIcon className="size-5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {completedTripsCount} completados · {cancelledTripsCount} cancelados
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Puntos con más pedidos</CardDescription>
            <CardTitle className="flex items-center justify-between text-2xl">
              <span>{topDestinationsData[0]?.pedidos ?? 0}</span>
              <MapPinIcon className="size-5 text-success" />
            </CardTitle>
          </CardHeader>
          <CardContent className="truncate text-xs text-muted-foreground">
            {topDestinationsData[0]?.destino ?? "Sin destinos registrados todavía"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Calificaciones bajo 3 estrellas</CardDescription>
            <CardTitle className="flex items-center justify-between text-2xl">
              <span className={filteredLowRatings.length > 0 ? "text-warning" : ""}>
                {filteredLowRatings.length}
              </span>
              <StarIcon className="size-5 text-warning" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Casos para revisar entre {formatDateAR(fromDate)} y {formatDateAR(toDate)}
          </CardContent>
        </Card>
      </div>

      {/* Gráficos principales */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Horarios pico */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClockIcon className="size-4 text-primary" />
              Horarios pico de demanda
            </CardTitle>
            <CardDescription>
              Viajes solicitados por hora (reloj 24 hs). Las barras destacadas corresponden al Turno Nocturno (00 a 06 hs).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !mounted ? (
              <Skeleton className="h-72 w-full" />
            ) : filteredTrips.length === 0 ? (
              <Empty className="h-72">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BarChart3Icon />
                  </EmptyMedia>
                  <EmptyTitle>Todavía no hay viajes en estas fechas</EmptyTitle>
                  <EmptyDescription>
                    Ampliá el rango de fechas o cambiá de localidad para ver los picos por hora.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={hourlyDemandData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="hourLabel"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      interval={2}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        color: "var(--foreground)",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="viajes" name="Viajes" radius={[4, 4, 0, 0]}>
                      {hourlyDemandData.map((entry) => (
                        <Cell
                          key={entry.hourLabel}
                          fill={entry.isNightShift ? "var(--chart-2)" : "var(--chart-1)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Composición de usuarios activos */}
        <Card>
          <CardHeader>
            <CardTitle>Composición de usuarios activos</CardTitle>
            <CardDescription>Taxistas habilitados y pasajeros por plan</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !mounted ? (
              <Skeleton className="h-72 w-full" />
            ) : userMixData.length === 0 ? (
              <Empty className="h-72">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <UsersIcon />
                  </EmptyMedia>
                  <EmptyTitle>Sin usuarios activos en esta zona</EmptyTitle>
                  <EmptyDescription>
                    Cuando apruebes taxistas o ingresen pasajeros, aparece el reparto acá.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <PieChart>
                      <Pie
                        data={userMixData}
                        dataKey="total"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={78}
                        paddingAngle={3}
                      >
                        {userMixData.map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--card)",
                          borderColor: "var(--border)",
                          color: "var(--foreground)",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-1.5 text-xs">
                  {userMixData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.name}
                      </span>
                      <span className="font-semibold">{item.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Segunda fila de gráficos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Puntos de referencia más solicitados */}
        <Card>
          <CardHeader>
            <CardTitle>Puntos de referencia más solicitados</CardTitle>
            <CardDescription>Destinos y paradas con mayor volumen de pedidos</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !mounted ? (
              <Skeleton className="h-64 w-full" />
            ) : topDestinationsData.length === 0 ? (
              <Empty className="h-64">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MapPinIcon />
                  </EmptyMedia>
                  <EmptyTitle>Sin pedidos con destino registrado</EmptyTitle>
                  <EmptyDescription>
                    Todavía no hay viajes suficientes en el período elegido.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={topDestinationsData} layout="vertical" margin={{ left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="destino"
                      width={130}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        color: "var(--foreground)",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="pedidos" name="Pedidos" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Motivos de cancelación */}
        <Card>
          <CardHeader>
            <CardTitle>Motivos de cancelación</CardTitle>
            <CardDescription>
              Causas declaradas y liberaciones automáticas de pedidos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !mounted ? (
              <Skeleton className="h-64 w-full" />
            ) : cancellationData.length === 0 ? (
              <Empty className="h-64">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BarChart3Icon />
                  </EmptyMedia>
                  <EmptyTitle>Sin cancelaciones en este período</EmptyTitle>
                  <EmptyDescription>
                    No se registraron viajes cancelados en las fechas filtradas.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={cancellationData} layout="vertical" margin={{ left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="motivo"
                      width={140}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        color: "var(--foreground)",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="cantidad" name="Cancelaciones" fill="var(--chart-5)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabla de calificaciones menores a 3 estrellas */}
      <Card>
        <CardHeader>
          <CardTitle>Calificaciones menores a 3 estrellas</CardTitle>
          <CardDescription>
            Reseñas de 1 y 2 estrellas para seguimiento de calidad de choferes y móviles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : filteredLowRatings.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <StarIcon />
                </EmptyMedia>
                <EmptyTitle>No hay calificaciones menores a 3 estrellas</EmptyTitle>
                <EmptyDescription>
                  No entraron puntajes bajos en el rango de fechas elegido.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Chofer evaluado</TableHead>
                    <TableHead>Pasajero</TableHead>
                    <TableHead>Puntaje</TableHead>
                    <TableHead>Comentario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLowRatings.map((rating) => {
                    const driverProf = profileMap.get(rating.driver_id);
                    const passProf = profileMap.get(rating.passenger_id);

                    return (
                      <TableRow key={rating.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTimeAR(rating.created_at)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {driverProf?.full_name || rating.driver_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {passProf ? (
                            <span>
                              {passProf.full_name || "Pasajero"} (
                              {formatSubscriptionTier(passProf.subscription_tier)})
                            </span>
                          ) : (
                            rating.passenger_id.slice(0, 8)
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={rating.stars <= 1 ? "destructive" : "warning"}>
                            {rating.stars} {rating.stars === 1 ? "estrella" : "estrellas"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md text-sm">
                          {rating.comment || "Sin comentario escrito."}
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
    </div>
  );
}
