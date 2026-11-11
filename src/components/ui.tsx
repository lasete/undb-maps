import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/* Peças de interface do app, sobre os tokens do shadcn/ui + UNDB. */

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "md" | "lg" }) {
  const styles: Record<Variant, string> = {
    primary: "bg-primary text-primary-foreground shadow-[0_10px_24px_-10px_var(--primary)] hover:brightness-110",
    secondary: "border border-border bg-card text-foreground hover:bg-muted",
    ghost: "text-foreground hover:bg-muted",
    danger: "border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-[background-color,filter,transform] duration-150 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        size === "lg" ? "min-h-13 text-[0.95rem]" : "min-h-11",
        styles[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export type Tone = "free" | "busy" | "mine" | "neutral";

const TONE: Record<Tone, string> = {
  free: "bg-free-soft text-free",
  busy: "bg-busy-soft text-busy",
  mine: "bg-mine-soft text-mine",
  neutral: "bg-muted text-muted-foreground",
};

export function StatusPill({ tone, label, className }: { tone: Tone; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", TONE[tone], className)}>
      <span className={cn("size-1.5 rounded-full bg-current", tone === "free" && "shadow-[0_0_0_3px_color-mix(in_oklab,currentColor_25%,transparent)]")} aria-hidden />
      {label}
    </span>
  );
}

export function StatusDot({ tone }: { tone: Tone }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", { free: "bg-free", busy: "bg-busy", mine: "bg-mine", neutral: "bg-muted-foreground/40" }[tone])} />;
}

export function Chip({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors duration-150",
        active ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:bg-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Grupo segmentado (abas pequenas / escolha única). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; disabled?: boolean }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-muted p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-10 rounded-xl px-3 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 disabled:opacity-40",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={(v) => onChange(!!v)} className="scale-125" />
    </label>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h3 className="font-display text-[0.7rem] font-bold tracking-[0.16em] whitespace-nowrap text-muted-foreground uppercase">{children}</h3>
      <span className="h-px flex-1 bg-border" aria-hidden />
      {aside}
    </div>
  );
}

export function Surface({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-3xl border border-border bg-card", className)} {...rest} />;
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-1.5">
      {eyebrow && <p className="font-display text-[0.7rem] font-bold tracking-[0.2em] text-primary uppercase">{eyebrow}</p>}
      <h1 className="font-display text-[clamp(1.6rem,6vw,2.1rem)] leading-[1.05] font-extrabold tracking-tight">{title}</h1>
      {children && <p className="text-sm text-muted-foreground">{children}</p>}
    </header>
  );
}

export function SourceNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 text-[0.72rem] leading-snug text-muted-foreground">
      <Info className="mt-px size-3.5 shrink-0 opacity-70" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">{icon}</span>
      <p className="font-display text-lg font-bold">{title}</p>
      {children && <p className="max-w-xs text-sm text-muted-foreground">{children}</p>}
      {action}
    </div>
  );
}
