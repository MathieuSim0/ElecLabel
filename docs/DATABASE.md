# Base de données Supabase

Schéma PostgreSQL, sécurité (RLS), Storage et migrations.

Fichiers source : `supabase/migrations/001_initial.sql`, `002_realtime.sql`.

---

## 1. Mise en place d'un projet Supabase

1. Créer un compte sur https://supabase.com (gratuit, sans carte bancaire).
2. **New project** : nom, mot de passe de base de données (à noter), région `Europe (Paris/Frankfurt)`.
3. Récupérer dans **Settings → API** :
   - `Project URL` → `VITE_SUPABASE_URL`
   - clé `anon public` → `VITE_SUPABASE_ANON_KEY`
4. Exécuter les migrations (section 5).
5. (Optionnel dev) **Authentication → Providers → Email** : décocher *Confirm email* pour
   tester sans validation par mail.

---

## 2. Schéma des tables

### `profiles` — un profil par utilisateur

Étend `auth.users`. Créée automatiquement à l'inscription via trigger.

| Colonne | Type | Note |
|---|---|---|
| `id` | uuid (PK) | = `auth.users.id` |
| `display_name` | text | nom affiché |
| `phone` | text | tél (ex. ASE) |
| `created_at` / `updated_at` | timestamptz | |

### `panels` — tableaux électriques

| Colonne | Type | Note |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK) | → `auth.users` |
| `name` | text | nom du tableau |
| `source` | text | `photo` \| `template` \| `manual` |
| `panel_data` | jsonb | structure complète (rangées, breakers, image) |
| `thumbnail` | text | miniature base64 |
| `breaker_count` / `row_count` | int | compteurs |
| `created_at` / `updated_at` | timestamptz | |

Index : `(user_id, updated_at desc)`.

### `invoices` — factures

| Colonne | Type | Note |
|---|---|---|
| `id` | uuid (PK) | |
| `user_id` | uuid (FK) | → `auth.users` |
| `supplier` | text | fournisseur |
| `invoice_date` | date | date de facture |
| `reference` | text | n° de facture |
| `amount_cents` | int | montant TTC en centimes |
| `notes` | text | mention libre |
| `ocr_raw_text` | text | texte brut OCR (debug) |
| `reviewed` | boolean | vérifié par l'utilisateur |
| `thumbnail` | text | miniature base64 |
| `image_storage_path` | text | chemin dans le bucket Storage |
| `image_mime_type` | text | type MIME |
| `created_at` / `updated_at` | timestamptz | |

Index : `(user_id, created_at desc)` et `(user_id, invoice_date desc)`.

---

## 3. Sécurité — Row Level Security (RLS)

**Toutes les tables ont la RLS activée.** Chaque utilisateur ne peut voir/modifier que ses
propres lignes, via des politiques basées sur `auth.uid()` :

```sql
create policy "panels_select_own" on public.panels
  for select using (auth.uid() = user_id);
-- idem insert / update / delete sur panels, invoices, profiles
```

C'est la RLS — et non le secret de la clé — qui sécurise les données. La clé `anon` peut donc
être publique (intégrée dans le binaire de l'app) sans risque : sans session valide, elle ne
donne accès à rien.

---

## 4. Storage — photos de factures

Bucket **privé** `invoices`. Convention de chemin : `{user_id}/{invoice_id}.jpg`.

Politiques Storage : un utilisateur n'accède qu'aux fichiers dont le **premier segment du
chemin** correspond à son `user_id` :

```sql
create policy "invoices_storage_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);
-- idem insert / update / delete
```

---

## 5. Triggers automatiques

| Trigger | Effet |
|---|---|
| `on_auth_user_created` | Crée la ligne `profiles` à l'inscription (nom = part avant @ de l'email) |
| `*_updated_at` | Met à jour `updated_at` à chaque modification (profiles, panels, invoices) |

---

## 6. Exécuter les migrations

Dans le dashboard Supabase → **SQL Editor → New query**, copier-coller puis **Run** :

1. **`001_initial.sql`** — tables, RLS, bucket Storage, triggers.
   - Vérifier : *Database → Tables* doit montrer `profiles`, `panels`, `invoices` ;
     *Storage → Buckets* doit montrer `invoices` (Private).
2. **`002_realtime.sql`** — active la réplication Realtime sur `invoices` et `panels`.
   - Vérifier : *Database → Replication* doit montrer les deux tables activées.

Les deux scripts sont **idempotents** (réexécutables sans casse).

---

## 7. Mode gratuit & pérennité

- Le plan gratuit Supabase suffit largement pour un usage individuel (500 Mo DB, 1 Go Storage).
- ⚠️ **Pause après ~1 semaine d'inactivité** → mettre en place le keep-alive GitHub Actions
  (voir [CLOUD-SYNC.md](CLOUD-SYNC.md) §7).
- Alternative long terme : auto-hébergement de Supabase (open-source) sur une VM gratuite,
  ou migration vers Firebase (pas de pause). À décider selon les besoins.
