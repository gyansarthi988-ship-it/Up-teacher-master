# UP Teacher Master

Bilingual Hindi/English exam-preparation platform for UP Super TET, UP TGT, UP PRT and UP Junior Level.

## Project components

- `mobile/` — Flutter Android student application
- `admin/` — Next.js administration panel
- `supabase/migrations/` — database schema and migration history
- `.github/workflows/` — automated Android release builds
- `docs/` — setup, operations and release documentation

## Repository status

The GitHub connection is verified and this repository is writable. At the time of this commit, the repository contains only this README; the full application source tree has not yet been uploaded. This is documentation only, not a working application or release.

## Release safety

Never commit `.env` files, Supabase service-role keys, Android keystores, signing passwords, Firebase private credentials or other secrets. Configure production values as GitHub Actions repository secrets. Only the public Supabase anon/publishable key may be used by the client app.

## Planned release outputs

- Signed APK for direct distribution
- Signed AAB for Google Play

Do not publish either artifact until production configuration, privacy disclosures, Play Console requirements and manual device testing are complete.

## Next step

Upload the complete project source folders (`mobile/`, `admin/`, `supabase/`, `docs/`) and the `.github/workflows/` release workflow to the repository root. The build workflow cannot run successfully until those files and the required GitHub Actions secrets and Android upload keystore are present.
