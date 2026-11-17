"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  MegaphoneIcon,
  MessageCircleIcon,
  MousePointerClickIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_PUBLIC } from "@/lib/supabase/config";
import {
  addDaysToISODate,
  buildWhatsAppTarget,
  daysUntilDate,
  formatDateAR,
  parseWhatsAppTarget,
  todayISODate,
} from "@/lib/format";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AdActionType, AdBanner } from "@/types/taxiya";

export function AdsManagerView() {
  const { localities, selectedLocalityId, selectedLocality } = useLocality();
  const [banners, setBanners] = useState<AdBanner[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdBanner | null>(null);

  // Campos de campaña
  const [businessName, setBusinessName] = useState("");
  const [localityId, setLocalityId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [startDate, setStartDate] = useState(() => todayISODate());
  const [endDate, setEndDate] = useState(() => addDaysToISODate(todayISODate(), 30));
  const [isPaid, setIsPaid] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [actionType, setActionType] = useState<AdActionType>("whatsapp");
  const [waPhone, setWaPhone] = useState("");
  const [waMessage, setWaMessage] = useState("Hola, vi tu aviso en TaxiYa y quiero consultar.");
  const [webUrl, setWebUrl] = useState("");

  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  const localityById = useMemo(
    () => new Map(localities.map((l) => [l.id, l.name])),
    [localities]
  );

  const fetchBannersData = useCallback(async (withSpinner: boolean) => {
    if (withSpinner) setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ad_banners")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("No pudimos cargar los avisos locales. Probá actualizar.");
        return;
      }
      setBanners((data ?? []) as AdBanner[]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBanners = useCallback(() => fetchBannersData(true), [fetchBannersData]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return fetchBannersData(false);
    });
    return () => {
      active = false;
    };
  }, [fetchBannersData]);

  function openCreate() {
    const start = todayISODate();
    setEditing(null);
    setBusinessName("");
    setLocalityId(
      selectedLocalityId !== "all"
        ? selectedLocalityId
        : localities[0]?.id ?? ""
    );
    setImageUrl("");
    setStartDate(start);
    setEndDate(addDaysToISODate(start, 30));
    setIsPaid(false);
    setIsActive(true);
    setActionType("whatsapp");
    setWaPhone("");
    setWaMessage("Hola, vi tu aviso en TaxiYa y quiero consultar.");
    setWebUrl("");
    setModalOpen(true);
  }

  function openEdit(banner: AdBanner) {
    setEditing(banner);
    setBusinessName(banner.business_name);
    setLocalityId(banner.locality_id);
    setImageUrl(banner.image_url);
    setStartDate(banner.start_date.slice(0, 10));
    setEndDate(banner.end_date.slice(0, 10));
    setIsPaid(banner.is_paid);
    setIsActive(banner.is_active);
    setActionType(banner.action_type);

    if (banner.action_type === "whatsapp") {
      const parsed = parseWhatsAppTarget(banner.action_target);
      setWaPhone(parsed.phone);
      setWaMessage(parsed.message || "Hola, vi tu aviso en TaxiYa.");
      setWebUrl("");
    } else {
      setWebUrl(banner.action_target);
      setWaPhone("");
      setWaMessage("");
    }
    setModalOpen(true);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("La imagen supera los 4 MB. Subí un banner más liviano.");
      return;
    }

    setUploadingImage(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `ad_banners/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET_PUBLIC)
        .upload(filePath, file, { upsert: true });

      if (error) {
        toast.error(`No pudimos subir el banner: ${error.message}`);
        return;
      }

      const { data } = supabase.storage.from(BUCKET_PUBLIC).getPublicUrl(filePath);
      setImageUrl(data.publicUrl);
      toast.success("Imagen subida al bucket público.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim() || !localityId || !imageUrl.trim()) {
      toast.error("Completá el nombre del comercio, la localidad y la imagen del banner.");
      return;
    }

    let actionTarget = "";
    if (actionType === "whatsapp") {
      if (!waPhone.trim()) {
        toast.error("Ingresá un número de WhatsApp válido (con característica, sin 0 ni 15).");
        return;
      }
      actionTarget = buildWhatsAppTarget(waPhone, waMessage);
    } else {
      const cleanUrl = webUrl.trim();
      if (!cleanUrl) {
        toast.error("Ingresá el enlace externo del comercio o red social.");
        return;
      }
      actionTarget = cleanUrl.startsWith("http") ? cleanUrl : `https://${cleanUrl}`;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        business_name: businessName.trim(),
        locality_id: localityId,
        image_url: imageUrl.trim(),
        action_type: actionType,
        action_target: actionTarget,
        start_date: startDate,
        end_date: endDate,
        is_paid: isPaid,
        is_active: isActive,
      };

      if (editing) {
        const { error } = await supabase
          .from("ad_banners")
          .update(payload)
          .eq("id", editing.id);

        if (error) {
          toast.error(`No pudimos actualizar la campaña: ${error.message}`);
          return;
        }
        toast.success(`Campaña de ${payload.business_name} guardada.`);
      } else {
        const { error } = await supabase.from("ad_banners").insert(payload);
        if (error) {
          toast.error(`No pudimos crear la campaña: ${error.message}`);
          return;
        }
        toast.success(`Campaña de ${payload.business_name} creada por 30 días.`);
      }

      setModalOpen(false);
      await loadBanners();
    } finally {
      setSaving(false);
    }
  }

  async function togglePaid(banner: AdBanner) {
    const supabase = createClient();
    const { error } = await supabase
      .from("ad_banners")
      .update({ is_paid: !banner.is_paid })
      .eq("id", banner.id);

    if (error) {
      toast.error("No pudimos cambiar el estado de pago.");
      return;
    }
    toast.success(
      !banner.is_paid
        ? `${banner.business_name} marcado como pagado ($ 3 USD).`
        : `${banner.business_name} pasó a pago pendiente.`
    );
    await loadBanners();
  }

  async function toggleActive(banner: AdBanner) {
    const supabase = createClient();
    const { error } = await supabase
      .from("ad_banners")
      .update({ is_active: !banner.is_active })
      .eq("id", banner.id);

    if (error) {
      toast.error("No pudimos cambiar el estado de publicación.");
      return;
    }
    await loadBanners();
  }

  const filteredBanners = useMemo(() => {
    if (selectedLocalityId === "all") return banners;
    return banners.filter((b) => b.locality_id === selectedLocalityId);
  }, [banners, selectedLocalityId]);

  const totalClicks = useMemo(
    () => filteredBanners.reduce((acc, b) => acc + (b.clicks_count || 0), 0),
    [filteredBanners]
  );

  const activePaidCount = useMemo(
    () => filteredBanners.filter((b) => b.is_active && b.is_paid).length,
    [filteredBanners]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Publicidad local</h1>
          <p className="text-sm text-muted-foreground">
            Banners para comercios de Belén y Andalgalá ($ 3 USD/mes por 30 días, visibles para usuarios en plan Gratuito).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadBanners}>
            <RefreshCwIcon data-icon="inline-start" />
            Actualizar
          </Button>
          <Button size="sm" onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            Nueva campaña
          </Button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Campañas en {selectedLocality?.name ?? "todas las zonas"}</CardDescription>
            <CardTitle className="text-2xl">{filteredBanners.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {activePaidCount} activas y pagadas ($ {activePaidCount * 3} USD/mes)
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Clics acumulados</CardDescription>
            <CardTitle className="flex items-center justify-between text-2xl">
              <span>{totalClicks}</span>
              <MousePointerClickIcon className="size-5 text-secondary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Redirecciones directas a WhatsApp o sitio web
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tarifa fija por comercio</CardDescription>
            <CardTitle className="text-2xl">$ 3 USD / mes</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Ciclo estándar de 30 días corridos
          </CardContent>
        </Card>
      </div>

      {/* Lista de campañas */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : filteredBanners.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MegaphoneIcon />
                </EmptyMedia>
                <EmptyTitle>Todavía no hay campañas cargadas</EmptyTitle>
                <EmptyDescription>
                  Creá el primer banner comercial para esta localidad. Mientras no haya avisos activos, la app muestra respaldo interno de TaxiYa.
                </EmptyDescription>
              </EmptyHeader>
              <Button onClick={openCreate}>
                <PlusIcon data-icon="inline-start" />
                Cargar primer comercio
              </Button>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredBanners.map((banner) => {
            const daysLeft = daysUntilDate(banner.end_date);
            const isExpired = daysLeft !== null && daysLeft < 0;
            const isExpiring = daysLeft !== null && daysLeft >= 0 && daysLeft <= 5;

            return (
              <Card key={banner.id} className="overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="relative h-40 w-full bg-muted">
                    <img
                      src={banner.image_url}
                      alt={`Banner de ${banner.business_name}`}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <Badge variant={banner.is_active ? "success" : "outline"}>
                        {banner.is_active ? "Activo" : "Pausado"}
                      </Badge>
                      <Badge variant="secondary">
                        {localityById.get(banner.locality_id) ?? "Sin zona"}
                      </Badge>
                    </div>
                  </div>

                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{banner.business_name}</CardTitle>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Editar ${banner.business_name}`}
                        onClick={() => openEdit(banner)}
                      >
                        <PencilIcon />
                      </Button>
                    </div>
                    <CardDescription className="text-xs">
                      Del {formatDateAR(banner.start_date)} al {formatDateAR(banner.end_date)}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant={banner.is_paid ? "success" : "warning"}>
                        {banner.is_paid ? "Pago acreditado ($ 3 USD)" : "Pago pendiente"}
                      </Badge>
                      {isExpired ? (
                        <Badge variant="destructive">Vencido</Badge>
                      ) : isExpiring ? (
                        <Badge variant="warning">Vence en {daysLeft} d</Badge>
                      ) : (
                        <span className="text-muted-foreground">{daysLeft ?? 0} días restantes</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                      <span className="flex items-center gap-1.5 font-medium">
                        {banner.action_type === "whatsapp" ? (
                          <MessageCircleIcon className="size-3.5 text-success" />
                        ) : (
                          <ExternalLinkIcon className="size-3.5 text-secondary" />
                        )}
                        {banner.action_type === "whatsapp" ? "WhatsApp directo" : "Enlace web"}
                      </span>
                      <span className="font-semibold">{banner.clicks_count} clics</span>
                    </div>
                  </CardContent>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => togglePaid(banner)}
                  >
                    <CheckCircle2Icon data-icon="inline-start" />
                    {banner.is_paid ? "Marcar impago" : "Marcar pagado"}
                  </Button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Visible</span>
                    <Switch
                      checked={banner.is_active}
                      onCheckedChange={() => toggleActive(banner)}
                      aria-label={`Activar o pausar ${banner.business_name}`}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal crear / editar campaña */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Editar campaña · ${editing.business_name}` : "Nueva campaña local ($ 3 USD/mes)"}
            </DialogTitle>
            <DialogDescription>
              Subí la imagen del comercio, fijá los 30 días de vigencia y configurá adónde lleva al tocar el banner.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FieldGroup>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="ad-business">Nombre del comercio</FieldLabel>
                  <Input
                    id="ad-business"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Ej: Farmacia San José"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="ad-locality">Localidad</FieldLabel>
                  <Select value={localityId} onValueChange={setLocalityId}>
                    <SelectTrigger id="ad-locality">
                      <SelectValue placeholder="Elegí una localidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {localities.map((loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="ad-image-file">Imagen del banner (bucket taxiya_public)</FieldLabel>
                <div className="flex flex-col gap-2">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Vista previa del banner"
                      className="h-36 w-full rounded-lg border border-border object-cover"
                    />
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" asChild disabled={uploadingImage}>
                      <label htmlFor="ad-image-file" className="cursor-pointer">
                        {uploadingImage ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <UploadIcon data-icon="inline-start" />
                        )}
                        {uploadingImage ? "Subiendo imagen..." : "Subir imagen"}
                        <input
                          id="ad-image-file"
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={handleImageUpload}
                        />
                      </label>
                    </Button>
                    <Input
                      aria-label="URL de la imagen del banner"
                      placeholder="O pegá una URL pública"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>
                <FieldDescription>
                  Formato horizontal recomendado (16:5 o 3:1), hasta 4 MB.
                </FieldDescription>
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="ad-start">Fecha de inicio</FieldLabel>
                  <Input
                    id="ad-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStartDate(val);
                      if (!editing && val) {
                        setEndDate(addDaysToISODate(val, 30));
                      }
                    }}
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="ad-end">Vencimiento (30 días)</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Input
                      id="ad-end"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEndDate(addDaysToISODate(startDate, 30))}
                    >
                      +30 d
                    </Button>
                  </div>
                </Field>
              </div>

              <Field>
                <FieldLabel>Acción al tocar el banner</FieldLabel>
                <ToggleGroup
                  type="single"
                  value={actionType}
                  onValueChange={(val) => {
                    if (val === "whatsapp" || val === "web") setActionType(val);
                  }}
                  spacing={2}
                >
                  <ToggleGroupItem value="whatsapp">WhatsApp con mensaje</ToggleGroupItem>
                  <ToggleGroupItem value="web">Sitio web o red social</ToggleGroupItem>
                </ToggleGroup>
              </Field>

              {actionType === "whatsapp" ? (
                <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-background p-3">
                  <Field>
                    <FieldLabel htmlFor="ad-wa-phone">Teléfono de WhatsApp</FieldLabel>
                    <Input
                      id="ad-wa-phone"
                      type="tel"
                      value={waPhone}
                      onChange={(e) => setWaPhone(e.target.value)}
                      placeholder="+54 9 3835 412345"
                      required
                    />
                    <FieldDescription>
                      Con característica, sin 0 ni 15.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ad-wa-msg">Mensaje prellenado</FieldLabel>
                    <Textarea
                      id="ad-wa-msg"
                      rows={2}
                      value={waMessage}
                      onChange={(e) => setWaMessage(e.target.value)}
                    />
                  </Field>
                </div>
              ) : (
                <Field>
                  <FieldLabel htmlFor="ad-web-url">Enlace externo</FieldLabel>
                  <Input
                    id="ad-web-url"
                    type="url"
                    value={webUrl}
                    onChange={(e) => setWebUrl(e.target.value)}
                    placeholder="https://instagram.com/comercio_belen"
                    required
                  />
                </Field>
              )}

              <div className="flex flex-wrap items-center gap-6 pt-1">
                <Field orientation="horizontal">
                  <Switch id="ad-paid" checked={isPaid} onCheckedChange={setIsPaid} />
                  <FieldLabel htmlFor="ad-paid">Pago acreditado ($ 3 USD)</FieldLabel>
                </Field>

                <Field orientation="horizontal">
                  <Switch id="ad-active" checked={isActive} onCheckedChange={setIsActive} />
                  <FieldLabel htmlFor="ad-active">Campaña activa</FieldLabel>
                </Field>
              </div>
            </FieldGroup>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner data-icon="inline-start" /> : null}
                {editing ? "Guardar campaña" : "Publicar campaña"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
