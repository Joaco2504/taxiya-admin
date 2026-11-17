"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  CheckCircle2Icon,
  MapPinIcon,
  PencilIcon,
  RefreshCwIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  formatDateTimeAR,
  formatLandmarkStatus,
  LANDMARK_CATEGORIES,
} from "@/lib/format";
import {
  getLocalityViewport,
  parsePostGISPoint,
  toPostGISPoint,
} from "@/lib/postgis";
import { useLocality } from "@/components/providers/locality-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Landmark, LandmarkStatus, Profile } from "@/types/taxiya";

const LandmarkPinMap = dynamic(
  () => import("@/components/landmarks/landmark-pin-map").then((m) => m.LandmarkPinMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-72 w-full rounded-lg" />,
  }
);

export function LandmarksModerationView() {
  const { localities, selectedLocalityId, selectedLocality } = useLocality();
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [authorsById, setAuthorsById] = useState<Map<string, Profile>>(new Map());
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  // Modal de revisión / edición de pin
  const [editing, setEditing] = useState<Landmark | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<string>("Comercio");
  const [editLat, setEditLat] = useState<number>(-27.6514);
  const [editLng, setEditLng] = useState<number>(-67.0286);
  const [saving, setSaving] = useState(false);

  const localityById = useMemo(
    () => new Map(localities.map((l) => [l.id, l])),
    [localities]
  );

  const fetchLandmarksData = useCallback(async (withSpinner: boolean) => {
    if (withSpinner) setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("landmarks")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("No pudimos cargar los puntos sugeridos. Probá actualizar.");
        return;
      }

      const rows = (data ?? []) as Landmark[];
      setLandmarks(rows);

      const creatorIds = Array.from(
        new Set(rows.map((r) => r.created_by).filter((id): id is string => Boolean(id)))
      );
      if (creatorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .in("id", creatorIds);
        if (profs) {
          setAuthorsById(new Map((profs as Profile[]).map((p) => [p.id, p])));
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLandmarks = useCallback(() => fetchLandmarksData(true), [fetchLandmarksData]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchLandmarksData(false);
    });
    return () => {
      active = false;
    };
  }, [fetchLandmarksData]);

  function openEditor(landmark: Landmark) {
    setEditing(landmark);
    setEditName(landmark.name);
    setEditCategory(landmark.category || "Comercio");

    const parsed = parsePostGISPoint(landmark.location);
    if (parsed) {
      setEditLat(parsed.lat);
      setEditLng(parsed.lng);
    } else {
      const loc = localityById.get(landmark.locality_id);
      const fallback = getLocalityViewport(loc?.name);
      setEditLat(fallback.latitude);
      setEditLng(fallback.longitude);
    }
  }

  async function handleModerate(
    landmark: Landmark,
    nextStatus: LandmarkStatus,
    useFormEdits: boolean
  ) {
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = useFormEdits
        ? {
            name: editName.trim() || landmark.name,
            category: editCategory,
            location: toPostGISPoint(editLat, editLng),
            status: nextStatus,
          }
        : { status: nextStatus };

      const { error } = await supabase
        .from("landmarks")
        .update(payload)
        .eq("id", landmark.id);

      if (error) {
        toast.error(`No pudimos actualizar el punto: ${error.message}`);
        return;
      }

      toast.success(
        nextStatus === "approved"
          ? `Punto "${payload.name ?? landmark.name}" aprobado para todo el pueblo.`
          : `Punto "${landmark.name}" rechazado.`
      );
      setEditing(null);
      await loadLandmarks();
    } finally {
      setSaving(false);
    }
  }

  const filteredLandmarks = useMemo(() => {
    return landmarks.filter((l) => {
      if (selectedLocalityId !== "all" && l.locality_id !== selectedLocalityId) {
        return false;
      }
      if (statusFilter !== "all" && l.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [landmarks, selectedLocalityId, statusFilter]);

  const pendingCount = useMemo(
    () =>
      landmarks.filter(
        (l) =>
          l.status === "pending" &&
          (selectedLocalityId === "all" || l.locality_id === selectedLocalityId)
      ).length,
    [landmarks, selectedLocalityId]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Puntos de referencia</h1>
          <p className="text-sm text-muted-foreground">
            Moderación de puntos públicos colaborativos sugeridos por pasajeros y taxistas en{" "}
            {selectedLocality ? selectedLocality.name : "todas las localidades"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 ? (
            <Badge variant="warning">{pendingCount} pendientes</Badge>
          ) : null}
          <Button variant="outline" size="sm" onClick={loadLandmarks}>
            <RefreshCwIcon data-icon="inline-start" />
            Actualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Puntos públicos sugeridos</CardTitle>
            <CardDescription>
              Corregí nombre, categoría o ubicación exacta en el mapa antes de aprobar.
            </CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48" aria-label="Filtrar puntos por estado">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="approved">Aprobados</SelectItem>
                <SelectItem value="rejected">Rechazados</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredLandmarks.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MapPinIcon />
                </EmptyMedia>
                <EmptyTitle>
                  {statusFilter === "pending"
                    ? "No hay puntos pendientes en esta zona"
                    : "No encontramos puntos con ese estado"}
                </EmptyTitle>
                <EmptyDescription>
                  Cuando un pasajero o taxista sugiera un punto público nuevo en el pueblo, aparece acá para revisarlo.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre del lugar</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Localidad</TableHead>
                    <TableHead>Sugerido por</TableHead>
                    <TableHead>Coordenadas</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLandmarks.map((item) => {
                    const coords = parsePostGISPoint(item.location);
                    const author = item.created_by ? authorsById.get(item.created_by) : null;

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.category || "Sin categoría"}</Badge>
                        </TableCell>
                        <TableCell>
                          {localityById.get(item.locality_id)?.name ?? "Sin zona"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {author
                            ? `${author.full_name || "Usuario"} (${author.role === "driver" ? "Chofer" : "Pasajero"})`
                            : "Usuario"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {coords
                            ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                            : "Sin pin"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTimeAR(item.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.status === "approved"
                                ? "success"
                                : item.status === "pending"
                                  ? "warning"
                                  : "destructive"
                            }
                          >
                            {formatLandmarkStatus(item.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditor(item)}
                            >
                              <PencilIcon data-icon="inline-start" />
                              Revisar pin
                            </Button>
                            {item.status === "pending" ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleModerate(item, "approved", false)}
                                >
                                  <CheckCircle2Icon data-icon="inline-start" />
                                  Aprobar
                                </Button>
                                <Button
                                  size="icon-sm"
                                  variant="destructive"
                                  aria-label={`Rechazar ${item.name}`}
                                  onClick={() => handleModerate(item, "rejected", false)}
                                >
                                  <XCircleIcon />
                                </Button>
                              </>
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

      {/* Modal de edición + ajuste de pin */}
      <Dialog open={Boolean(editing)} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Revisar punto de referencia</DialogTitle>
            <DialogDescription>
              Editá el nombre o categoría y arrastrá el marcador en el mapa para fijar la esquina exacta.
            </DialogDescription>
          </DialogHeader>

          {editing ? (
            <div className="flex flex-col gap-4">
              <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="landmark-name">Nombre público</FieldLabel>
                  <Input
                    id="landmark-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Ej: Hospital Zonal Belén"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="landmark-category">Categoría</FieldLabel>
                  <Select value={editCategory} onValueChange={setEditCategory}>
                    <SelectTrigger id="landmark-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {LANDMARK_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>

              <Field>
                <FieldLabel>Ubicación en el mapa</FieldLabel>
                <LandmarkPinMap
                  lat={editLat}
                  lng={editLng}
                  onChange={(lat, lng) => {
                    setEditLat(lat);
                    setEditLng(lng);
                  }}
                />
                <FieldDescription className="font-mono text-xs">
                  Latitud: {editLat.toFixed(6)} · Longitud: {editLng.toFixed(6)} (tocá el mapa o arrastrá el pin)
                </FieldDescription>
              </Field>
            </div>
          ) : null}

          <DialogFooter className="flex flex-wrap justify-between gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={saving || !editing}
              onClick={() => editing && handleModerate(editing, "rejected", true)}
            >
              <XCircleIcon data-icon="inline-start" />
              Rechazar punto
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={saving || !editing || !editName.trim()}
                onClick={() => editing && handleModerate(editing, "approved", true)}
              >
                {saving ? <Spinner data-icon="inline-start" /> : <CheckCircle2Icon data-icon="inline-start" />}
                Guardar y aprobar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
