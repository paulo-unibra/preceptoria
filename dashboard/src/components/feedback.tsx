import { AlertCircle, Inbox, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function Loading({ label = "Carregando dados…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground"
    >
      <LoaderCircle className="size-5 animate-spin" />
      {label}
    </div>
  );
}
export function PageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando indicadores"
      className="space-y-6"
    >
      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-40 rounded-3xl bg-white/70" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-3xl bg-white/70" />
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="glass flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <AlertCircle className="size-7 text-amber-600" />
      <h2 className="font-semibold">Não foi possível carregar os dados</h2>
      <p className="max-w-lg text-sm text-muted-foreground">{error.message}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          <RefreshCw />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
export function EmptyState({
  title = "Nenhum registro encontrado",
  description = "Experimente outra turma ou outro período.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="rounded-2xl bg-white/40 p-3">
        <Inbox className="size-6 text-[#9c8068]" />
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
