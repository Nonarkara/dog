# Sign-in setup: Apple, Google, LINE

The code for all three is live. Each company issues its keys only to the site's
owner, so each needs one registration in that company's console. None of the
three has a command-line way to create these. When a company's details are in,
its button appears on the welcome screen by itself.

Every company asks for the same return address. Use it exactly:

| Company | Return address (callback / redirect URL) |
|---|---|
| Apple | `https://dog.nonarkara.org/api/auth/apple/callback` |
| Google | `https://dog.nonarkara.org/api/auth/google/callback` |
| LINE | `https://dog.nonarkara.org/api/auth/line/callback` |

Secrets go straight from your terminal to Cloudflare. Never paste them into a
chat. Run each `wrangler secret put` command in this folder; it asks for the value.

## Google (about 10 minutes, free)

1. Open console.cloud.google.com, pick or create a project.
2. Google Auth Platform → Branding: app name "Tama-Dog-Chi", your support email,
   authorized domain `nonarkara.org`. Audience: External, then Publish.
3. Clients → Create client → Web application.
   Authorized redirect URI: the Google address above.
4. Copy the **Client ID** (public) and the **Client secret**.
5. Send me the Client ID. Then run:
   ```bash
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```

## LINE (about 10 minutes, free)

1. Open developers.line.biz, log in, create a provider (e.g. "Axiom").
2. Create a channel of type **LINE Login**, app type Web app.
3. LINE Login tab → Callback URL: the LINE address above.
4. Basic settings: copy the **Channel ID** (public) and **Channel secret**.
5. Set the channel to **Published** so people outside your account can sign in.
6. Send me the Channel ID. Then run:
   ```bash
   npx wrangler secret put LINE_CHANNEL_SECRET
   ```

## Apple (about 20 minutes; needs a paid Apple Developer account, US$99/year)

1. developer.apple.com → Certificates, Identifiers & Profiles → Identifiers.
2. Create an **App ID** (e.g. `org.nonarkara.dog.app`) and tick **Sign in with Apple**.
3. Create a **Services ID** (e.g. `org.nonarkara.dog`). Tick Sign in with Apple →
   Configure: primary App ID from step 2, domain `dog.nonarkara.org`,
   return URL the Apple address above.
4. Keys → create a key with **Sign in with Apple**, linked to that App ID.
   Download the `.p8` file (Apple lets you download it once) and note the **Key ID**.
5. Your **Team ID** is at the top right of the developer site.
6. Send me the Services ID, Team ID and Key ID (all three are public). Then run,
   and paste the whole contents of the `.p8` file when asked:
   ```bash
   npx wrangler secret put APPLE_PRIVATE_KEY
   ```

## What each one shares

- Apple: a private account id, the name (first sign-in only), and an email that
  may be Apple's private relay address.
- Google: account id, name, verified email.
- LINE: account id and display name. No email.

The site keeps the name, that email if given, and the dog. Park visits are kept
only after the owner agrees to the consent note.
