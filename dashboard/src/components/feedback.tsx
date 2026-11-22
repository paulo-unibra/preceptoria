import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function Loading({
  label = "Carregando dados…",
  className,
}: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn("space-y-3 p-4", className)}>
      <span className="sr-only">{label}</span>
      <Skeleton aria-hidden="true" className="h-4 w-2/5" />
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} aria-hidden="true" className="h-10 w-full" />
      ))}
    </div>
  );
}

export function ChartSkeleton({ donut = false }: { donut?: boolean }) {
  return (
    <div aria-hidden="true" className="flex h-52 items-end justify-center gap-3 px-3 pb-5 sm:h-56 sm:gap-5">
      {donut ? (
        <Skeleton className="m-auto size-36 rounded-full border-[18px] border-muted bg-transparent" />
      ) : [44, 63, 53, 79, 60, 72, 50].map((height, index) => (
        <Skeleton key={index} className="w-full max-w-14" style={{ height: `${height}%` }} />
      ))}
    </div>
  );
}

export function PageSkeleton({ label = "Carregando indicadores…" }: { label?: string }) {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-4">
        <div className="grid gap-3 min-[360px]:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="glass space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="size-8" />
              </div>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {[false, true].map((donut) => (
            <div key={String(donut)} className="glass min-w-0 space-y-2 p-4 sm:p-5">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
              <ChartSkeleton donut={donut} />
            </div>
          ))}
        </div>
        <div className="glass space-y-3 p-5">
          <Skeleton className="h-4 w-36" />
          {[0, 1, 2].map((row) => <Skeleton key={row} className="h-10 w-full" />)}
        </div>
      </div>
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
      <div className="rounded-xl bg-accent p-3">
        <Inbox className="size-6 text-primary" />
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
