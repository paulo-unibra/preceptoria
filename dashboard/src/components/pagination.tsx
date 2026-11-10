import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Page } from "@/lib/types";

export function Pagination({
  meta,
  page,
  onChange,
}: {
  meta: Page<unknown>["meta"];
  page: number;
  onChange: (page: number) => void;
}) {
  const lastPage = Math.max(1, meta.last_page);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
      <p className="text-xs text-muted-foreground">
        {meta.total} registro(s) · Página {page} de {lastPage}
      </p>
      <div className="flex gap-2">
        <Button
          size="icon"
          variant="outline"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label="Próxima página"
          disabled={page >= lastPage}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
