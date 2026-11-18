"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  AlertTriangleIcon,
  BarChart3Icon,
  Building2Icon,
  CheckCircle2Icon,
  LifeBuoyIcon,
  LogOutIcon,
  MapIcon,
  MapPinIcon,
  MegaphoneIcon,
  MenuIcon,
  MoonIcon,
  SunIcon,
  UsersIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import { cn } from "cn";
import { createClient } from "@/lib/supabase/client";
import { formatDateTimeAR } from "@/lib/format";
import { useLocality } from "@/components/providers/locality-provider";
import { useEmergencies } from "@/components/providers/emergency-provider";
import { CompanyManagerDialog } from "@/components/shell/company-manager-dialog";
import { AdminBrandLogo } from "@/components/shell/admin-brand-logo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Profile } from "@/types/taxiya";

const NAV_ITEMS = [
  { href: "/", label: "Mapa en vivo", icon: MapIcon },
  { href: "/usuarios", label: "Usuarios y legajos", icon: UsersIcon },
  { href: "/puntos", label: "Puntos de referencia", icon: MapPinIcon },
  { href: "/estadisticas", label: "Estadísticas", icon: BarChart3Icon },
  { href: "/publicidad", label: "Publicidad local", icon: MegaphoneIcon },
  { href: "/soporte", label: "Soporte y reclamos", icon: LifeBuoyIcon },
  { href: "/empresas", label: "Empresas de taxis", icon: Building2Icon },
] as const;

export function AdminShell({
  admin,
  children,
}: {
  admin: Profile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [companiesOpen, setCompaniesOpen] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const { localities, selectedLocalityId, setSelectedLocalityId } = useLocality();
  const { activeEmergencies, isMuted, setIsMuted, testSound, resolveTicket } = useEmergencies();

  const localityMap = useMemo(
    () => new Map(localities.map((l) => [l.id, l.name])),
    [localities]
  );

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const adminInitials = (admin.full_name || admin.email || "AD")
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const renderNavLinks = (onNavigate?: () => void) => (
    <nav aria-label="Navegación principal" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
            {item.href === "/" && activeEmergencies.length > 0 ? (
              <Badge variant="destructive" className="ml-auto">
                {activeEmergencies.length}
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar fijo en escritorio */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-border px-4">
          <AdminBrandLogo size={36} />
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-none">TaxiYa Admin</span>
            <span className="text-xs text-muted-foreground mt-1">Operaciones Catamarca</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between p-3">
          {renderNavLinks()}

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Localidades activas</span>
              <Badge variant="outline">{localities.filter((l) => l.is_active).length}</Badge>
            </div>
            <p className="leading-relaxed">
              Sin cálculo de tarifas ni cobro de comisiones. Habilitación municipal obligatoria.
            </p>
          </div>
        </div>
      </aside>

      {/* Columna principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior global */}
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 lg:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Abrir menú de navegación"
                >
                  <MenuIcon />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-68 p-4">
                <SheetHeader className="pb-4">
                  <SheetTitle className="flex items-center gap-2.5">
                    <AdminBrandLogo size={30} />
                    <span>TaxiYa Admin</span>
                  </SheetTitle>
                </SheetHeader>
                {renderNavLinks(() => setMobileMenuOpen(false))}
              </SheetContent>
            </Sheet>

            {/* Selector global de localidad */}
            <div className="flex items-center gap-2">
              <Select value={selectedLocalityId} onValueChange={setSelectedLocalityId}>
                <SelectTrigger className="w-44 sm:w-56" aria-label="Filtrar por localidad">
                  <SelectValue placeholder="Todas las localidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">Todas las localidades</SelectItem>
                    {localities.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name} · {loc.province}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCompaniesOpen(true)}
              >
                <Building2Icon data-icon="inline-start" />
                <span className="hidden sm:inline">Empresas</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant={activeEmergencies.length > 0 ? "destructive" : "outline"}
              size="icon"
              aria-label={isMuted ? "Activar sonido de alertas" : "Silenciar alertas"}
              title={isMuted ? "Activar sonido de emergencia" : "Silenciar sonido de emergencia"}
              onClick={() => {
                const next = !isMuted;
                setIsMuted(next);
                if (!next) testSound();
              }}
            >
              {isMuted ? <VolumeXIcon /> : <Volume2Icon />}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Cambiar entre modo claro y oscuro"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {mounted && resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
            </Button>

            <Separator orientation="vertical" className="h-6" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {adminInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline max-w-36 truncate text-sm font-medium">
                    {admin.full_name || admin.email}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium truncate">
                      {admin.full_name || "Administrador"}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {admin.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setCompaniesOpen(true)}>
                    <Building2Icon />
                    Gestionar empresas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOutIcon />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Banner global prioritario de emergencias */}
        {activeEmergencies.length > 0 ? (
          <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2.5 lg:px-6">
            <Alert variant="destructive" className="border-destructive bg-card">
              <AlertTriangleIcon />
              <AlertTitle className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {activeEmergencies.length === 1
                    ? "1 emergencia activa en seguimiento"
                    : `${activeEmergencies.length} emergencias activas en seguimiento`}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">
                    {localityMap.get(activeEmergencies[0].locality_id ?? "") ?? "Sin zona"}
                  </Badge>
                  <span className="text-xs font-normal text-muted-foreground">
                    {formatDateTimeAR(activeEmergencies[0].created_at)}
                  </span>
                </div>
              </AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <span>
                  {activeEmergencies[0].description ||
                    "Un usuario presionó el botón de emergencia durante un servicio."}
                </span>
                <div className="flex items-center gap-2">
                  {pathname !== "/" ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/">Ver en el mapa</Link>
                    </Button>
                  ) : null}
                  {pathname !== "/soporte" ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/soporte">Abrir reclamos</Link>
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => resolveTicket(activeEmergencies[0].id)}
                  >
                    <CheckCircle2Icon data-icon="inline-start" />
                    Marcar resuelta
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        ) : null}

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>

      <CompanyManagerDialog open={companiesOpen} onOpenChange={setCompaniesOpen} />
    </div>
  );
}
