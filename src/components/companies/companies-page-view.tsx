"use client";

import React, { useMemo, useState } from "react";
import { Building2Icon, PencilIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatDateAR } from "@/lib/format";
import { useLocality } from "@/components/providers/locality-provider";
import { CompanyManagerDialog } from "@/components/shell/company-manager-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TaxiCompany } from "@/types/taxiya";

export function CompaniesPageView() {
  const { localities, companies, selectedLocalityId, selectedLocality, refreshReferenceData } =
    useLocality();
  const [dialogOpen, setDialogOpen] = useState(false);

  const localityMap = useMemo(
    () => new Map(localities.map((l) => [l.id, l.name])),
    [localities]
  );

  const filteredCompanies = useMemo(() => {
    if (selectedLocalityId === "all") return companies;
    return companies.filter((c) => c.locality_id === selectedLocalityId);
  }, [companies, selectedLocalityId]);

  async function toggleCompanyStatus(company: TaxiCompany) {
    const supabase = createClient();
    const { error } = await supabase
      .from("taxi_companies")
      .update({ is_active: !company.is_active })
      .eq("id", company.id);

    if (error) {
      toast.error(`No pudimos cambiar el estado de ${company.name}.`);
      return;
    }

    toast.success(
      !company.is_active
        ? `${company.name} quedó activa.`
        : `${company.name} quedó inactiva.`
    );
    await refreshReferenceData();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Empresas de taxis</h1>
          <p className="text-sm text-muted-foreground">
            Flotas privadas habilitadas en {selectedLocality ? selectedLocality.name : "todas las localidades"}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refreshReferenceData}>
            <RefreshCwIcon data-icon="inline-start" />
            Actualizar
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            Gestionar empresas
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de empresas</CardTitle>
          <CardDescription>
            Belén opera con 2 empresas privadas más independientes; Andalgalá solo con independientes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCompanies.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Building2Icon />
                </EmptyMedia>
                <EmptyTitle>Sin empresas registradas en esta zona</EmptyTitle>
                <EmptyDescription>
                  Si se habilita una nueva empresa privada de taxis en esta localidad, cargala desde Gestionar empresas.
                </EmptyDescription>
              </EmptyHeader>
              <Button onClick={() => setDialogOpen(true)}>
                <PlusIcon data-icon="inline-start" />
                Agregar empresa
              </Button>
            </Empty>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Localidad</TableHead>
                    <TableHead>Color en mapa</TableHead>
                    <TableHead>Alta</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {company.logo_url ? (
                            <img
                              src={company.logo_url}
                              alt={`Logo ${company.name}`}
                              className="size-8 rounded border border-border object-cover"
                            />
                          ) : (
                            <div
                              className="flex size-8 items-center justify-center rounded border border-border text-xs font-bold text-white"
                              style={{ backgroundColor: company.badge_color }}
                            >
                              {company.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium">{company.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{localityMap.get(company.locality_id) ?? "Sin zona"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span
                            className="size-3.5 rounded-full border border-border"
                            style={{ backgroundColor: company.badge_color }}
                          />
                          <span>{company.badge_color}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateAR(company.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={company.is_active ? "success" : "outline"}>
                          {company.is_active ? "Activa" : "Inactiva"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Switch
                            checked={company.is_active}
                            onCheckedChange={() => toggleCompanyStatus(company)}
                            aria-label={`Activar o desactivar ${company.name}`}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDialogOpen(true)}
                          >
                            <PencilIcon data-icon="inline-start" />
                            Editar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CompanyManagerDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
