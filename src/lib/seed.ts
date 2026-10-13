import type { Donation, FundraisingEvent, Organization, ShowLayout, TeamMember } from "@/lib/types";

export const organizations: Organization[] = [
  {
    id: "org-lev",
    name: "Association Lev",
    country: "FR",
    logoText: "LEV",
    accent: "#d7a936",
  },
  {
    id: "org-or",
    name: "Or Israel",
    country: "IL",
    logoText: "OR",
    accent: "#138a8a",
  },
];

export const events: FundraisingEvent[] = [
  {
    id: "evt-gala-2026",
    organizationId: "org-lev",
    name: "Soiree de solidarite 2026",
    location: "Paris",
    startsAt: "2026-11-18T19:30:00.000Z",
    currency: "EUR",
    goal: 200000,
    status: "live",
    publicSlug: "gala-lev-2026",
    pin: "2486",
    approvalMode: "instant",
    totalIncludesPending: true,
  },
  {
    id: "evt-jerusalem",
    organizationId: "org-or",
    name: "Jerusalem Education Night",
    location: "Jerusalem",
    startsAt: "2026-12-03T18:00:00.000Z",
    currency: "ILS",
    goal: 500000,
    status: "draft",
    publicSlug: "or-education-night",
    pin: "6130",
    approvalMode: "instant",
    totalIncludesPending: true,
  },
];

export const donations: Donation[] = [
  {
    id: "don-1",
    eventId: "evt-gala-2026",
    donorName: "Famille Cohen",
    amount: 5000,
    currency: "EUR",
    message: "Avec tout notre coeur.",
    status: "approved",
    source: "seed",
    isPledge: true,
    isTest: false,
    createdAt: "2026-10-12T17:12:00.000Z",
  },
  {
    id: "don-2",
    eventId: "evt-gala-2026",
    donorName: "Sarah B.",
    amount: 1800,
    currency: "EUR",
    message: "Bravo pour cette action.",
    status: "approved",
    source: "mobile",
    isPledge: true,
    isTest: false,
    createdAt: "2026-10-12T17:18:00.000Z",
  },
  {
    id: "don-3",
    eventId: "evt-gala-2026",
    donorName: "Donateur anonyme",
    amount: 10000,
    currency: "EUR",
    status: "approved",
    source: "manual",
    isPledge: true,
    isTest: false,
    createdAt: "2026-10-12T17:28:00.000Z",
  },
  {
    id: "don-4",
    eventId: "evt-gala-2026",
    donorName: "Table 12",
    amount: 2600,
    currency: "EUR",
    message: "Pour les enfants.",
    status: "pending",
    source: "quick",
    isPledge: true,
    isTest: true,
    createdAt: "2026-10-12T17:35:00.000Z",
  },
];

export const layouts: ShowLayout[] = [
  {
    eventId: "evt-gala-2026",
    theme: "gala",
    locale: "fr",
    direction: "ltr",
    animation: "tv",
    title: "Soiree de solidarite 2026",
    subtitle: "Chaque promesse compte",
    blocks: [
      { id: "logo", label: "Logo", visible: true, x: 6, y: 7, w: 16, h: 13 },
      { id: "total", label: "Total", visible: true, x: 30, y: 15, w: 42, h: 24 },
      { id: "goal", label: "Objectif", visible: true, x: 76, y: 15, w: 18, h: 24 },
      { id: "donations", label: "Dernieres promesses", visible: true, x: 8, y: 52, w: 50, h: 34 },
      { id: "qr", label: "QR code", visible: true, x: 74, y: 55, w: 18, h: 26 },
      { id: "ticker", label: "Bandeau", visible: true, x: 0, y: 90, w: 100, h: 10 },
    ],
  },
];

export const team: TeamMember[] = [
  {
    id: "usr-1",
    organizationId: "org-lev",
    name: "David",
    email: "super@show-events.local",
    role: "super_admin",
  },
  {
    id: "usr-2",
    organizationId: "org-lev",
    name: "Rivka Amar",
    email: "admin@association.local",
    role: "org_admin",
  },
  {
    id: "usr-3",
    organizationId: "org-lev",
    name: "Avi Cohen",
    email: "regie@association.local",
    role: "operator",
  },
];
