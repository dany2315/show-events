"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AccessError, assertOrgAccess, getCurrentUser } from "@/lib/dal";
import { createUserWithPassword, setUserPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { generateTempPassword } from "@/lib/tokens";
import { memberInputSchema } from "@/lib/validation";
import { MEMBER_ROLES } from "@/lib/constants";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof AccessError) return { ok: false, error: "ACCESS" };
  if (error instanceof z.ZodError) return { ok: false, error: "INVALID" };
  console.error("[team]", error);
  return { ok: false, error: "SERVER" };
}

export async function addMemberAction(
  organizationId: string,
  input: { name: string; email: string; role: string },
): Promise<Result<{ email: string; tempPassword: string | null }>> {
  try {
    const { user, org } = await assertOrgAccess(organizationId, "org.team");
    // Espace de démo : aucun compte créé (ni identifiants, ni e-mail).
    if (org.isDemo) return { ok: false, error: "DEMO" };
    const data = memberInputSchema.parse(input);
    const tempPassword = generateTempPassword();
    const { user: member, created } = await createUserWithPassword({ name: data.name, email: data.email, password: tempPassword });
    const existing = await prisma.membership.findUnique({ where: { userId_organizationId: { userId: member.id, organizationId } } });
    if (existing) return { ok: false, error: "ALREADY_MEMBER" };
    await prisma.membership.create({ data: { userId: member.id, organizationId, role: data.role } });
    await audit(prisma, { organizationId, actorId: user.id, action: "member.add", entityType: "User", entityId: member.id, metadata: { role: data.role } });
    revalidatePath(`/o/${org.slug}/team`);
    return { ok: true, email: data.email, tempPassword: created ? tempPassword : null };
  } catch (error) {
    return fail(error);
  }
}

async function loadMembership(membershipId: string) {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: { id: true, role: true, userId: true, organizationId: true, user: { select: { role: true, name: true } } },
  });
  if (!membership) throw new AccessError(404, "Membre introuvable");
  return membership;
}

async function adminCount(organizationId: string) {
  return prisma.membership.count({ where: { organizationId, role: "ORG_ADMIN" } });
}

export async function updateMemberRoleAction(membershipId: string, role: string): Promise<Result> {
  try {
    const membership = await loadMembership(membershipId);
    const { user, org } = await assertOrgAccess(membership.organizationId, "org.team");
    const newRole = z.enum(MEMBER_ROLES).parse(role);
    if (membership.role === "ORG_ADMIN" && newRole !== "ORG_ADMIN" && (await adminCount(membership.organizationId)) <= 1) {
      return { ok: false, error: "LAST_ADMIN" };
    }
    await prisma.membership.update({ where: { id: membershipId }, data: { role: newRole } });
    await audit(prisma, { organizationId: org.id, actorId: user.id, action: "member.role", entityType: "User", entityId: membership.userId, metadata: { role: newRole } });
    revalidatePath(`/o/${org.slug}/team`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function removeMemberAction(membershipId: string): Promise<Result> {
  try {
    const membership = await loadMembership(membershipId);
    const { user, org } = await assertOrgAccess(membership.organizationId, "org.team");
    if (membership.role === "ORG_ADMIN" && (await adminCount(membership.organizationId)) <= 1) {
      return { ok: false, error: "LAST_ADMIN" };
    }
    await prisma.membership.delete({ where: { id: membershipId } });
    // Ses sessions sont révoquées s'il n'appartient plus à aucune association.
    const remaining = await prisma.membership.count({ where: { userId: membership.userId } });
    if (remaining === 0 && membership.user.role !== "SUPER_ADMIN") {
      await prisma.session.deleteMany({ where: { userId: membership.userId } });
    }
    await audit(prisma, { organizationId: org.id, actorId: user.id, action: "member.remove", entityType: "User", entityId: membership.userId });
    revalidatePath(`/o/${org.slug}/team`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Réinitialise le mot de passe d'un membre. Par sécurité, impossible pour un compte
 * Super Admin ou rattaché à d'autres associations (sauf par le Super Admin).
 */
export async function resetMemberPasswordAction(membershipId: string): Promise<Result<{ tempPassword: string }>> {
  try {
    const membership = await loadMembership(membershipId);
    const { user, org } = await assertOrgAccess(membership.organizationId, "org.team");
    if (org.isDemo) return { ok: false, error: "DEMO" };
    const otherOrgs = await prisma.membership.count({ where: { userId: membership.userId, organizationId: { not: membership.organizationId } } });
    if (user.platformRole !== "SUPER_ADMIN" && (membership.user.role === "SUPER_ADMIN" || otherOrgs > 0)) {
      return { ok: false, error: "ACCESS" };
    }
    const tempPassword = generateTempPassword();
    await setUserPassword(membership.userId, tempPassword);
    await prisma.session.deleteMany({ where: { userId: membership.userId } });
    await audit(prisma, { organizationId: org.id, actorId: user.id, action: "member.passwordReset", entityType: "User", entityId: membership.userId });
    return { ok: true, tempPassword };
  } catch (error) {
    return fail(error);
  }
}

export async function updateProfileAction(name: string): Promise<Result> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "ACCESS" };
    const clean = z.string().trim().min(2).max(80).parse(name);
    await prisma.user.update({ where: { id: user.id }, data: { name: clean } });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
