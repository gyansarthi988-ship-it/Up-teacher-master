# UP Teacher Master

Bilingual Hindi/English exam-preparation platform for UP Super TET, UP TGT, UP PRT and UP Junior Level.

## Source of truth

The project source archive `UP_Teacher_Master_Launch_Files.zip` is stored in this repository. Development and release builds should use this repository copy; there is no need to re-upload the ZIP for each code change.

The release workflow extracts the archive, applies maintained fixes from `release-patches/`, and builds Android APK/AAB artifacts through GitHub Actions.

## Project components

- Flutter Android student application (inside the source archive)
- Next.js administration panel (inside the source archive)
- Supabase migrations (inside the source archive and maintained patches)
- `.github/workflows/` — automated Android release build

## Making changes

1. Update the relevant source file in the project archive or maintained patch files.
2. Commit the change to `main`.
3. Run **Actions → Build UP Teacher Master Release APK and AAB → Run workflow** (or use the automatic push trigger for configured paths).
4. Download the APK from the completed workflow run's Artifacts section.

## Login changes

The simplified username/password registration screen is maintained at:
`release-patches/mobile/lib/screens/auth_screen.dart`

The associated Supabase migration is:
`release-patches/supabase/migrations/0020_username_registration.sql`

Apply the SQL migration to the connected Supabase project and disable email confirmation for the username-alias registration flow before releasing.

## Secrets and release signing

Never commit `.env` files, Supabase service-role keys, Android keystores, signing passwords, Firebase private credentials or other secrets. Configure required values as GitHub Actions repository secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_STORE_PASSWORD`

The workflow cannot produce a signed production release until these secrets are configured. Do not publish until production configuration, privacy disclosures, Play Console requirements and device testing are complete.
