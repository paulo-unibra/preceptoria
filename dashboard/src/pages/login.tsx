import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Login() {
  const { signIn } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await signIn(String(form.get("email")), String(form.get("password")));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Não foi possível entrar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-scene min-h-svh p-5 sm:p-10">
      <div className="mx-auto flex min-h-[calc(100svh-80px)] max-w-6xl flex-col">
        <Brand />
        <div className="grid flex-1 items-center gap-16 py-12 lg:grid-cols-2">
          <section className="hidden lg:block">
            <span className="eyebrow">
              <Sparkles className="size-3.5" /> Um novo olhar para a educação
            </span>
            <h1 className="mt-7 text-5xl leading-[1.15] font-semibold tracking-[-0.045em]">
              Mais clareza.
              <br />
              Mais cuidado.
              <br />
              <span className="text-primary">Mais possibilidades.</span>
            </h1>
            <p className="mt-6 max-w-sm leading-7 text-muted-foreground">
              Transforme os registros do dia a dia em uma visão completa da
              jornada de cada estudante.
            </p>
            <div className="glass mt-10 flex max-w-sm items-center gap-4 p-5">
              <div className="soft-icon">
                <GraduationCap />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  Uma escola mais conectada
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pessoas, dados e decisões no mesmo lugar.
                </p>
              </div>
            </div>
          </section>
          <section className="glass mx-auto w-full max-w-md p-7 sm:p-10">
            <span className="eyebrow">Bem-vindo de volta</span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              Seu próximo olhar
              <br />
              começa aqui.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Entre com a mesma conta do aplicativo Preceptoria.
            </p>
            <form onSubmit={submit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  E-mail
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="seu.email@escola.com.br"
                  required
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Senha
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={visible ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Sua senha de acesso"
                    className="pr-12"
                    required
                    disabled={busy}
                  />
                  <button
                    type="button"
                    aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                    className="absolute top-0 right-0 flex size-11 items-center justify-center text-muted-foreground"
                  >
                    {visible ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>
              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={busy}
                className="mt-2 h-12 w-full"
              >
                {busy ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <>
                    Acessar dashboard
                    <ArrowRight />
                  </>
                )}
              </Button>
            </form>
            <p className="mt-7 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4" />
              Acesso seguro e restrito à sua equipe
            </p>
          </section>
        </div>
        <footer className="text-center text-xs text-muted-foreground">
          Preceptoria · Secretaria de Educação de Itapissuma
        </footer>
      </div>
    </main>
  );
}
