# Plan: Load & Save Families via Supabase

TL;DR: Add Supabase client and auth listener, load all families owned by the signed-in user, render them as a clickable list in the sidebar; if empty show "Thêm Cây Gia Phả" which triggers the existing "Thêm thành viên gốc" flow. On save, insert a `families` row and redirect to `giapha.html/{family_id}` for editing. Use placeholders for Supabase keys in client JS (to be replaced by the developer).

## Steps

1. Add Supabase client initialization to `giapha.js` (or a small new `supabase-client.js`) with placeholder `SUPABASE_URL` and `SUPABASE_ANON_KEY` and `const supabase = createClient(...)`.
2. Wire auth listener: when user signs in, call `loadFamilies()`; when signs out, clear UI and show sign-in button.
3. Implement `loadFamilies()`:
   - Query `supabase.from('families').select('*').eq('owner_id', user.id).order('created_at', {ascending:false})`.
   - If result is empty: show the existing root creation prompt and a prominent button labeled "Thêm Cây Gia Phả".
   - If non-empty: render a scrollable list of families in the sidebar showing name and creation date. Each item should be clickable and navigate to `giapha.html/{family_id}`.
4. Update the existing "Thêm thành viên gốc" flow:
   - When the user clicks "Thêm Cây Gia Phả" open the existing `form-container` and reveal `family-name-group` (require family name).
   - On form submit when `form-type` is root and `family-name` is present: build an initial JSON tree (root member) from the form fields.
   - Call `supabase.from('families').insert({ owner_id: user.id, name: familyName, content: initialTree })` and handle errors.
   - On success, get inserted `id` and redirect to `giapha.html/${id}`.
5. Family open flow for existing rows:
   - Clicking a family row navigates to `giapha.html/{family_id}`.
   - On the `giapha.html` side (existing code) read the path segment ID and load family via `supabase.from('families').select('*').eq('id', id).single()` and ensure `owner_id === auth.user().id` before enabling editing features; otherwise disable edit controls (read-only view).
6. Access control and policies:
   - Implement client-side checks to hide edit buttons when current user is not owner.
   - Recommend enabling Supabase Row-Level Security (RLS) on the `families` table and add a policy: allow insert/update/delete where `auth.uid() = owner_id` and `select` allowed for owner only (or public read if desired).
7. UX details and error handling:
   - Show loading spinner while querying.
   - Show clear error messages on fetch/insert failures.
   - Disable the Save button while network request in-flight.

## Relevant files

- `index.html` — update to host the family list UI (sidebar already present).
- `giapha.html` — no HTML changes required for redirect pattern, but JS must read path segment; confirm behavior.
- `giapha.js` — add Supabase init, auth listener, `loadFamilies()`, create/insert family logic, and client-side owner checks.
- `families.sql` — schema reference; confirm `owner_id uuid` column used for queries and RLS.

## Verification

1. Sign in: the sidebar shows either "Thêm Cây Gia Phả" (if empty) or a list of families.
2. Click "Thêm Cây Gia Phả": the existing root form appears; fill and click "Lưu" → new `families` row created with `owner_id` = auth.uid(); browser redirects to `giapha.html/{id}`.
3. Click existing family: navigates to `giapha.html/{id}` and the family content loads for editing.
4. Non-owner attempt: sign in with a different user and verify edit controls are disabled and DB blocks updates (after RLS enabled).

## Decisions / Assumptions

- URL format: path segment `giapha.html/{family_id}`.
- Supabase keys: placeholders in client JS. Add a clear comment where to replace them.
- Family tree stored as JSON in `content` column per `families.sql`.

## Further Considerations

1. RLS: I recommend enabling RLS policies on the `families` table and adding server-side enforcement; otherwise client checks can be bypassed.
2. Redirect path: `giapha.html/{id}` relies on your static host serving `giapha.html` for that path; if your host doesn't rewrite path segments, prefer `giapha.html?family_id={id}` or `giapha.html#{id}`.
3. Keys security: avoid shipping ANON key with broad permissions to public sites—use RLS plus minimal scopes.

---

Saved on 2026-06-20.
