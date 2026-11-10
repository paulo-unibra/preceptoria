import {
  Component,
  lazy,
  Suspense,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { Navigate, Outlet, Route, Routes } from "react-router";
import { useAuth } from "@/lib/auth";
import { ErrorState, Loading } from "@/components/feedback";
import Layout from "@/components/layout";
import Login from "@/pages/login";

const Overview = lazy(() => import("@/pages/overview"));
const Students = lazy(() => import("@/pages/students"));
const Occurrences = lazy(() => import("@/pages/occurrences"));
const Ranking = lazy(() => import("@/pages/ranking"));
const Reports = lazy(() => import("@/pages/reports"));
const Imports = lazy(() => import("@/pages/imports"));

function ProtectedRoute() {
  const { user, loading, error, retry, signOut } = useAuth();
  if (loading) return <Loading label="Restaurando sua sessão…" />;
  if (error)
    return (
      <main className="mx-auto max-w-xl space-y-4 p-8">
        <ErrorState error={error} retry={retry} />
        <button
          className="text-sm text-primary"
          onClick={() => {
            void signOut();
          }}
        >
          Voltar ao login
        </button>
      </main>
    );
  return user ? <Outlet /> : <Login />;
}

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro na interface do dashboard", error, info.componentStack);
  }
  render() {
    return this.state.failed ? (
      <main className="mx-auto max-w-xl p-8">
        <ErrorState
          error={
            new Error(
              "A interface encontrou um problema. Recarregue a página para continuar.",
            )
          }
          retry={() => window.location.reload()}
        />
      </main>
    ) : (
      this.props.children
    );
  }
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="estudantes" element={<Students />} />
            <Route path="ocorrencias" element={<Occurrences />} />
            <Route path="ranking" element={<Ranking />} />
            <Route path="relatorios" element={<Reports />} />
            <Route path="importacoes" element={<Imports />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
