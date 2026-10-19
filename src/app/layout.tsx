import type { Metadata, Viewport } from "next";
import { Frank_Ruhl_Libre, Playfair_Display, Rubik } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DirectionProvider } from "@/components/ui/direction";
import { I18nProvider } from "@/i18n/client";
import { getI18n } from "@/i18n/server";
import { getAppUrl } from "@/lib/app-url";
import { BRAND_COLORS } from "@/lib/constants";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin", "hebrew"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const frankRuhl = Frank_Ruhl_Libre({
  variable: "--font-frank",
  subsets: ["latin", "hebrew"],
  display: "swap",
});

// Icônes, manifeste et images de partage : conventions de fichiers de `src/app`
// (favicon.ico, icon.svg, apple-icon.png, manifest.ts, opengraph-image.png, twitter-image.png).
export async function generateMetadata(): Promise<Metadata> {
  const [{ t, locale }, appUrl] = await Promise.all([getI18n(), getAppUrl()]);
  return {
    metadataBase: new URL(appUrl),
    title: { default: t.meta.title, template: `%s · ${t.common.appName}` },
    description: t.meta.description,
    applicationName: t.common.appName,
    appleWebApp: { title: t.common.appName },
    openGraph: {
      type: "website",
      siteName: t.common.appName,
      title: t.meta.title,
      description: t.meta.description,
      locale: locale === "he" ? "he_IL" : "fr_FR",
    },
    twitter: { card: "summary_large_image", title: t.meta.title, description: t.meta.description },
  };
}

export const viewport: Viewport = {
  themeColor: BRAND_COLORS.nuit,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale, dir } = await getI18n();
  return (
    <html
      lang={locale}
      dir={dir}
      className={`${rubik.variable} ${playfair.variable} ${frankRuhl.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <I18nProvider locale={locale}>
          <DirectionProvider dir={dir}>
            <TooltipProvider delayDuration={200}>
              {children}
              <Toaster position={dir === "rtl" ? "bottom-left" : "bottom-right"} richColors closeButton />
            </TooltipProvider>
          </DirectionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
