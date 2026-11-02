# Email/password and recovery codes

Requested 3 November 2026. Additive to Google and LINE; existing dogs remain on Cloudflare. Provider selection is awaiting the owner's reply to the in-chat choice. No auth service has been provisioned and no email has been sent.

## Player flow

- Email sign-up: email + password → emailed verification code → owned dog.
- Returning owner: email + password → their existing dog.
- Forgotten password: email → generic acknowledgement → emailed single-use code → new password → sign-in.
- Expired/incorrect code: stay on that step; resend has a cooldown. No password or code in application logs or URLs.

## Recommended boundary

Use managed authentication (Clerk is the proposed service), not a new password table in D1. Password hashing, email verification, recovery-code lifecycle and abuse controls belong to the auth service. Dog saves, park consent and game profiles remain on Cloudflare. Clerk currently lists a free Hobby plan and supports email/password and email reset codes. Its fixed seven-day free-plan session policy must be respected rather than bypassed with a sixty-day app cookie.

Load email UI/SDK only after Email is chosen or an existing email session must be resumed. Keep the illustration/game path independent of the auth SDK. Preserve hand-written typography and the existing quiet entry layout.

## Required integration checks

- Validate provider-issued tokens on the Worker, including signature, issuer, expiry and authorized origin. Never trust a browser flag, posted email or decoded-but-unverified JWT.
- Map a verified provider subject to a stable internal user ID. Do not silently merge Google/LINE accounts by email. Linking must prove control of the existing account.
- Password reset must invalidate the owner's other sessions. A fresh app cookie must not let a revoked managed-auth session survive.
- Existing OAuth login, local-only play, owned-dog restore, export and deletion continue working.
- Deleting an email account must remove the app-specific identity from the managed service as well as dog data in D1; do not claim deletion while credentials remain.
- Uniform recovery acknowledgement for known/unknown addresses; rate limits, code expiry, replay rejection and resend cooldown verified against the selected provider configuration.
- Browser tests at 320/390px, password-manager autocomplete/paste, keyboard/error handling. No real test email without an explicit recipient/instruction.

## Activation information

If Clerk is selected: create/claim a Tama-Dog-Chi application, enable email + password and email verification/recovery codes, configure the production origin, supply the public publishable key, and store any backend credential directly in Cloudflare secrets. Never paste a secret into chat. Do not expose a working-looking Email button before production delivery and recovery are verified.

Sources checked 3 November 2026:
- https://clerk.com/pricing
- https://clerk.com/docs/guides/development/custom-flows/authentication/forgot-password
- https://clerk.com/docs/reference/backend/verify-token
- https://clerk.com/docs/guides/sessions/manual-jwt-verification
