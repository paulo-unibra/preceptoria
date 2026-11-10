import { GraduationCap } from "lucide-react";

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-white/40 bg-[#544334] text-[#fff7ee] shadow-lg shadow-[#453022]/10">
        <GraduationCap className="size-6" strokeWidth={1.7} />
      </div>
      <div>
        <span className="text-lg font-semibold tracking-tight">
          preceptoria<span className="text-primary">.</span>
        </span>
        <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Acompanhamento escolar
        </p>
      </div>
    </div>
  );
}
