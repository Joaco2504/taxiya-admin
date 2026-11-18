"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  LifeBuoyIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatDateTimeAR, formatTicketStatus } from "@/lib/format";
import { useLocality } from "@/components/providers/locality-provider";
import { useEmergencies } from "@/components/providers/emergency-provider";
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
import type { Profile, SupportTicket, TicketStatus } from "@/types/taxiya";

function ticketStatusVariant(status: TicketStatus) {
  switch (status) {
    case "open":
      return "warning" as const;
    case "in_review":
    case "in_progress":
      return "secondary" as const;
    case "resolved":
    case "closed":
      return "success" as const;
  }
}

export function SupportTicketsView() {
  const { localities, selectedLocalityId } = useLocality();
  const { refreshEmergencies } = useEmergencies();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [usersById, setUsersById] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const localityNameById = useMemo(
    () => new Map(localities.map((l) => [l.id, l.name])),
    [localities]
  );

  const fetchTickets = useCallback(async (withSpinner: boolean) => {
    if (withSpinner) setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        toast.error("No pudimos cargar los reclamos de soporte. Probá actualizar.");
        return;
      }

      const list = (data ?? []) as SupportTicket[];
      setTickets(list);

      const userIds = Array.from(new Set(list.map((t) => t.user_id).filter(Boolean)));
      if (userIds.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("*")
          .in("id", userIds);
        if (profRows) {
          setUsersById(new Map((profRows as Profile[]).map((p) => [p.id, p])));
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchTickets(true);
    });

    const supabase = createClient();
    const channel = supabase
      .channel("taxiya-support-tickets-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "taxiya", table: "support_tickets" },
        () => {
          void fetchTickets(false);
          void refreshEmergencies();
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [fetchTickets, refreshEmergencies]);

  async function handleStatusChange(ticketId: string, nextStatus: TicketStatus) {
    setUpdatingId(ticketId);
    const supabase = createClient();
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: nextStatus })
      .eq("id", ticketId);

    setUpdatingId(null);

    if (error) {
      toast.error("No pudimos actualizar el estado del reclamo. Probá de nuevo.");
      return;
    }

    setTickets((prev) =>
      prev.map((item) =>
        item.id === ticketId ? { ...item, status: nextStatus } : item
      )
    );
    await refreshEmergencies();
    toast.success(`Ticket pasado a ${formatTicketStatus(nextStatus)}.`);
  }

  const localityTickets = useMemo(() => {
    if (selectedLocalityId === "all") return tickets;
    return tickets.filter((t) => t.locality_id === selectedLocalityId);
  }, [tickets, selectedLocalityId]);

  const filteredTickets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return localityTickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (typeFilter === "emergency" && !t.is_emergency) return false;
      if (typeFilter === "support" && t.is_emergency) return false;

      if (q) {
        const user = usersById.get(t.user_id);
        const haystack = [
          t.category ?? "",
          t.description ?? "",
          user?.full_name ?? "",
          user?.phone ?? "",
          t.user_id,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [localityTickets, statusFilter, typeFilter, query, usersById]);

  const counts = useMemo(() => {
    return {
      open: localityTickets.filter((t) => t.status === "open").length,
      inReview: localityTickets.filter(
        (t) => t.status === "in_review" || t.status === "in_progress"
      ).length,
      emergencies: localityTickets.filter(
        (t) =>
          t.is_emergency &&
          (t.status === "open" || t.status === "in_review" || t.status === "in_progress")
      ).length,
      resolved: localityTickets.filter(
        (t) => t.status === "resolved" || t.status === "closed"
      ).length,
    };
  }, [localityTickets]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Soporte y reclamos</h1>
          <p className="text-sm text-muted-foreground">
            Seguimiento de consultas, reclamos y alertas de emergencia de choferes y pasajeros
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchTickets(true)}>
          <RefreshCwIcon data-icon="inline-start" />
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tickets abiertos</CardDescription>
            <CardTitle className="text-2xl">{counts.open}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>En revisión / proceso</CardDescription>
            <CardTitle className="text-2xl">{counts.inReview}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Emergencias activas</CardDescription>
            <CardTitle className="text-2xl text-destructive">
              {counts.emergencies}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Resueltos</CardDescription>
            <CardTitle className="text-2xl">{counts.resolved}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Bandeja de tickets</CardTitle>
              <CardDescription>
                Cambiá el estado a medida que revisás cada caso para que el usuario lo vea en su app
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <InputGroup className="w-60">
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                <InputGroupInput
                  placeholder="Buscar nombre, motivo o ID..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </InputGroup>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" aria-label="Filtrar por estado">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="open">Abiertos</SelectItem>
                    <SelectItem value="in_review">En revisión</SelectItem>
                    <SelectItem value="in_progress">En proceso</SelectItem>
                    <SelectItem value="resolved">Resueltos</SelectItem>
                    <SelectItem value="closed">Cerrados</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-44" aria-label="Filtrar por tipo">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    <SelectItem value="emergency">Solo emergencias</SelectItem>
                    <SelectItem value="support">Consultas y reclamos</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LifeBuoyIcon />
                </EmptyMedia>
                <EmptyTitle>No hay tickets con ese filtro</EmptyTitle>
                <EmptyDescription>
                  Cuando un pasajero o chofer envíe una consulta o active el botón de pánico, aparece en esta lista.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="support-table-caption"
              className="taxiya-responsive-table-wrap rounded-lg border border-border"
            >
              <table
                className="w-full text-sm"
                style={
                  {
                    "--label-2": '"Motivo y detalle"',
                    "--label-3": '"Localidad"',
                    "--label-4": '"Fecha"',
                    "--label-5": '"Estado"',
                    "--label-6": '"Gestión"',
                  } as React.CSSProperties
                }
              >
                <caption id="support-table-caption" className="sr-only">
                  Listado de reclamos, consultas y emergencias enviadas desde TaxiYa
                </caption>
                <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Usuario</th>
                    <th className="px-4 py-3 text-left font-medium">Motivo y detalle</th>
                    <th className="px-4 py-3 text-left font-medium">Localidad</th>
                    <th className="px-4 py-3 text-left font-medium">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium">Estado</th>
                    <th className="px-4 py-3 text-right font-medium">Gestión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTickets.map((ticket) => {
                    const user = usersById.get(ticket.user_id);
                    const roleText =
                      user?.role === "driver"
                        ? "Chofer"
                        : user?.role === "passenger"
                          ? "Pasajero"
                          : "Usuario";

                    return (
                      <tr key={ticket.id} className="hover:bg-muted/40">
                        <th className="px-4 py-3 align-top font-medium">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-foreground">
                              {user?.full_name || "Usuario TaxiYa"}
                            </span>
                            <span className="text-xs font-normal text-muted-foreground">
                              {roleText}
                              {user?.phone ? ` · ${user.phone}` : ""}
                            </span>
                          </div>
                        </th>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col gap-1 max-w-md">
                            <div className="flex items-center gap-1.5">
                              {ticket.is_emergency ? (
                                <Badge variant="destructive" className="gap-1">
                                  <AlertTriangleIcon className="size-3" />
                                  Emergencia
                                </Badge>
                              ) : (
                                <Badge variant="outline">
                                  {ticket.category || "Consulta general"}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                              {ticket.description || "Sin detalle adjunto."}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-xs">
                          {localityNameById.get(ticket.locality_id ?? "") ?? "Sin zona"}
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTimeAR(ticket.created_at)}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <Badge variant={ticketStatusVariant(ticket.status)}>
                            {formatTicketStatus(ticket.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 align-top text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Select
                              value={ticket.status}
                              disabled={updatingId === ticket.id}
                              onValueChange={(value) =>
                                handleStatusChange(ticket.id, value as TicketStatus)
                              }
                            >
                              <SelectTrigger
                                className="h-8 w-36 text-xs"
                                aria-label={`Cambiar estado de ticket ${ticket.id}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectGroup>
                                  <SelectItem value="open">Abierto</SelectItem>
                                  <SelectItem value="in_review">En revisión</SelectItem>
                                  <SelectItem value="in_progress">En proceso</SelectItem>
                                  <SelectItem value="resolved">Resuelto</SelectItem>
                                  <SelectItem value="closed">Cerrado</SelectItem>
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                            {ticket.status !== "resolved" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={updatingId === ticket.id}
                                onClick={() =>
                                  handleStatusChange(ticket.id, "resolved")
                                }
                              >
                                <CheckCircle2Icon data-icon="inline-start" />
                                Resolver
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
