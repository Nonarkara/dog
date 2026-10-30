# Accounts, cloud saves, and the Tamagotchi loop

Status: plan, not built. Written 2026-10-31.

## The goal

Anyone can sign in with LINE or Google in one tap, adopt a dog (their own
version of Expo or another household dog), name it whatever they like, and
raise it. The dog lives on our server, so it is there on any phone or laptop,
and it keeps living while they are away, like a Tamagotchi in a pocket.

## What makes a Tamagotchi work

Bandai's toy is a handful of simple rules. Each one gives a reason to come
back, and none needs words:

| Rule | Why it pulls you back | Already here? |
|---|---|---|
| **One creature, yours, named by you** | You care about what you named and raised. | Adoption yes; **naming no** |
| **Needs drain in real time, even when you're away** | Every visit finds something changed. | Yes (hunger, energy, hygiene) |
| **It calls you** (the beep) | A small, specific job: "he's hungry". | Only while the app is open |
| **Care is quick** (a few seconds) | Easy to fit into a day. | Yes |
| **Instant visible relief** | You see that your care mattered. | Yes (poses, hearts) |
| **Mess and sickness from neglect** | Responsibility, gently. | Yes |
| **Growth over days, shaped by care** | A long arc you cannot fast-forward. | Partly (7 days to adult) |
| **It is always with you** | The beep reaches you wherever you are. | **No: saves are per browser** |

So the gaps are three, and they are the next build: **name your dog, keep it on
the server, and let it call you when the app is closed.** Everything else
exists and should not be rebuilt.

### One design decision to make first: can a dog die?

The original Tamagotchi dies from neglect. That is part of its pull, and the
part people remember with guilt. These are portraits of real dogs. **My
recommendation: a dog never dies.** A neglected dog gets sad, sick and
withdrawn, and recovers with care. The pull comes from his relief when you
return, not from fear of loss.

## The loop, simply

**Notice → understand → care → see relief → remember.**

1. **Notice.** A LINE message or phone notification: "Expo is looking at his
   bowl." At most a few a day, never at night (the owner's quiet hours).
2. **Understand.** You open the app and he shows the need with his body: a
   bowl in a thought bubble, a sleepy stretch, a ball dropped at your feet.
3. **Care.** One tap, or a short stroke.
4. **See relief.** He eats, settles, wags, leans in. The need meter fills.
5. **Remember.** It counts: toward growing up, toward trust, toward a streak,
   and toward who he becomes (playful, calm, food-motivated) by how you raised him.

## What to build

### 1. Sign in with LINE or Google

- One tap. No passwords stored anywhere.
- The server (our Cloudflare Worker) handles the sign-in round trip, checks
  the provider's signed token, and keeps you signed in with a secure cookie.
  "Signed in" is decided by the server, never by the browser (house rule
  §16 Law 5).
- **Setup only you can do (there is no command-line way to create these):**
  - a **LINE Login channel** in the LINE Developers console (free);
  - a **Google OAuth client** in the Google Cloud console (free).
  Each gives an id and a secret. I store the secrets with `wrangler secret
  put`, never in the code. I can walk you through both in about ten minutes.

### 2. Adopt, name, and keep your dog on the server

- After signing in: pick a dog (Expo, Mali, Oreo, Paolo, Hachiku) and **name
  it**. "Mochi" can be your own Expo-looking Bangkaew.
- Saved in **Cloudflare D1** (a small SQLite database next to the Worker):
  your account, your dog, its state. A dog is "just numbers", as you said:
  a few kilobytes.
- **Local-first stays.** The app still works offline and saves in the browser.
  It syncs to the server when online. If two devices disagree, the most
  recent change wins, and the app says so.
- People who never sign in keep today's browser-only play. Signing in later
  offers to bring that dog along.

### 3. He keeps living, and calls you

- Needs already drain from the saved timestamps, so nothing has to run every
  minute. A Worker **cron job** runs every hour and finds dogs that would be
  calling.
- It sends **one nudge**, worded as the dog's need, by:
  - **web push** (free; phone or laptop browser), and/or
  - **LINE message** through a LINE Official Account. LINE's free plan has a
    monthly message cap; check current Thai pricing before turning it on.
- Limits: no more than about three nudges a day, never during quiet hours,
  and one tap to switch them off.

### 4. Who he becomes (later)

Growth already takes seven days of care. Next, the *kind* of care shapes the
adult: lots of play → playful; lots of training → attentive; lots of rest and
stroking → calm. It shows in his park habits (see
`src/domain/parkPersonality.ts`). This is the "remember" step made visible.

## Privacy (Thai PDPA)

- Stored: the provider's account id, the display name it gives, email only
  if Google provides it, your dog's name and state, and your notification
  choices. Nothing else.
- A plain notice at sign-in, a "Delete my account and dog" button that really
  deletes, and "Download my data".
- The dog's record fields (microchip, vet, medical) stay optional and private.
  They are never shared in the live park.

## Cost

Workers and D1 both have free tiers that cover thousands of small saves a day.
Web push is free. LINE messaging may cost money past the free monthly cap,
which is the only real cost to watch. Upgrading Workers to the paid plan is
US$5 a month if it is ever needed.

## Production tier (house rule §16.2)

With real people signing in, this becomes a **T1 Pilot**: server-side
sessions, secrets only in Cloudflare, tests on the sign-in and save paths,
and the save format checked on every write. It is not announced as T2 until
backups are restore-tested and the save path has monitoring.

## Order and effort

1. **Sign in + cloud save + naming** — the core. About three focused sessions,
   after you create the two provider apps.
2. **Calls when away** (web push first, LINE next) — about two sessions.
3. **Care shapes the adult** — about one session.

## Decisions only the owner can make

1. Can a dog die from neglect? (Recommended: no. He gets sad and sick, and recovers.)
2. Notifications: web push only to start, or LINE messages too (possible cost)?
3. Can one account raise more than one dog?
4. Will you create the LINE Login channel and Google OAuth client (I'll guide
   you step by step), or should I start with Google only?
