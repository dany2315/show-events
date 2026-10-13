import { errorResponse } from "@/lib/api";
import { assertEventAccess } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/validation";

function csvCell(value: string | number) {
  const s = String(value);
  // Neutralise les formules (injection CSV) et échappe les guillemets.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Export des promesses (administrateurs de l'association). */
export async function GET(_request: Request, ctx: RouteContext<"/api/events/[eventId]/export">) {
  try {
    const { eventId } = await ctx.params;
    const { event } = await assertEventAccess(eventId, "event.manage");
    const rows = await prisma.donation.findMany({
      where: { eventId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        donorName: true,
        amount: true,
        currency: true,
        isFictitious: true,
        isTest: true,
        source: true,
        createdBy: { select: { name: true } },
      },
    });
    const header = ["Date", "Donateur", "Montant", "Devise", "Type", "Source", "Saisi par"];
    const lines = rows.map((r) =>
      [
        r.createdAt.toISOString(),
        r.donorName,
        r.amount,
        r.currency,
        r.isTest ? "Test" : r.isFictitious ? "Fictif" : "Réel",
        r.source === "MOBILE" ? "Mobile" : "Régie",
        r.createdBy?.name ?? "",
      ]
        .map(csvCell)
        .join(";"),
    );
    const body = "﻿" + [header.join(";"), ...lines].join("\r\n");
    const filename = `promesses-${slugify(event.name) || "evenement"}.csv`;
    return new Response(body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
