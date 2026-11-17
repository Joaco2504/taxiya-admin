"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, EyeIcon, EyeOffIcon, ShieldCheckIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

export function LoginForm({ initialReason }: { initialReason?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    initialReason === "sin_permisos"
      ? "Tu cuenta no tiene permisos de administración activos en TaxiYa. Si necesitás acceso, consultá con el coordinador."
      : null
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMsg("Completá tu correo y tu contraseña para ingresar.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError || !authData.user) {
        setErrorMsg(
          "No pudimos iniciar sesión porque el correo o la contraseña no coinciden. Revisá los datos y probá otra vez."
        );
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, account_status")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setErrorMsg(
          "No encontramos tu perfil en el esquema de TaxiYa. Tu sesión se cerró por seguridad."
        );
        return;
      }

      if (profile.role !== "admin" || profile.account_status !== "active") {
        await supabase.auth.signOut();
        setErrorMsg(
          "Tu cuenta no está habilitada como administrador activo. Cerramos la sesión y bloqueamos el acceso."
        );
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setErrorMsg(
        "No pudimos conectarnos con el servidor de autenticación. Revisá tu internet y probá de nuevo."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-border bg-card shadow-sm">
      <CardHeader className="gap-2">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            TY
          </div>
          <div className="flex flex-col">
            <CardTitle className="text-xl">TaxiYa Admin</CardTitle>
            <CardDescription>Belén y Andalgalá · Catamarca</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          {errorMsg ? (
            <Alert variant="destructive" role="alert">
              <AlertCircleIcon />
              <AlertTitle>Acceso no autorizado</AlertTitle>
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          ) : null}

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="login-email">Correo electrónico</FieldLabel>
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="admin@taxiya.com.ar"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="login-password">Contraseña</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <InputGroupAddon align="inline-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-pressed={showPassword}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </Button>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                Solo pueden ingresar administradores activos registrados en TaxiYa.
              </FieldDescription>
            </Field>
          </FieldGroup>

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Spinner data-icon="inline-start" />
                Verificando acceso...
              </>
            ) : (
              <>
                <ShieldCheckIcon data-icon="inline-start" />
                Ingresar al panel
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
