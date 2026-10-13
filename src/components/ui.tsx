import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const variants = {
  primary: "bg-neutral-950 text-white hover:bg-neutral-800 border-neutral-950",
  secondary: "bg-white text-neutral-950 hover:bg-neutral-50 border-[#ded5c1]",
  ghost: "bg-transparent text-neutral-700 hover:bg-black/[0.04] border-transparent",
  danger: "bg-[#e65f46] text-white hover:bg-[#cf4e37] border-[#e65f46]",
};

export function Button({ className = "", variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: ButtonProps["variant"];
};

export function LinkButton({ className = "", variant = "primary", ...props }: LinkButtonProps) {
  return (
    <Link
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition ${variants[variant ?? "primary"]} ${className}`}
      {...props}
    />
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "gold" | "teal" | "red" }) {
  const tones = {
    neutral: "border-neutral-200 bg-white text-neutral-700",
    gold: "border-[#ead9a3] bg-[#fff7d7] text-[#765900]",
    teal: "border-[#a9d7d3] bg-[#e8fbf8] text-[#126263]",
    red: "border-[#f0c0b5] bg-[#fff0ec] text-[#9d2f1b]",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-[#e7dfcf] bg-white/82 shadow-sm ${className}`}>{children}</section>;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-neutral-800">
      {label}
      {children}
      {hint ? <span className="text-xs font-normal text-neutral-500">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-md border border-[#ded5c1] bg-white px-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[#d7a936] focus:ring-4 focus:ring-[#d7a936]/15";

export const textareaClass =
  "min-h-24 w-full rounded-md border border-[#ded5c1] bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-[#d7a936] focus:ring-4 focus:ring-[#d7a936]/15";
