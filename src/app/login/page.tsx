import { LoginForm } from "@/components/auth/login-form";
import { AdminBrandLogo } from "@/components/shell/admin-brand-logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-md flex-col gap-4">
        <div className="flex items-center justify-center gap-3">
          <AdminBrandLogo size={44} />
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              TaxiYa Admin
            </h1>
            <span className="text-xs text-muted-foreground">
              Operaciones Catamarca
            </span>
          </div>
        </div>
        <LoginForm initialReason={params.motivo} />
        <p className="text-center text-xs text-muted-foreground">
          Plataforma de despacho local sin cálculo de tarifas ni cobro de comisiones.
        </p>
      </div>
    </main>
  );
}
