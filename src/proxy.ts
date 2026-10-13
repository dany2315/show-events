import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Vérification optimiste : redirige vers la connexion si aucun cookie de session.
 * L'autorisation réelle est faite côté serveur (Data Access Layer) sur chaque page et API.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/o/:path*", "/admin/:path*", "/account/:path*"],
};
