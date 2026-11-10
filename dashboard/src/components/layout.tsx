import { useState } from "react";
import { NavLink, Outlet, useLocation, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  FileChartColumn,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trophy,
  Upload,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn, dateISO, initials } from "@/lib/utils";
import type { Classroom } from "@/lib/types";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/feedback";

const navigation = [
  { path: "/", label: "Visão geral", icon: LayoutDashboard },
  { path: "/estudantes", label: "Estudantes", icon: Users },
  { path: "/ocorrencias", label: "Ocorrências", icon: ClipboardList },
  { path: "/ranking", label: "Destaques", icon: Trophy },
  { path: "/relatorios", label: "Relatórios", icon: FileChartColumn },
  { path: "/importacoes", label: "Importações", icon: Upload },
];
const roles = {
  admin: "Administração",
  coordenacao: "Coordenação",
  preceptor: "Preceptor(a)",
};

export default function Layout() {
  const { user, signOut } = useAuth();
  const visibleNavigation = navigation.filter(
    (item) => item.path !== "/importacoes" || user?.role === "admin",
  );
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const classrooms = useQuery({
    queryKey: ["classrooms"],
    queryFn: ({ signal }) =>
      api<{ data: Classroom[] }>("/classrooms", {
        query: { is_active: true },
        signal,
      }),
    staleTime: 5 * 60_000,
  });
  const today = dateISO();
  const weekAgo = new Date(`${today}T12:00:00`);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const validDate = (value: string | null, fallback: string) =>
    value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value))
      ? value
      : fallback;
  const from = validDate(params.get("from"), dateISO(weekAgo));
  const to = validDate(params.get("to"), today);
  const requestedClassroom = params.get("classroom") || "";
  const classroomId = classrooms.data?.data.some(
    (item) => String(item.id) === requestedClassroom,
  )
    ? requestedClassroom
    : "";
  const invalidRange =
    from > to ||
    (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000 > 92;

  function updateFilter(key: string, value: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  }
  async function refresh() {
    setRefreshing(true);
    try {
      await client.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== "me",
      });
    } finally {
      setRefreshing(false);
    }
  }
  async function logout() {
    setLoggingOut(true);
    await signOut();
  }

  const currentTitle =
    navigation.find((item) => item.path === location.pathname)?.label ||
    "Visão geral";
  const navigationParams = new URLSearchParams(params);
  navigationParams.delete("page");
  const linkTo = (path: string) => ({
    pathname: path,
    search: navigationParams.toString(),
  });

  return (
    <div className="dashboard-scene">
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      <div className="studio-shell">
        <header className="studio-header">
          <div className="flex min-w-0 items-center gap-3">
            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
              <DialogTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Abrir navegação"
                  className="lg:hidden"
                >
                  <Menu />
                </Button>
              </DialogTrigger>
              <DialogContent className="mobile-menu inset-y-0 left-0 flex h-svh w-72 translate-x-0 translate-y-0 flex-col p-6 sm:max-w-72">
                <DialogTitle className="sr-only">Navegação</DialogTitle>
                <DialogDescription className="sr-only">
                  Seções do dashboard Preceptoria
                </DialogDescription>
                <Brand />
                <nav aria-label="Navegação mobile" className="mt-8 space-y-2">
                  {visibleNavigation.map(({ path, label, icon: Icon }) => (
                    <NavLink
                      key={path}
                      to={linkTo(path)}
                      end={path === "/"}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        cn("nav-item", isActive && "active")
                      }
                    >
                      <Icon className="size-4" />
                      {label}
                    </NavLink>
                  ))}
                </nav>
                <p className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="size-4" />
                  Ambiente da equipe escolar
                </p>
              </DialogContent>
            </Dialog>
            <span className="avatar size-8 text-[10px]">
              {initials(user?.full_name || "")}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium">
                Bem-vindo, {user?.full_name.split(" ")[0]}
              </p>
              <p className="mt-0.5 text-[9px] text-muted-foreground">
                {user && roles[user.role]}
              </p>
            </div>
          </div>
          <span className="studio-message">
            <span className="studio-orb" />
            <span>
              Um olhar atento. <strong>Novas possibilidades.</strong>
            </span>
          </span>
          <div className="flex items-center gap-3">
            <span className="hidden text-[10px] tracking-tight text-muted-foreground sm:inline">
              preceptoria
              <span className="font-semibold text-foreground">.</span>
            </span>
            <Button
              size="icon"
              variant="outline"
              className="rounded-full"
              aria-label="Sair da conta"
              title="Sair da conta"
              disabled={loggingOut}
              onClick={() => {
                void logout();
              }}
            >
              <LogOut className="size-3.5" />
            </Button>
          </div>
        </header>

        <div className="studio-body">
          <aside className="studio-rail hidden lg:flex">
            <div className="rail-logo" title="Preceptoria">
              <GraduationCap className="size-5" strokeWidth={1.6} />
            </div>
            <nav aria-label="Atalhos de navegação" className="rail-navigation">
              {visibleNavigation.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={linkTo(path)}
                  end={path === "/"}
                  aria-label={`Ir para ${label}`}
                  className={({ isActive }) =>
                    cn("rail-link", isActive && "active")
                  }
                >
                  <Icon className="size-4" strokeWidth={1.7} />
                  <span className="rail-tooltip">{label}</span>
                </NavLink>
              ))}
              <span className="rail-divider" />
              <span
                className="flex size-9 items-center justify-center text-white/65"
                title="Acesso protegido"
              >
                <ShieldCheck className="size-3.5" />
              </span>
            </nav>
            <span className="rail-caption">P.</span>
          </aside>

          <main id="main" tabIndex={-1} className="studio-main">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="eyebrow">
                  <span className="size-1 rounded-full bg-emerald-600" />
                  Seu espaço de acompanhamento
                </span>
                <h1 className="mt-2 text-[27px] leading-tight font-medium tracking-[-0.055em] sm:text-[32px]">
                  {currentTitle === "Visão geral"
                    ? `Um bom dia começa com um novo olhar.`
                    : currentTitle}
                </h1>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {currentTitle === "Visão geral"
                    ? "Pessoas, trajetórias e tudo o que importa. Mais perto de você."
                    : "Mais clareza para acompanhar. Mais espaço para transformar."}
                </p>
              </div>
              <Button
                className="studio-primary"
                onClick={() => {
                  void refresh();
                }}
                disabled={refreshing}
              >
                <RefreshCw
                  className={cn("size-3.5", refreshing && "animate-spin")}
                />
                Atualizar
              </Button>
            </div>

            {location.pathname !== "/importacoes" && (
              <section aria-label="Filtros do dashboard" className="filter-bar">
                <label className="filter-field">
                  <span>Turma</span>
                  <select
                    className="filter-control"
                    value={classroomId}
                    onChange={(event) =>
                      updateFilter("classroom", event.target.value)
                    }
                    disabled={classrooms.isPending}
                  >
                    <option value="">Todas as turmas</option>
                    {classrooms.data?.data.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {item.school_year}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="filter-field">
                  <span>De</span>
                  <input
                    aria-label="Data inicial"
                    type="date"
                    className="filter-control"
                    value={from}
                    max={to}
                    onChange={(event) =>
                      updateFilter("from", event.target.value)
                    }
                  />
                </label>
                <label className="filter-field">
                  <span>Até</span>
                  <input
                    aria-label="Data final"
                    type="date"
                    className="filter-control"
                    value={to}
                    min={from}
                    max={today}
                    onChange={(event) => updateFilter("to", event.target.value)}
                  />
                </label>
                <span className="ml-auto hidden items-center gap-2 text-[10px] text-muted-foreground xl:flex">
                  <CalendarDays className="size-3.5" />
                  {from === to
                    ? "Um dia, muitos olhares"
                    : "Seu período, em perspectiva"}
                </span>
              </section>
            )}

            {classrooms.error ? (
              <ErrorState
                error={classrooms.error}
                retry={() => {
                  void classrooms.refetch();
                }}
              />
            ) : invalidRange && location.pathname !== "/importacoes" ? (
              <ErrorState
                error={new Error("Selecione um período válido de até 93 dias.")}
              />
            ) : classrooms.isPending ? (
              <div
                role="status"
                className="py-12 text-center text-muted-foreground"
              >
                Carregando turmas…
              </div>
            ) : (
              <Outlet
                context={{
                  classroomId,
                  from,
                  to,
                  classrooms: classrooms.data?.data ?? [],
                }}
              />
            )}

            <footer className="studio-footer">
              <span>Preceptoria · Cuidado que transforma.</span>
              <span>Secretaria de Educação de Itapissuma</span>
            </footer>
          </main>
        </div>
      </div>
      <nav
        aria-label="Navegação principal"
        className="studio-dock hidden lg:flex"
      >
        {visibleNavigation.map(({ path, label }) => (
          <NavLink
            key={path}
            to={linkTo(path)}
            end={path === "/"}
            className={({ isActive }) => cn("dock-link", isActive && "active")}
          >
            {label}
          </NavLink>
        ))}
        <span className="dock-mark">
          <ArrowUpRight className="size-4" />
        </span>
      </nav>
      <div className="scene-signature" aria-hidden="true">
        <Sparkles className="size-3" />
        Um espaço para ver além.
      </div>
    </div>
  );
}
