# Show Events

MVP SaaS de fundraising live pour associations, galas et institutions.

Le produit permet de creer un evenement, afficher un show grand ecran, saisir des promesses de dons depuis une regie, recevoir des promesses via formulaire mobile avec QR code, et personnaliser le rendu visuel du show.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- Better Auth pour l'authentification
- Prisma 7 + PostgreSQL pour Neon
- Architecture cible Option B: Vercel + Neon + Ably
- Mode demo local synchronise par `localStorage` + `BroadcastChannel`

## Parcours MVP

- Dashboard SaaS multi-associations: `/`
- Regie live: `/events/evt-gala-2026/regie`
- Studio show: `/events/evt-gala-2026/studio`
- Ecran grand format: `/show/evt-gala-2026`
- Formulaire mobile: `/donate/gala-lev-2026`

Le formulaire mobile est sans compte et sans PIN: toute personne qui possede le lien prive peut envoyer une promesse.

## Environnement

Copier `.env.example` vers `.env.local` ou `.env`, puis renseigner:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=change-me
DATABASE_URL=postgresql://...
```

Sur Vercel, Better Auth utilise `BETTER_AUTH_URL` si defini, sinon `NEXT_PUBLIC_APP_URL`, sinon le domaine automatique `VERCEL_URL` en HTTPS. Cela permet de tester l'auth sur le domaine Vercel attribue avant le domaine final.

## Commandes

```bash
npm install
npm run dev
npm run lint
npm run build
npm run prisma:generate
```

Pour appliquer le schema a Neon:

```bash
npm run prisma:migrate -- --name init_show_events
```

Le MVP actuel reste testable sans migration grace au mode demo local. Le schema Prisma contient les tables Better Auth (`user`, `session`, `account`, `verification`) et les tables metier (`Organization`, `Membership`, `Event`, `Donation`, `ShowLayout`, `AuditLog`).

## Decisions produit integrees

- Promesses de dons, pas paiement obligatoire dans le MVP.
- Formulaire mobile par lien/QR code, sans compte et sans PIN.
- Affichage immediat configurable ou validation admin.
- Total public incluant les promesses selon le reglage evenement.
- Roles prevus: super admin, admin association, operateur evenement.
- Devises: EUR, ILS, USD.
- Langues du show: francais et hebreu avec direction RTL.
- Studio visuel avec themes et blocs activables.
- Show navigateur plein ecran pour videoprojecteur ou mur LED.

## Prochain branchement prod

1. Creer le projet Neon et renseigner `DATABASE_URL`.
2. Deployer sur Vercel avec `BETTER_AUTH_SECRET`.
3. Lancer la migration Prisma.
4. Brancher Ably pour remplacer la synchro locale par des canaux temps reel.
5. Ajouter upload logo via stockage S3 compatible.
