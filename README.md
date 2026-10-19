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
| Création d'événements | Nom, date, objectif, devise, langue, arrière-plan de départ ou modèle. Lien de diffusion, régie et formulaire créés automatiquement. |
| Saisie manuelle | Régie : nom, montant, montants rapides (€/$ : 100·500·1 000·5 000 — ₪ : 180·360·1 800·3 600), case « Don fictif » décochée par défaut. |
| Formulaire mobile | `/d/[jeton]` : nom + montant, sans compte, sans PIN, sans validation ; affiché immédiatement. Anti-robot (champ piège), limite de 5 promesses/min **par téléphone** (cookie anonyme) et plafond anti-inondation de 600/min par IP : des centaines d'invités sur le même Wi-Fi de salle ne se bloquent pas entre eux. |
| Dons fictifs | Identifiés uniquement côté administration ; affichés et **comptés dans le total** comme les dons réels. Sous-totaux réels / fictifs en interne. |
| Total du show | Somme de toutes les promesses (réelles + fictives), sans validation préalable. |
| Régie Live | Total, dernières promesses, ajout, correction, suppression (historisées), célébration, animation objectif, pause des animations, message à l'écran, **intermède vidéo plein écran** (vidéos préparées ou lien collé en direct), aperçu en direct. Ordinateur et mobile. |
| Studio Show | Éditeur visuel 1920×1080 (coordonnées proportionnelles) : déplacement / redimensionnement (react-rnd), calques (dnd-kit), visibilité, logo, animations, textes, annuler/rétablir, magnétisme, raccourcis clavier, simulation de don, modèles réutilisables. **Bibliothèque de 14 arrière-plans** conçus par la plateforme (décor CSS / SVG, ambiance animée, palette), présentée en vignettes fidèles ; couleurs d'accent et de texte des éléments modifiables (aucun import de fond personnalisé) ; **mise en page intelligente** (disposition automatique selon les blocs affichés, 4 mises en page : classique, total en vedette, donateurs à l'honneur, minimaliste ; miroir automatique pour l'hébreu, détection et correction des chevauchements) ; liste des dons sur 1 ou 2 colonnes ; bloc **Objectif** réduit au montant de l'objectif (aucune barre, jauge ni pourcentage sur l'écran ; le montant collecté est celui du bloc total). |
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

### Studio Show : arrière-plans

Les associations n'importent plus leur propre fond : elles choisissent dans une **bibliothèque d'arrière-plans** conçue par la plateforme (`src/lib/show/themes.ts`, décors dans `src/lib/show/scenes.ts`, rendu par `src/components/show/backdrop.tsx`).

| Arrière-plan | Décor | Ambiance animée |
| --- | --- | --- |
| Gala Premium (`gala`) | Noir profond, faisceaux et poussière d'or | paillettes |
| Rideau de velours (`velours`) | Rideaux rouges drapés, lambrequin à franges dorées, projecteur et plancher de scène | poussières dans le faisceau |
| Art déco (`artdeco`) | Écailles dorées, cadre à angles à gradins, soleil levant | éclats dorés |
| Marbre et or (`marbre`) | Marbre ivoire veiné de gris et d'or, double filet doré | reflet qui traverse l'écran |
| Nuit sur Jérusalem (`jerusalem`) | Ciel étoilé, remparts et coupoles en silhouette, liseré et halo dorés | étoiles scintillantes |
| Bleu royal (`royal`) | Bleu profond, motif hexagonal, frises dorées | éclats |
| Émeraude (`emeraude`) | Vert satiné, arabesques dorées dans les angles | paillettes |
| Aurore boréale (`aurore`) | Voiles de lumière vert et violet, montagnes | voiles qui glissent |
| Féerie (`feerie`) | Nuit violette, étoiles, nuages | étoiles |
| Feux d'artifice (`feux`) | Gerbes dorées, roses et turquoise | paillettes |
| Coucher de soleil (`sunset`) | Dégradé violet → or, soleil couchant, collines | halos |
| Nature (`nature`) | Vert profond, rameaux de feuilles, rais de lumière | halos |
| Moderne (`moderne`) | Bleu clair lumineux, cercles, grille de points | rayons et halos |
| Minimaliste (`minimal`) | Papier crème, cercles fins, filet rouge | — |

- **100 % CSS / SVG inline** (dégradés, dessins SVG en data-URI) : aucun fichier image, aucune ressource externe. Les décors sont statiques ; seule l'ambiance est animée, en `transform` / `opacity` uniquement, avec 20 éléments animés au plus. Le mode économie (`lowPower`, téléphones et « réduire les animations ») coupe l'ambiance.
- Chaque arrière-plan fournit sa palette (fond, texte, accent, panneaux, QR code, couleurs de l'ambiance). L'association peut modifier l'accent et le texte des éléments ; le décor garde ses couleurs. La propriété `lockedColors` (désactivée partout) prépare la future règle « couleurs imposées ».
- Les anciennes configurations (fond image / vidéo, assombrissement, couleur de fond, bloc vidéo) restent lisibles : ces champs sont ignorés à la normalisation.

### Formats d'écran

Le show s'adapte à la forme de l'écran (`src/lib/show/formats.ts`). Chaque format a sa propre surface (rendue puis mise à l'échelle, letterbox minimal) et sa propre mise en page ; **les couleurs, l'arrière-plan, les textes, les animations et la liste des dons sont communs** à tous les formats. L'écran du show est toujours couché : il n'y a pas de format portrait (une fenêtre en portrait prend le format le plus proche, 4:3, avec des bandes noires).

| Format | Surface | Usage typique | Mise en page dérivée du 16:9 |
| --- | --- | --- | --- |
| 16:9 | 1920 × 1080 | écran standard, Full HD, 4K | **mise en page principale** (référence) |
| 16:10 | 1920 × 1200 | projecteur WUXGA, écran d'ordinateur | reprise en % |
| 4:3 | 1440 × 1080 | projecteur classique | reprise en % |
| 21:9 | 2520 × 1080 | écran ultra-large | 3 colonnes : identité, total + objectif + catégories + dons, QR code |
| 32:9 | 3840 × 1080 | double écran, bandeau LED | 4 colonnes : identité, total + objectif, catégories + dons, QR code |

- **Modèle de données** : `blocks` reste la mise en page 16:9 (rétrocompatible) ; `layouts` (facultatif) contient les mises en page personnalisées des autres formats (`{ "21:9": [...blocs], "4:3": [...] }`). Une mise en page d'un format inconnu ou retiré (par exemple `"9:16"`) est ignorée à la normalisation. Un format absent est **dérivé automatiquement** du 16:9 (`formatBlocks` / `deriveFormatBlocks` dans `smart-layout.ts`) : il suit la mise en page proposée correspondante (Classique, Total en vedette, Donateurs à l'honneur, Minimaliste ; sinon la disposition automatique), conserve la visibilité, la taille du texte et l'ordre des calques, se retourne pour l'hébreu, ne laisse pas de place à un bloc « Texte » vide et ne crée aucun chevauchement (testé pour chaque format et chaque mise en page, avec et sans catégories).
- **Catégories de donateurs** : le bloc « Catégories » n'est affiché que si l'événement a des catégories. En 16:9, 16:10 et 4:3, il est taillé dans la liste des dons ; en 21:9 et 32:9, il forme un bandeau juste au-dessus de la liste des dons, dans sa colonne. L'apparition et la disparition des catégories s'appliquent aussi aux mises en page personnalisées.
- **Écran géant** : `/screen/<jeton>` choisit le format le plus proche de la fenêtre (rapports comparés en logarithme) et se recalcule au redimensionnement sans recharger ni perdre l'état du direct. Le paramètre **`?format=`** impose un format : `16:9`, `16:10`, `4:3`, `21:9`, `32:9` (aussi `21x9`, `21-9`) ou un alias (`ultrawide`, `superwide`, `projecteur`, `standard`…). Exemple : `/screen/<jeton>?format=21:9`. Une valeur inconnue revient à la détection automatique.
- **Studio** : un sélecteur de format (au-dessus de l'aperçu) donne au canevas les proportions du format et fait éditer sa mise en page (déplacement, magnétisme, calques, mises en page intelligentes, propriétés, annuler / rétablir). Un indicateur distingue la mise en page principale, une mise en page « adaptée automatiquement » et une mise en page « personnalisée » (point doré dans le sélecteur) ; « Réinitialiser depuis 16:9 » revient à l'adaptation automatique ; « Ouvrir l'écran en … » ouvre l'écran avec `?format=`.
- **Arrière-plans** : chaque décor SVG est composé aux dimensions du format (rideaux sur les côtés, remparts et collines en bas, cadres au contour, frises sur toute la largeur), sans déformation ni recadrage ; le dessin 16:9 est identique à l'original. L'ambiance animée couvre toute la scène, avec les mêmes limites (20 éléments, `transform` / `opacity`, coupée en `lowPower`).
- Les aperçus (Régie, page d'accueil, galerie de modèles, vignettes) restent en 16:9.
- **Badge « MODE TEST » / « APERÇU »** : posé sur la scène à un emplacement libre (haut centré, bas centré, puis les coins), réduit si besoin pour tenir dans la marge : il ne recouvre jamais un bloc, quel que soit le format ou la mise en page (`src/lib/show/badge.ts`, testé pour chaque format et chaque modèle).

### Régie : intermède vidéo

Pendant le direct, la Régie peut passer une vidéo **en plein écran** sur l'écran géant ; les promesses continuent d'être saisies et comptées en arrière-plan.

- **Vidéos préparées** (table `event_video` : titre, source, position) : panneau « Intermède vidéo » sous l'aperçu de la Régie. Ajouter un lien (YouTube, Vimeo, Dailymotion, fichier MP4 / WebM en https) ou **importer un fichier** (stockage de la plateforme, ou Vercel Blob pour les fichiers lourds), renommer, monter / descendre, supprimer (20 vidéos au plus). Mêmes droits que le pilotage de la Régie (`event.regie` : administrateurs et Utilisateurs Show de l'association) ; chaque modification est historisée (`video.add`, `video.rename`, `video.reorder`, `video.delete`).
- **Lien en temps réel** : « Lancer un lien » lit directement un lien collé, sans l'ajouter à la liste. Un lien non reconnu est refusé avec un message explicite (vérifié aussi côté serveur ; un fichier importé doit être une vidéo de la même association).
- **Pilotage** (`POST /api/events/<id>/control`, actions `videoStart`, `videoMute`, `videoStop`, historisées `live.video.start` / `live.video.stop`) : l'état est stocké dans `Event.liveControl.video` = `{ id, source, title, refId, startedAt, muted, soundBlocked, startTotal, startCount }` et diffusé comme la pause et le message (outbox → Ably ou synchronisation HTTP). La Régie affiche « Vidéo en cours : <titre> », le temps écoulé, l'état du son, et les boutons **Couper le son / Rétablir le son** et **Arrêter la vidéo** ; l'interrupteur « Avec le son » choisit le son au lancement.
- **Écran géant** : la vidéo couvre toute la scène, au-dessus des surimpressions (fondu à l'entrée et à la sortie). La scène reste montée : total, dons et catégories continuent d'être mis à jour. Pendant la vidéo, ni confettis, ni projecteur, ni paliers (ignorés, pas mis en file). Le son se coupe et se rétablit sans relancer la vidéo (fichier, YouTube, Vimeo ; Dailymotion est rechargé). Un écran rechargé en cours de vidéo reprend un fichier au bon moment.
- **Fin de la vidéo** : événement `ended` pour un fichier, API postMessage pour YouTube et Vimeo ; l'écran le signale (`POST /api/live/screen/<jeton>/video`, sans effet si l'intermède a déjà changé), retour automatique à la scène pour tous les écrans et la Régie. Dailymotion n'expose pas cette information : arrêt manuel. Au retour, si des promesses sont arrivées pendant la vidéo, un récapitulatif s'affiche quelques secondes : « Pendant la vidéo : 3 nouvelles promesses · 1 250 € ».
- **Son** : les navigateurs refusent la lecture avec le son tant que personne n'a cliqué sur la page. À l'ouverture, l'écran affiche discrètement « Activer le son » (masqué avec les autres commandes après quelques secondes d'inactivité) ; tout clic ou touche « arme » l'écran. Sinon la vidéo est lue **sans le son** et la Régie affiche « Son bloqué par le navigateur de l'écran » jusqu'au clic.
- Aperçu de la Régie : la vidéo y est lue sans le son (visuel fixe « Vidéo en cours » sur téléphone / appareil peu puissant).

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

Les tests de bout en bout couvrent : régie (réel + fictif, total public), formulaire mobile → écran en temps réel, correction / suppression, message à l'écran, Studio → diffusion du design et de l'arrière-plan, export CSV, Utilisateur Show à accès limité, isolation entre associations, Super Admin (création, crédits, suspension), idempotence, anti-robot, limite de débit, collecte terminée, charge (3 galas × 20 promesses simultanées, sans perte ni doublon, totaux ordonnés), pages publiques FR/HE.

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
