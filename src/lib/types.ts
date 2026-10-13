export type Currency = "EUR" | "ILS" | "USD";

export type DonationStatus = "pending" | "approved" | "rejected" | "cancelled" | "paid";

export type DonationSource = "manual" | "mobile" | "quick" | "seed";

export type UserRole = "super_admin" | "org_admin" | "operator";

export type ThemeId = "gala" | "israel" | "light";

export type ShowBlockId = "logo" | "total" | "goal" | "donations" | "ticker" | "qr";

export type Organization = {
  id: string;
  name: string;
  country: "FR" | "IL";
  logoText: string;
  accent: string;
};

export type FundraisingEvent = {
  id: string;
  organizationId: string;
  name: string;
  location: string;
  startsAt: string;
  currency: Currency;
  goal: number;
  status: "draft" | "live" | "paused" | "closed";
  publicSlug: string;
  pin: string;
  approvalMode: "instant" | "manual";
  totalIncludesPending: boolean;
};

export type Donation = {
  id: string;
  eventId: string;
  donorName: string;
  amount: number;
  currency: Currency;
  message?: string;
  status: DonationStatus;
  source: DonationSource;
  isPledge: boolean;
  isTest: boolean;
  createdAt: string;
};

export type ShowBlock = {
  id: ShowBlockId;
  label: string;
  visible: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ShowLayout = {
  eventId: string;
  theme: ThemeId;
  locale: "fr" | "he";
  direction: "ltr" | "rtl";
  animation: "elegant" | "tv" | "minimal";
  title: string;
  subtitle: string;
  blocks: ShowBlock[];
};

export type TeamMember = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
};
