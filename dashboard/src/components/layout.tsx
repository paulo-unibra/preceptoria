import { Suspense, useState } from "react";
import { NavLink, Outlet, useLocation, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ChevronRight,
  ClipboardList,
  FileChartColumn,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Upload,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn, dateISO, initials } from "@/lib/utils";
import type { Classroom } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ErrorState, Loading, PageSkeleton } from "@/components/feedback";

const navigation = [
  { path: "/", label: "Visão geral", icon: LayoutDashboard, description: "Indicadores de frequência, registros acadêmicos e acompanhamento das turmas." },
  { path: "/estudantes", label: "Estudantes", icon: Users, description: "Consulte as fichas e o histórico dos estudantes." },
  { path: "/ocorrencias", label: "Ocorrências", icon: ClipboardList, description: "Acompanhe os registros acadêmicos do período." },
  { path: "/ranking", label: "Destaques", icon: Trophy, description: "Veja os destaques das turmas no período." },
  { path: "/relatorios", label: "Relatórios", icon: FileChartColumn, description: "Consulte e exporte os indicadores consolidados das turmas." },
  { path: "/atividade", label: "Atividade", icon: Activity, description: "Confira quem gravou ou alterou os registros e o que mudou." },
  { path: "/importacoes", label: "Importações", icon: Upload, description: "Importe fichas de estudantes e consulte o histórico de arquivos." },
];
const roles = {
  admin: "Administração",
  coordenacao: "Coordenação",
  preceptor: "Preceptor(a)",
};

function SidebarBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", compact && "justify-center")}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <GraduationCap className="size-5" />
      </span>
      <span className={compact ? "sr-only" : "min-w-0"}>
        <span className="block text-sm font-semibold tracking-tight">Preceptoria</span>
        <span className="block text-[11px] text-muted-foreground">Acompanhamento escolar</span>
      </span>
    </div>
  );
}

export default function Layout() {
  const { user, signOut } = useAuth();
  const visibleNavigation = navigation.filter(
    (item) =>
      (item.path !== "/importacoes" || user?.role === "admin") &&
      (item.path !== "/atividade" || user?.role === "admin" || user?.role === "coordenacao"),
  );
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = location.pathname.replace(/\/$/, "") || "/";
  const current = navigation.find((item) => item.path === pathname) ?? navigation[0];
  const isActivity = current.path === "/atividade";
  const hasFilters = current.path !== "/importacoes" && (!isActivity || visibleNavigation.includes(current));
  const classrooms = useQuery({
    queryKey: isActivity ? ["classrooms", "all"] : ["classrooms"],
    queryFn: ({ signal }) =>
      api<{ data: Classroom[] }>("/classrooms", {
        query: { is_active: isActivity ? undefined : true },
        signal,
      }),
    enabled: hasFilters,
    staleTime: 5 * 60_000,
  });
  const today = isActivity ? new Date().toISOString().slice(0, 10) : dateISO();
  const weekAgo = new Date(`${today}T12:00:00`);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const validDate = (value: string | null, fallback: string) =>
    value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
      ? value
      : fallback;
  const from = validDate(params.get("from"), dateISO(weekAgo));
  const to = validDate(params.get("to"), today);
  const requestedClassroom = params.get("classroom") || "";
  const classroomId = classrooms.data?.data.some((item) => String(item.id) === requestedClassroom)
    ? requestedClassroom
    : "";
  const invalidRange = from > to || (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000 > 92;

  function updateFilter(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      return next;
    }, { replace: true });
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "me" });
    } finally {
      setRefreshing(false);
    }
  }

  const navigationParams = new URLSearchParams(params);
  navigationParams.delete("page");
  const renderNavigation = (mobile = false) => (
    <nav aria-label={mobile ? "Navegação mobile" : "Navegação principal"} className="space-y-1">
      {visibleNavigation.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={{ pathname: path, search: navigationParams.toString() }}
          end={path === "/"}
          title={!mobile && compact ? label : undefined}
          onClick={mobile ? () => setMenuOpen(false) : undefined}
          className={({ isActive }) => cn("nav-item", isActive && "active", !mobile && compact && "justify-center px-0")}
        >
          <Icon className="size-4" strokeWidth={1.8} />
          <span className={!mobile && compact ? "sr-only" : undefined}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
  const contentSkeleton = current.path === "/" ? <PageSkeleton /> : <Loading className="glass p-5" />;

  return (
    <div className="dashboard-shell" data-compact={compact}>
      <a className="skip-link" href="#main">Pular para o conteúdo</a>
      <aside className="dashboard-sidebar">
        <SidebarBrand compact={compact} />
        <div className="mt-9">
          {!compact && <p className="mb-2 px-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Painel escolar</p>}
          {renderNavigation()}
        </div>
        <div className="mt-auto space-y-3 pt-8">
          {!compact && (
            <div className="flex items-center gap-2.5 rounded-lg border bg-accent/60 p-3">
              <ShieldCheck className="size-4 text-primary" />
              <span className="text-xs text-muted-foreground">Equipe escolar</span>
            </div>
          )}
          <button
            type="button"
            className={cn("nav-item w-full", compact && "justify-center px-0")}
            aria-label={compact ? "Expandir menu" : "Recolher menu"}
            aria-expanded={!compact}
            title={compact ? "Expandir menu" : undefined}
            onClick={() => setCompact(!compact)}
          >
            {compact ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" /> Recolher menu</>}
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="dashboard-header">
          <div className="flex min-w-0 items-center gap-2.5 text-sm">
            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="outline" aria-label="Abrir navegação" className="lg:hidden">
                  <Menu />
                </Button>
              </DialogTrigger>
              <DialogContent className="mobile-menu top-0 left-0 flex h-svh w-72 translate-x-0 translate-y-0 flex-col overflow-y-auto p-5 sm:max-w-72">
                <DialogTitle className="sr-only">Navegação</DialogTitle>
                <DialogDescription className="sr-only">Seções do painel Preceptoria</DialogDescription>
                <SidebarBrand />
                <div className="mt-4">{renderNavigation(true)}</div>
              </DialogContent>
            </Dialog>
            <span className="hidden text-muted-foreground sm:inline">Painel</span>
            <ChevronRight className="hidden size-3.5 text-muted-foreground sm:block" />
            <span className="truncate font-medium">{current.label}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="avatar" aria-hidden="true">{initials(user?.full_name || "")}</span>
              <div className="hidden min-w-0 sm:block">
                <p className="max-w-44 truncate text-xs font-semibold">{user?.full_name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{user && roles[user.role]}</p>
              </div>
            </div>
            <Button size="icon" variant="outline" aria-label="Sair da conta" title="Sair da conta" disabled={loggingOut} onClick={() => { setLoggingOut(true); void signOut(); }}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="dashboard-main">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-[30px]">{current.label}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>
            </div>
            <Button variant="outline" onClick={() => void refresh()} disabled={refreshing}>
              <RefreshCw className="size-4" />
              {refreshing ? "Atualizando…" : "Atualizar"}
            </Button>
          </div>

          {hasFilters && (
            <section aria-label="Filtros do dashboard" className="filter-bar">
              <label className="filter-field">
                <span>Turma</span>
                {classrooms.isPending ? <Skeleton className="h-9 w-full" /> : (
                  <select className="filter-control" value={classroomId} onChange={(event) => updateFilter("classroom", event.target.value)} disabled={classrooms.isError}>
                    <option value="">Todas as turmas</option>
                    {classrooms.data?.data.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.school_year}</option>)}
                  </select>
                )}
              </label>
              <label className="filter-field">
                <span>{isActivity ? "Gravado a partir de (UTC)" : "Data inicial"}</span>
                <input type="date" className="filter-control" value={from} max={to} onChange={(event) => updateFilter("from", event.target.value)} />
              </label>
              <label className="filter-field">
                <span>{isActivity ? "Gravado até (UTC)" : "Data final"}</span>
                <input type="date" className="filter-control" value={to} min={from} max={today} onChange={(event) => updateFilter("to", event.target.value)} />
              </label>
            </section>
          )}

          {hasFilters && classrooms.error ? (
            <ErrorState error={classrooms.error} retry={() => { void classrooms.refetch(); }} />
          ) : hasFilters && invalidRange ? (
            <ErrorState error={new Error("Selecione um período válido de até 93 dias.")} />
          ) : hasFilters && classrooms.isPending ? contentSkeleton : (
            <Suspense fallback={contentSkeleton}>
              <Outlet context={{ classroomId, from, to, classrooms: classrooms.data?.data ?? [] }} />
            </Suspense>
          )}

          <footer className="flex flex-wrap justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
            <span>Preceptoria</span>
            <span>Secretaria de Educação de Itapissuma</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
