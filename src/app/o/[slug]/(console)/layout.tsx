import { ConsoleTheme } from "@/components/app/console-theme";
import { DemoBar } from "@/components/demo/demo-bar";
import { getOrgContext, requireUser } from "@/lib/dal";
import { getDemoEventLinks } from "@/lib/demo";
import { isDemoMode } from "@/lib/demo-mode";

/** Console sombre pour le Studio Show et la Régie Live (utilisés en salle, dans la pénombre). */
export default async function ConsoleLayout({ children, params }: LayoutProps<"/o/[slug]">) {
  await requireUser();
  const { slug } = await params;
  const ctx = isDemoMode() ? await getOrgContext(slug) : null;
  const demoLinks = ctx?.org.isDemo ? await getDemoEventLinks(ctx.org.id) : null;
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <ConsoleTheme />
      {ctx?.org.isDemo && <DemoBar links={demoLinks} />}
      {children}
    </div>
  );
}
