import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { can, type Actor, type Capability } from "./permissions";
import type { MemberRoleCode } from "./constants";

/**
 * Data Access Layer : toutes les vérifications d'autorisation passent par ici,
 * indépendamment de ce que l'interface affiche (cahier des charges §6).
 */

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  platformRole: "SUPER_ADMIN" | "USER";
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const role = (session.user as { role?: string }).role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER";
  return { id: session.user.id, name: session.user.name, email: session.user.email, platformRole: role };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireSuperAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.platformRole !== "SUPER_ADMIN") redirect("/app");
  return user;
}

export type OrgContext = {
  user: CurrentUser;
  org: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    status: "ACTIVE" | "SUSPENDED";
    defaultCurrency: "EUR" | "ILS" | "USD";
    defaultLocale: "fr" | "he";
    country: string;
    /** Espace de démonstration (mode démo) : limites spécifiques, bandeau « Démo ». */
    isDemo: boolean;
  };
  memberRole: MemberRoleCode | null;
  actor: Actor;
  can: (capability: Capability) => boolean;
};

/** Contexte d'une association pour l'utilisateur courant, ou null s'il n'y a pas accès. */
export const getOrgContext = cache(async (slug: string): Promise<OrgContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      status: true,
      defaultCurrency: true,
      defaultLocale: true,
      country: true,
      isDemo: true,
      memberships: { where: { userId: user.id }, select: { role: true } },
    },
  });
  if (!org) return null;
  const memberRole = org.memberships[0]?.role ?? null;
  if (!memberRole && user.platformRole !== "SUPER_ADMIN") return null;
  const actor: Actor = { platformRole: user.platformRole, memberRole };
  const { memberships: _m, ...orgData } = org;
  void _m;
  return { user, org: orgData, memberRole, actor, can: (c) => can(actor, c) };
});

/** Exige l'accès à l'association et une capacité ; redirige sinon (pages). */
export async function requireOrg(slug: string, capability: Capability = "event.regie"): Promise<OrgContext> {
  const user = await requireUser();
  const ctx = await getOrgContext(slug);
  if (!ctx) notFound();
  if (!ctx.can(capability)) {
    // Un Utilisateur Show qui tente d'ouvrir une page de gestion est renvoyé vers ses modules.
    redirect(`/o/${slug}`);
  }
  void user;
  return ctx;
}

export class AccessError extends Error {
  constructor(
    public status: 401 | 403 | 404,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Vérifie l'accès à un événement pour une API / Server Action.
 * Lève AccessError (401/403/404) plutôt que de rediriger.
 */
export async function assertEventAccess(eventId: string, capability: Capability) {
  const user = await getCurrentUser();
  if (!user) throw new AccessError(401, "Non authentifié");
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      currency: true,
      locale: true,
      status: true,
      organization: {
        select: { slug: true, status: true, isDemo: true, memberships: { where: { userId: user.id }, select: { role: true } } },
      },
    },
  });
  if (!event) throw new AccessError(404, "Événement introuvable");
  const memberRole = event.organization.memberships[0]?.role ?? null;
  const actor: Actor = { platformRole: user.platformRole, memberRole };
  if (!memberRole && user.platformRole !== "SUPER_ADMIN") throw new AccessError(404, "Événement introuvable");
  if (!can(actor, capability)) throw new AccessError(403, "Accès refusé");
  if (event.organization.status === "SUSPENDED" && user.platformRole !== "SUPER_ADMIN") {
    throw new AccessError(403, "Association suspendue");
  }
  return { user, event, actor };
}

/** Vérifie l'accès à une association pour une Server Action. */
export async function assertOrgAccess(organizationId: string, capability: Capability) {
  const user = await getCurrentUser();
  if (!user) throw new AccessError(401, "Non authentifié");
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, slug: true, status: true, isDemo: true, memberships: { where: { userId: user.id }, select: { role: true } } },
  });
  if (!org) throw new AccessError(404, "Association introuvable");
  const memberRole = org.memberships[0]?.role ?? null;
  const actor: Actor = { platformRole: user.platformRole, memberRole };
  if (!memberRole && user.platformRole !== "SUPER_ADMIN") throw new AccessError(404, "Association introuvable");
  if (!can(actor, capability)) throw new AccessError(403, "Accès refusé");
  return { user, org, actor };
}

/** Associations accessibles par l'utilisateur (pour la redirection après connexion). */
export async function listUserOrganizations(userId: string) {
  return prisma.membership.findMany({
    where: { userId },
    select: { role: true, organization: { select: { id: true, name: true, slug: true, logoUrl: true, status: true } } },
    orderBy: { createdAt: "asc" },
  });
}
