import { ConsoleTheme } from "@/components/app/console-theme";
import { requireUser } from "@/lib/dal";

/** Console sombre pour le Studio Show et la Régie Live (utilisés en salle, dans la pénombre). */
export default async function ConsoleLayout({ children }: LayoutProps<"/o/[slug]">) {
  await requireUser();
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <ConsoleTheme />
      {children}
    </div>
  );
}
