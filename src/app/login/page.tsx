import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-md flex-col gap-4">
        <LoginForm initialReason={params.motivo} />
        <p className="text-center text-xs text-muted-foreground">
          Plataforma de despacho local sin cálculo de tarifas ni cobro de comisiones.
        </p>
      </div>
    </main>
  );
}
