# Authentification, synchronisation & mode hors-ligne

Comment ElecLabel relie l'ordinateur et le téléphone via un compte, avec sync temps réel
et fonctionnement hors-ligne complet.

Code source : `src/services/supabase.ts`, `cloudSync.ts`, `syncQueue.ts`, `realtime.ts`,
`store/authStore.ts`, `components/AuthGate.tsx`, `SyncStatus.tsx`.

---

## 1. Vue d'ensemble

```
   Device A (PC)                                Device B (Téléphone)
   ┌─────────────┐                             ┌─────────────┐
   │ store local │                             │ store local │
   │ (IndexedDB) │                             │ (IndexedDB) │
   └──────┬──────┘                             └──────┬──────┘
          │ mutation                                  │ mutation
          ▼                                           ▼
   ┌─────────────┐                             ┌─────────────┐
   │ syncQueue   │  push si réseau              │ syncQueue   │
   │ (file IDB)  │  garde si offline           │ (file IDB)  │
   └──────┬──────┘                             └──────┬──────┘
          │                                           │
          └──────────────┬────────────────────────────┘
                         ▼
                  ┌─────────────┐
                  │  Supabase    │  ── Realtime push ──▶ tous les devices
                  │  Postgres    │
                  └─────────────┘
```

**Principe local-first** : toute mutation est d'abord écrite localement (UI instantanée),
puis poussée vers le cloud en arrière-plan. L'app reste 100 % fonctionnelle hors-ligne.

---

## 2. Authentification (`authStore.ts`)

Wrapper Zustand autour de **Supabase Auth** (email + mot de passe).

- `signUp` / `signIn` / `signOut` / `resetPassword`.
- Session **persistée en localStorage** par Supabase → l'utilisateur reste connecté entre redémarrages.
- `onAuthStateChange` écoute login/logout/refresh de token.
- Messages d'erreur traduits en français (`friendlyAuthError`).

Le profil utilisateur (`profiles`) est créé automatiquement à l'inscription via un trigger SQL
(voir [DATABASE.md](DATABASE.md)).

### AuthGate

`<AuthGate>` enveloppe toutes les routes. Tant que l'utilisateur n'est pas connecté →
affiche `<Login>`. Au login, il déclenche la **séquence de synchronisation initiale** :

1. **Migration** (1ʳᵉ fois) : les données locales créées avant le compte sont uploadées vers le cloud (re-génération d'UUID propres).
2. **Flush** de la file d'attente (modifs faites hors-ligne).
3. **Pull** complet depuis le cloud.
4. **Abonnement Realtime**.

> Détail important : `AuthGate` dépend de `user?.id` (et non de l'objet `user`). Sans ça, un
> simple refresh de token (ex. au retour de la caméra Android) relancerait toute la sync et
> ferait perdre l'état en cours.

---

## 3. Synchronisation cloud (`cloudSync.ts`)

Couche d'accès à Supabase. Mappe les types TypeScript ↔ lignes SQL.

| Fonction | Rôle |
|---|---|
| `pushInvoice` / `pushInvoiceMetadata` / `pushDeleteInvoice` | Factures |
| `uploadInvoicePhoto` / `downloadInvoicePhoto` | Photos (Storage) |
| `pushPanel` / `pushPanelData` / `pushPanelName` / `pushDeletePanel` | Tableaux |
| `fetchAllInvoices` / `fetchAllPanels` | Pull initial |
| `getCurrentUserId` | Helper session |

Les **photos de factures** vont dans Storage (`invoices/{user_id}/{id}.jpg`), les **tableaux**
sont stockés en JSONB directement dans la table `panels` (volume plus faible).

---

## 4. File d'attente offline (`syncQueue.ts`)

Le cœur du mode hors-ligne. File **persistante dans IndexedDB** qui survit aux fermetures d'app.

### Fonctionnement

- `enqueue(op)` ajoute une opération + tente un flush immédiat.
- `flush()` exécute les opérations une par une ; **s'arrête à la première erreur réseau** (retry plus tard).
- **Dédup intelligente** :
  - éditer 50× le même enregistrement → une seule op gardée (la dernière),
  - supprimer un enregistrement → annule toutes ses ops antérieures.
- **Retry** : jusqu'à 5 tentatives par op, puis abandon loggé.

### Déclencheurs de flush

- Immédiatement après chaque `enqueue` (si réseau).
- Sur l'événement navigateur `online` (retour du réseau).
- Tick périodique toutes les 30 s (filet de sécurité).

### Types d'opérations

`invoice-upsert`, `invoice-meta`, `invoice-delete`, `panel-upsert`, `panel-data`,
`panel-name`, `panel-delete`.

---

## 5. Temps réel (`realtime.ts`)

Abonnement aux changements PostgreSQL via **Supabase Realtime**.

- Au login : `subscribeRealtime(userId)` s'abonne aux tables `invoices` et `panels`,
  filtrées par `user_id=eq.{userId}`.
- Quand un autre device modifie une donnée → le store local est mis à jour **instantanément**
  (INSERT / UPDATE / DELETE gérés séparément).
- Idempotent : si l'event est notre propre modif qui revient, l'effet est nul.
- Préserve la photo HD locale lors d'un UPDATE distant (la photo n'est pas dans le payload).
- Au logout : `unsubscribeRealtime()` coupe proprement les abonnements.

> ⚠️ Realtime nécessite d'avoir exécuté la migration `002_realtime.sql` qui ajoute les tables
> à la publication `supabase_realtime`. Voir [DATABASE.md](DATABASE.md).

---

## 6. Indicateur de statut (`SyncStatus.tsx`)

Badge dans l'en-tête, dérive son état de `navigator.onLine` + longueur de la file :

| État | Signification |
|---|---|
| 🟢 **Synchronisé** | Tout est à jour dans le cloud |
| 🟡 **N en attente** | Modifs à pousser (clic = forcer la sync) |
| 🔵 **Sync…** | Flush en cours |
| ⚫ **Hors ligne** | Pas de réseau, modifs sauvegardées localement |

---

## 7. Garder le projet Supabase actif (anti-pause)

Le **plan gratuit Supabase met le projet en pause après ~1 semaine d'inactivité**. Les données
restent intactes mais l'app ne peut plus s'y connecter jusqu'à réactivation manuelle.

**Solution : un keep-alive automatique** via GitHub Actions (gratuit) qui envoie une requête
anodine tous les 5 jours. Le workflow est dans `.github/workflows/supabase-keepalive.yml`.

### Mise en place

1. Pousse ce repo sur GitHub.
2. Dans **Settings → Secrets and variables → Actions**, ajoute deux secrets :
   - `SUPABASE_URL` = `https://xxxxx.supabase.co`
   - `SUPABASE_ANON_KEY` = ta clé anon
3. Le workflow s'exécute automatiquement tous les 5 jours. Tu peux aussi le lancer à la main
   (onglet **Actions → Supabase Keep-Alive → Run workflow**).

> Si le projet est déjà en pause : réactive-le d'abord depuis le dashboard Supabase
> (bouton **Resume project**), puis le keep-alive empêchera toute pause future.

---

## 8. Limites connues & évolutions possibles

| Limite actuelle | Évolution possible |
|---|---|
| Pull complet au login (pas de pagination) | OK jusqu'à ~500 enregistrements, sinon paginer |
| En cas de conflit, le pull cloud écrase le local | Ajouter un merge par `updated_at` |
| Pas de partage multi-utilisateurs | Ajouter une table d'équipe + RLS partagée |
