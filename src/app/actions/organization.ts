"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AccessError, assertOrgAccess, requireSuperAdmin } from "@/lib/dal";
import { createUserWithPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { generateTempPassword } from "@/lib/tokens";
import { defaultPeriodEnd } from "@/lib/billing";
import { CURRENCIES, LOCALES, PLAN_CATALOG, PLAN_TYPES } from "@/lib/constants";
import { planInputSchema, slugify, slugSchema } from "@/lib/validation";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; field?: string };

function fail(error: unknown): { ok: false; error: string; field?: string } {
  if (error instanceof AccessError) return { ok: false, error: "ACCESS" };
  if (error instanceof z.ZodError) return { ok: false, error: "INVALID", field: String(error.issues[0]?.path[0] ?? "") };
  console.error("[organization]", error);
  return { ok: false, error: "SERVER" };
}

const orgSettingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  country: z.enum(["FR", "IL", "OTHER"]),
  defaultCurrency: z.enum(CURRENCIES),
  defaultLocale: z.enum(LOCALES),
});

/** Paramètres de l'association (administrateur). */
export async function updateOrgSettingsAction(organizationId: string, input: z.input<typeof orgSettingsSchema>): Promise<Result> {
  try {
    const { user, org } = await assertOrgAccess(organizationId, "org.settings");
    const data = orgSettingsSchema.parse(input);
    await prisma.organization.update({ where: { id: organizationId }, data });
    await audit(prisma, { organizationId, actorId: user.id, action: "org.settings", entityType: "Organization", entityId: organizationId });
    revalidatePath(`/o/${org.slug}`, "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setOrgLogoAction(organizationId: string, logoUrl: string | null): Promise<Result> {
  try {
    const { org } = await assertOrgAccess(organizationId, "org.settings");
    if (logoUrl && !/^\/api\/media\/[a-z0-9]+$/i.test(logoUrl)) return { ok: false, error: "INVALID" };
    await prisma.organization.update({ where: { id: organizationId }, data: { logoUrl } });
    revalidatePath(`/o/${org.slug}`, "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* ─── Super Admin ─────────────────────────────────────────────────────── */

const newOrgSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema,
  country: z.enum(["FR", "IL", "OTHER"]),
  defaultCurrency: z.enum(CURRENCIES),
  defaultLocale: z.enum(LOCALES),
  plan: z.enum(PLAN_TYPES),
  adminName: z.string().trim().min(2).max(80),
  adminEmail: z.string().trim().toLowerCase().email().max(160),
});

export async function createOrganizationAction(
  input: z.input<typeof newOrgSchema>,
): Promise<Result<{ slug: string; id: string; adminEmail: string; tempPassword: string | null }>> {
  try {
    const superAdmin = await requireSuperAdmin();
    const data = newOrgSchema.parse({ ...input, slug: input.slug || slugify(String(input.name ?? "")) });
    if (await prisma.organization.findUnique({ where: { slug: data.slug } })) return { ok: false, error: "SLUG_TAKEN", field: "slug" };
    const tempPassword = generateTempPassword();
    const { user: admin, created } = await createUserWithPassword({ name: data.adminName, email: data.adminEmail, password: tempPassword });
    const org = await prisma.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
        country: data.country,
        defaultCurrency: data.defaultCurrency,
        defaultLocale: data.defaultLocale,
        subscription: {
          create: {
            plan: data.plan,
            eventCredits: PLAN_CATALOG[data.plan].credits,
            currentPeriodEnd: defaultPeriodEnd(data.plan),
          },
        },
        memberships: { create: { userId: admin.id, role: "ORG_ADMIN" } },
      },
      select: { id: true, slug: true },
    });
    await audit(prisma, { organizationId: org.id, actorId: superAdmin.id, action: "org.create", entityType: "Organization", entityId: org.id });
    revalidatePath("/admin");
    return { ok: true, id: org.id, slug: org.slug, adminEmail: data.adminEmail, tempPassword: created ? tempPassword : null };
  } catch (error) {
    return fail(error);
  }
}

export async function updateSubscriptionAction(organizationId: string, input: Record<string, unknown>): Promise<Result> {
  try {
    const superAdmin = await requireSuperAdmin();
    const data = planInputSchema.parse(input);
    await prisma.subscription.upsert({
      where: { organizationId },
      create: { organizationId, ...data, notes: data.notes ?? null },
      update: { ...data, notes: data.notes ?? null },
    });
    await audit(prisma, { organizationId, actorId: superAdmin.id, action: "subscription.update", entityType: "Subscription", metadata: { plan: data.plan, status: data.status, credits: data.eventCredits } });
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setOrgStatusAction(organizationId: string, status: "ACTIVE" | "SUSPENDED"): Promise<Result> {
  try {
    const superAdmin = await requireSuperAdmin();
    await prisma.organization.update({ where: { id: organizationId }, data: { status } });
    await audit(prisma, { organizationId, actorId: superAdmin.id, action: `org.${status.toLowerCase()}`, entityType: "Organization", entityId: organizationId });
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteOrganizationAction(organizationId: string): Promise<Result> {
  try {
    await requireSuperAdmin();
    await prisma.organization.delete({ where: { id: organizationId } });
  } catch (error) {
    return fail(error);
  }
  revalidatePath("/admin", "layout");
  redirect("/admin");
}
