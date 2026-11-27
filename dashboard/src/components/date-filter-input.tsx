import { useId, useState, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";

function mask(digits: string) {
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter(Boolean)
    .join("/");
}

function parseDate(value: string) {
  const [day, month, year] = value.split("/");
  if (value.length !== 10 || year < "0001") return null;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}

export function DateFilterInput({
  label,
  value,
  max,
  onCommit,
}: {
  label: string;
  value: string;
  max: string;
  onCommit: (iso: string) => void;
}) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const [edit, setEdit] = useState<{ base: string; text: string; error?: string }>();
  const draft = edit?.base === value ? edit : undefined;

  function change(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const raw = input.value;
    const digitsBeforeCaret = raw.slice(0, input.selectionStart ?? raw.length).replace(/\D/g, "");
    const text = mask(raw.replace(/\D/g, ""));
    const caret = mask(digitsBeforeCaret).length;
    input.value = text;
    input.setSelectionRange(caret, caret);
    setEdit({ base: value, text });
  }

  function commit() {
    if (!draft) return;
    const iso = parseDate(draft.text);
    if (!iso || iso > max) {
      setEdit({ ...draft, error: iso ? "Informe uma data até hoje." : "Informe uma data válida no formato DD/MM/AAAA." });
      return;
    }
    setEdit(undefined);
    if (iso !== value) onCommit(iso);
  }

  return (
    <div className="filter-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/AAAA"
        value={draft?.text ?? value.split("-").reverse().join("/")}
        className={cn("filter-control", draft?.error && "border-destructive")}
        aria-invalid={draft?.error ? true : undefined}
        aria-describedby={draft?.error ? errorId : undefined}
        onChange={change}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") setEdit(undefined);
          const input = event.currentTarget;
          const caret = input.selectionStart;
          if (caret === null || caret !== input.selectionEnd) return;
          if (event.key === "Backspace" && input.value[caret - 1] === "/") {
            input.setSelectionRange(caret - 2, caret);
          }
          if (event.key === "Delete" && input.value[caret] === "/") {
            input.setSelectionRange(caret, caret + 2);
          }
        }}
      />
      {draft?.error && <span id={errorId} className="text-destructive" role="alert">{draft.error}</span>}
    </div>
  );
}
