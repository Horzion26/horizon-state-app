# Horizon State Cleaning — Team App

This turns your client/expense manager into a real installable app your whole
team can use, with everyone seeing the same shared, live-updating data —
including a shared **Calendar** tab where you can tap any day to schedule a
job, and everyone sees it appear on their own calendar in real time.
Total cost: **$0/month** on the free tiers below.

It's built with:
- **Supabase** — free shared database (holds your clients & expenses)
- **Vercel** — free hosting (gives the app a live web address)
- A **PWA** (installable web app) — no App Store needed. Each teammate opens
  the link once and taps "Add to Home Screen." From then on it's an icon on
  their phone that opens full-screen like a native app.

You don't need to know how to code to follow these steps — just some
copy/pasting. This is easiest on a laptop/desktop for the setup, but every
step can technically be done from a phone browser too.

---

## 1. Create your free database (Supabase)

1. Go to [supabase.com](https://supabase.com) and sign up (free).
2. Click **New project**. Name it anything (e.g. "horizon-state"), pick a
   database password (save it somewhere), and create it. Takes ~2 minutes to
   spin up.
3. Once it's ready, open the **SQL Editor** (left sidebar) → **New query**.
4. Copy everything from `supabase-schema.sql` (included in this folder) and
   paste it in, then click **Run**. This creates your `clients` and
   `expenses` tables.
5. Go to **Project Settings → API**. You'll need two values from this page
   in step 3 below:
   - **Project URL**
   - **anon public** key

---

## 2. Put the code on GitHub

1. Go to [github.com](https://github.com) and sign up (free) if you don't
   have an account.
2. Create a **New repository** (e.g. "horizon-state-app"). Keep it private
   if you'd like — that's fine, it doesn't affect the live app.
3. Upload all the files in this folder to that repository (GitHub's website
   lets you drag and drop files/folders directly in the browser — use
   "Add file → Upload files").

---

## 3. Deploy it (Vercel)

1. Go to [vercel.com](https://vercel.com) and sign up free using your GitHub
   account.
2. Click **Add New → Project**, then select the GitHub repo you just
   created.
3. Before clicking Deploy, open **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → paste your Project URL from step 1
   - `VITE_SUPABASE_ANON_KEY` → paste your anon public key from step 1
4. Click **Deploy**. In about a minute you'll get a live link like
   `horizon-state-app.vercel.app` — that's your app's permanent address.

**Optional:** Since you already own horizonstatecleaning.com, you can point
a subdomain like `app.horizonstatecleaning.com` at this Vercel project for
free (Vercel → Project → Settings → Domains, then add one DNS record with
your domain registrar). Happy to walk through this with you when you're
there.

---

## 4. Install it on your team's phones

Send everyone the Vercel link (or your custom domain). Each person:

- **iPhone:** open the link in Safari → tap the Share icon → **Add to Home
  Screen**.
- **Android:** open the link in Chrome → tap the menu (⋮) → **Install app**
  (or "Add to Home screen").

It now sits on their home screen with the Horizon State icon and opens
full-screen, no browser bar — feels like a real app. Since it's all backed
by the same Supabase database, anything one person adds or edits shows up
live on everyone else's phone.

---

## Already deployed this app before? (adding the Calendar)

If you already ran `supabase-schema.sql` once for clients/expenses, don't
re-run the whole file (it'll error trying to re-add tables already in
realtime). Just run this smaller snippet in the SQL Editor instead:

```sql
create table if not exists schedule_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  event_time text,
  notes text,
  created_at timestamptz not null default now()
);

alter table schedule_events enable row level security;

create policy "Allow all access to schedule_events" on schedule_events
  for all using (true) with check (true);

alter publication supabase_realtime add table schedule_events;
```

Then push the updated code (this whole folder) to your GitHub repo — Vercel
will redeploy automatically within a minute or two.

## Security note

This setup has **no login screen** — it's meant for a small trusted team
where everyone with the link can view and edit everything. That's the
simplest version and matches most small cleaning businesses' needs.

If down the road you want individual logins (so you can see who added what,
or restrict certain actions), Supabase has built-in authentication that can
be added on top of this without starting over — just let me know and I can
build that out.

---

## Local development (optional, only if you want to make changes yourself)

```
npm install
cp .env.example .env    # then fill in your Supabase URL + key
npm run dev
```
