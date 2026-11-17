"use client";

import React, { useMemo, useState } from "react";
import { Building2Icon, PencilIcon, PlusIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_PUBLIC } from "@/lib/supabase/config";
import { useLocality } from "@/components/providers/locality-provider";
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
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import type { TaxiCompany } from "@/types/taxiya";

const BADGE_PRESETS = ["#0284C7", "#16A34A", "#F59E0B", "#EA580C", "#DC2626", "#7C3AED"];

export function CompanyManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { localities, companies, selectedLocalityId, refreshReferenceData } = useLocality();
  const [editing, setEditing] = useState<TaxiCompany | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [localityId, setLocalityId] = useState("");
  const [badgeColor, setBadgeColor] = useState("#0284C7");
  const [isActive, setIsActive] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  const filteredCompanies = useMemo(() => {
    if (selectedLocalityId === "all") return companies;
    return companies.filter((c) => c.locality_id === selectedLocalityId);
  }, [companies, selectedLocalityId]);

  const localityMap = useMemo(
    () => new Map(localities.map((l) => [l.id, l.name])),
    [localities]
  );

  function startCreate() {
    setEditing(null);
    setCreating(true);
    setName("");
    setLocalityId(
      selectedLocalityId !== "all"
        ? selectedLocalityId
        : localities[0]?.id ?? ""
    );
    setBadgeColor("#0284C7");
    setIsActive(true);
    setLogoUrl(null);
  }

  function startEdit(company: TaxiCompany) {
    setCreating(false);
    setEditing(company);
    setName(company.name);
    setLocalityId(company.locality_id);
    setBadgeColor(company.badge_color || "#0284C7");
    setIsActive(company.is_active);
    setLogoUrl(company.logo_url);
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El logo pesa más de 2 MB. Elegí una imagen más liviana.");
      return;
    }
    setUploadingLogo(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "png";
      const filePath = `companies/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET_PUBLIC)
        .upload(filePath, file, { upsert: true });

      if (error) {
        toast.error(`No pudimos subir el logo: ${error.message}`);
        return;
      }

      const { data } = supabase.storage.from(BUCKET_PUBLIC).getPublicUrl(filePath);
      setLogoUrl(data.publicUrl);
      toast.success("Logo subido.");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !localityId) {
      toast.error("Ingresá el nombre de la empresa y elegí una localidad.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      if (editing) {
        const { error } = await supabase
          .from("taxi_companies")
          .update({
            name: name.trim(),
            locality_id: localityId,
            badge_color: badgeColor,
            is_active: isActive,
            logo_url: logoUrl,
          })
          .eq("id", editing.id);

        if (error) {
          toast.error(`No pudimos guardar los cambios: ${error.message}`);
          return;
        }
        toast.success(`Empresa ${name.trim()} actualizada.`);
      } else {
        const { error } = await supabase.from("taxi_companies").insert({
          name: name.trim(),
          locality_id: localityId,
          badge_color: badgeColor,
          is_active: isActive,
          logo_url: logoUrl,
        });

        if (error) {
          toast.error(`No pudimos crear la empresa: ${error.message}`);
          return;
        }
        toast.success(`Empresa ${name.trim()} agregada.`);
      }

      await refreshReferenceData();
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  const showingForm = creating || editing !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Empresas privadas de taxis</DialogTitle>
          <DialogDescription>
            Administrá las flotas privadas por localidad. En Belén operan empresas privadas e independientes; en Andalgalá operan solo independientes.
          </DialogDescription>
        </DialogHeader>

        {showingForm ? (
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="company-name">Nombre de la empresa</FieldLabel>
                <Input
                  id="company-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Remises Belén Centro"
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="company-locality">Localidad</FieldLabel>
                <Select value={localityId} onValueChange={setLocalityId}>
                  <SelectTrigger id="company-locality">
                    <SelectValue placeholder="Elegí una localidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {localities.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name} ({loc.province})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="company-color">Color identificador en el mapa</FieldLabel>
                <div className="flex flex-wrap items-center gap-2">
                  {BADGE_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setBadgeColor(color)}
                      aria-label={`Elegir color ${color}`}
                      className="size-7 rounded-full border-2 transition-transform"
                      style={{
                        backgroundColor: color,
                        borderColor: badgeColor === color ? "var(--foreground)" : "transparent",
                        transform: badgeColor === color ? "scale(1.1)" : "scale(1)",
                      }}
                    />
                  ))}
                  <Input
                    id="company-color"
                    type="text"
                    value={badgeColor}
                    onChange={(e) => setBadgeColor(e.target.value)}
                    className="w-28 font-mono text-xs"
                  />
                </div>
                <FieldDescription>
                  Este color distingue los móviles de la empresa frente a taxis independientes.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="company-logo">Logo de empresa (opcional)</FieldLabel>
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={`Logo de ${name || "la empresa"}`}
                      className="size-10 rounded-md border border-border object-cover"
                    />
                  ) : null}
                  <Button type="button" variant="outline" asChild disabled={uploadingLogo}>
                    <label htmlFor="company-logo" className="cursor-pointer">
                      {uploadingLogo ? <Spinner data-icon="inline-start" /> : <UploadIcon data-icon="inline-start" />}
                      {uploadingLogo ? "Subiendo..." : "Subir imagen"}
                      <input
                        id="company-logo"
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={handleLogoUpload}
                      />
                    </label>
                  </Button>
                </div>
              </Field>

              <Field orientation="horizontal">
                <Switch
                  id="company-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <FieldLabel htmlFor="company-active">Empresa activa</FieldLabel>
              </Field>
            </FieldGroup>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner data-icon="inline-start" /> : null}
                {editing ? "Guardar cambios" : "Crear empresa"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                {filteredCompanies.length === 1
                  ? "1 empresa registrada"
                  : `${filteredCompanies.length} empresas registradas`}
              </span>
              <Button size="sm" onClick={startCreate}>
                <PlusIcon data-icon="inline-start" />
                Agregar empresa
              </Button>
            </div>

            {filteredCompanies.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Building2Icon />
                  </EmptyMedia>
                  <EmptyTitle>No hay empresas en esta localidad</EmptyTitle>
                  <EmptyDescription>
                    Todavía no se cargaron flotas privadas para esta zona. Tocá Agregar empresa si corresponde registrar una.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                {filteredCompanies.map((company) => (
                  <div
                    key={company.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="size-4 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: company.badge_color }}
                        aria-hidden="true"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium text-sm">{company.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {localityMap.get(company.locality_id) ?? "Sin localidad"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={company.is_active ? "success" : "outline"}>
                        {company.is_active ? "Activa" : "Inactiva"}
                      </Badge>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Editar ${company.name}`}
                        onClick={() => startEdit(company)}
                      >
                        <PencilIcon />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
