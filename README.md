# Fundraising Live

Plateforme SaaS de levée de fonds en direct : les promesses de dons d'un gala s'affichent en temps réel sur grand écran (logo, total, objectif, donateurs, animations), saisies depuis une **Régie Live** ou par les participants via un **formulaire mobile / QR code**. Multi-associations, français et hébreu (RTL), EUR · ILS · USD.

Ce dépôt implémente le **cahier des charges MVP 1.0** tel que défini (hébergement **Option B : Vercel + Neon + Ably**).

---

## Fonctionnalités (périmètre MVP)

| Cahier des charges | Implémentation |
| --- | --- |
| Plateforme multi-associations | Chaque association a son espace `/o/[slug]` ; toute requête serveur vérifie l'appartenance (Data Access Layer `src/lib/dal.ts`). |
| Super Admin | `/admin` : création d'associations (+ premier administrateur), forfaits, crédits, suspension, accès à tous les espaces. |
| Administrateur d'association | Tableau de bord, événements, équipe, modèles, paramètres, Studio, Régie, écran. |
| Utilisateur Show (`SHOW_OPERATOR`) | Voit uniquement « Mes événements » → Studio Show, Régie Live, Écran géant. Aucune page ni API de gestion. |
| Création d'événements | Nom, date, objectif, devise, langue, style de départ ou modèle. Lien de diffusion, régie et formulaire créés automatiquement. |
| Saisie manuelle | Régie : nom, montant, montants rapides (€/$ : 100·500·1 000·5 000 — ₪ : 180·360·1 800·3 600), case « Don fictif » décochée par défaut. |
| Formulaire mobile | `/d/[jeton]` : nom + montant, sans compte, sans PIN, sans validation ; affiché immédiatement. Anti-robot (champ piège), limite de 5 promesses/min **par téléphone** (cookie anonyme) et plafond anti-inondation de 600/min par IP : des centaines d'invités sur le même Wi-Fi de salle ne se bloquent pas entre eux. |
| Dons fictifs | Identifiés uniquement côté administration ; affichés et **comptés dans le total** comme les dons réels. Sous-totaux réels / fictifs en interne. |
| Total du show | Somme de toutes les promesses (réelles + fictives), sans validation préalable. |
| Régie Live | Total, dernières promesses, ajout, correction, suppression (historisées), célébration, animation objectif, pause des animations, message à l'écran, aperçu en direct. Ordinateur et mobile. |
| Studio Show | Éditeur visuel 1920×1080 (coordonnées proportionnelles) : déplacement / redimensionnement (react-rnd), calques (dnd-kit), visibilité, couleurs, logo, 5 styles, animations, textes, annuler/rétablir, magnétisme, raccourcis clavier, simulation de don, modèles réutilisables. **Fond d'écran** image, GIF ou vidéo ; **bloc vidéo** (MP4/WebM importé, lien direct, YouTube, Vimeo) ; **mise en page intelligente** (disposition automatique selon les blocs affichés, 5 mises en page, miroir automatique pour l'hébreu, détection et correction des chevauchements) ; liste des dons sur 1 ou 2 colonnes. |
| Écran géant | `/screen/[jeton]` : plein écran, Full HD et 4K, synchronisation temps réel, reconnexion automatique sans perte du total, anti-veille. |
| Devises et langues | EUR, ILS, USD ; interfaces FR / HE avec RTL complet. |
| Commercialisation | Paiement par événement (crédits) ou abonnement (mensuel / annuel), gérés par le Super Admin. Le crédit est consommé au **passage en direct** ; créer et tester un événement est gratuit. Pas de paiement en ligne des dons. |

Hors périmètre MVP (non inclus) : paiement en ligne des dons, application native, designs différents par écran.

## Cycle de vie d'un événement

```
En préparation ──► Mode test ──► En direct ──► Terminé (définitif)
      ▲   ◄──────────┘   │
      └──────────────────┘ (passage en direct possible depuis la préparation ou le test)
```

| Statut | Promesses | Crédit | Écran géant |
| --- | --- | --- | --- |
| **En préparation** | refusées (formulaire : « collecte pas encore ouverte ») | — | badge « Aperçu » |
| **Mode test** | acceptées, marquées *test* | aucun | badge « MODE TEST » |
| **En direct** | acceptées | **1 crédit consommé** (sauf abonnement), une seule fois par événement | show normal |
| **Terminé** | refusées | — | dernier état affiché |

- **Passer en direct** (fiche événement ou Régie) : confirmation indiquant le crédit utilisé ; les promesses de test sont **effacées** pour que le gala démarre à zéro.
- **Terminer la collecte** : confirmation, puis action **définitive** (plus de relance possible). Seul le Super Admin peut rouvrir, pour le support, sans nouveau crédit.
- Un direct ne peut pas revenir en préparation ni en test, ce qui empêche de réutiliser un crédit.

## Architecture

```
Navigateurs (admin, régie, mobile, écrans)
        │ HTTPS
Vercel — Next.js 16 (App Router)  ── Better Auth (sessions)
        │                                   │
        ├── Neon PostgreSQL (Prisma 7) ◄────┘   promesses, événements, outbox
        └── Ably (optionnel)                    diffusion WebSocket
```

**Chemin d'une promesse** (`src/lib/donations.ts`) — un seul ordre SQL atomique :
1. verrou de ligne sur l'événement + incrément des compteurs du direct (total, nombre) ;
2. insertion de la promesse (clé d'idempotence unique : un double clic ne crée jamais deux promesses) ;
3. insertion d'un message dans l'**outbox** (séquence ordonnée).

Puis publication sur Ably (si configuré). Les écrans **ne dépendent jamais uniquement du WebSocket** : ils comblent les trous de séquence via HTTP, se resynchronisent à la reconnexion et toutes les 2 minutes. Sans clé Ably, la synchronisation HTTP (~1,5 s) prend le relais automatiquement.

**Moteur du show** (`src/components/show/`) : *Layout Engine* (`stage.tsx`, `viewport.tsx`), *Animation Engine* (GSAP, confettis, mise en lumière, paliers 25/50/75/100 %), *Live State Engine* (`use-live-event.ts`).

## Démarrage

Prérequis : Node 20.19+ (testé avec Node 24), une base Neon.

```bash
npm install                # génère aussi le client Prisma
cp .env.example .env       # puis renseigner les variables
npm run db:deploy          # applique les migrations
npm run db:seed            # Super Admin + 2 associations de démonstration
npm run dev
```

Comptes créés par le seed (mots de passe : variables `SEED_*` du `.env`) :
- Super Admin : `SEED_SUPER_ADMIN_EMAIL`
- Démo France : `admin@espoir.test` (administrateur), `regie@espoir.test` (Utilisateur Show)
- Démo Israël (hébreu, ₪) : `admin@unis.test`

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` / `build` / `start` | Développement, build de production, serveur |
| `npm run typecheck` · `npm run lint` | TypeScript strict · ESLint (React Compiler) |
| `npm test` | Tests unitaires (Vitest) : montants, droits, forfaits, configuration du show, traductions, validation, jetons |
| `npm run test:e2e` | Tests de bout en bout (Playwright) sur une association de test isolée (`e2e-*`), nettoyée automatiquement. Nécessite `npm run build` au préalable et `npx playwright install chromium`. |
| `npm run db:migrate` · `db:deploy` · `db:seed` · `db:studio` | Base de données |

Les tests de bout en bout couvrent : régie (réel + fictif, total public), formulaire mobile → écran en temps réel, correction / suppression, message à l'écran, Studio → diffusion du design, export CSV, Utilisateur Show à accès limité, isolation entre associations, Super Admin (création, crédits, suspension), idempotence, anti-robot, limite de débit, collecte terminée, charge (3 galas × 20 promesses simultanées, sans perte ni doublon, totaux ordonnés), pages publiques FR/HE.

## Déploiement (Option B : Vercel + Neon + Ably)

1. Importer le dépôt dans Vercel et renseigner les variables de `.env.example`.
2. `vercel.json` exécute `prisma migrate deploy` avant chaque build, via une connexion **directe** à Neon (`DIRECT_URL`, ou `DATABASE_URL` sans `-pooler`) : les migrations ne passent jamais par le pooler.
3. **Région** : les fonctions doivent être proches de la base. `vercel.json` cible `cle1` (Cleveland) pour la base Neon actuelle (`us-east-2`). Pour la France et Israël, il est recommandé de créer la base de production Neon en `eu-central-1` (Francfort) et de passer la région Vercel à `fra1`.
4. Ably : créer une clé (publish + subscribe) et la renseigner dans `ABLY_API_KEY`.

### Précautions d'exploitation (gala)
- **Ne pas redéployer pendant un gala** : déployer la veille, puis geler.
- Vérifier `GET /api/health` (base de données + mode temps réel) avant l'ouverture des portes.
- Tester le show sur l'écran réel (Full HD / 4K) et la régie sur le téléphone de l'opérateur ; utiliser les dons fictifs pour la répétition, puis les supprimer.
- Un lien (QR code ou écran) compromis peut être régénéré depuis la fiche de l'événement.

## Sécurité
- Aucune inscription publique : comptes créés par le Super Admin ou l'administrateur de l'association ; mots de passe provisoires affichés une seule fois.
- Connexion protégée contre la force brute : 30 tentatives/min par IP (`AUTH_SIGNIN_RATE_LIMIT`). Ne concerne que les comptes (équipe) : les donateurs ne se connectent jamais.
- Autorisation vérifiée côté serveur sur chaque page, Server Action et API (matrice `src/lib/permissions.ts`).
- Liens publics non devinables, stockés uniquement sous forme d'empreinte (SHA-256), régénérables.
- Le public ne reçoit jamais l'indicateur réel / fictif.
- Images importées vérifiées par signature binaire, SVG sans script, servies avec CSP `sandbox`.
- Export CSV protégé contre l'injection de formules.
- Journal d'audit des actions sensibles (corrections de promesses, équipe, forfaits…).
