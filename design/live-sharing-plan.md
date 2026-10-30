# Live sharing — other people's real dogs in your park

Status: plan, not built. Written 2026-10-30.

## The goal

Today the park holds your dog, the household pack, and dogs imported from a
friend's file. Nobody else is there live. The goal: open the park (or Watch
mode) and see a friend's real dog walking around with yours, right now. You can
pet each other's dogs. When a dog gets hungry, its owner takes it home and it
leaves the park.

## The smallest first version: "Park with a friend"

1. **Invite, don't broadcast.** A park button makes a private room and a link
   (`dog.nonarkara.org/park/k7f3-tiger`). You send it on LINE or WhatsApp.
   Only people with the link can come in. There is no public lobby yet.
2. **Your friend opens the link and picks their own dog.** Both dogs appear in
   both parks, next to the household pack.
3. **Each person's browser moves its own dog** and tells the others what it is
   doing. Everyone else draws it.
4. **Petting a friend's dog** sends a "pet" to its owner. Their dog reacts on
   both screens, and the trust is added to *their* saved dog.
5. **A hungry dog goes home.** When the owner taps "Take him home", the dog
   leaves every screen with a short note: "Expo went home for dinner."
6. **No chat in v1.** Dogs only. That removes the need to moderate text.
7. **At most 8 dogs per room.** The room disappears when the last person leaves.
   Nothing is kept on the server.

## How it works

The site already runs on a Cloudflare Worker. Add one **Durable Object per
room**: a tiny server that holds the open connections for that room and
passes messages between them. It uses WebSockets with Cloudflare's
*hibernation* mode, so the room costs almost nothing while nobody is sending.

**Send intentions, not frames.** A browser does not stream its dog's position
many times a second. It sends a message only when the dog *decides* something:
"walking to (x, y)", "chasing Mali", "lying down", "petted", "going home".
That is roughly one message every 3 to 5 seconds per dog. Every screen then
plays the same walk with the park's existing animation, so it still looks
smooth. Fewer messages keep the cost near zero and let the room hibernate
between them.

**Everyone keeps their own save.** The browser stays the source of truth for
your dog, as it is today. The server only relays; it never stores a dog.

## Privacy

The current "export dog" file is the whole record: microchip number, vet,
emergency phone, birth date, medical history. **None of that is sent live.**
Live sharing sends only:

- the dog's name, breed, and look (illustration or coat colours);
- what the dog is doing (position, activity, pose, "hungry");
- an optional owner nickname. Default: "Expo's person". No real name is needed.

No location, no account, no email. A per-browser random id lets a dog rejoin
the same room. Under Thai PDPA this keeps v1 close to "no personal data". A dog's
name plus a nickname is still worth a one-line notice the first time you invite
someone.

**Server checks (house rule §16 Law 5).** Each incoming message is checked
against a strict shape and rejected if malformed. Message rate per connection
is capped. Coordinates are clamped to the park. A connection that misbehaves is
dropped. Room links are random and long enough not to be guessed.

## Cost

From Cloudflare's current docs:

- **Free plan:** 100,000 requests a day, 13,000 GB-s of compute time a day,
  SQLite-backed Durable Objects only. Incoming WebSocket messages count as
  1/20 of a request each; outgoing messages are free.
- **Hibernation:** an idle room is not billed for duration.

A rough estimate for 10 people with their parks open 8 hours a day, at about
one intention every 4 seconds: about 72,000 incoming messages, which is about
3,600 billed requests. That is well inside the free plan. The rooms sleep
between messages, so compute time stays small.

When it outgrows that, Workers Paid is **US$5 a month** and covers far more.
These are estimates; measure real traffic after launch before relying on them.

## Effort

About three focused sessions:

1. The room server (Durable Object), the message format, input checks, and a
   test that a malformed or flooding client is cut off.
2. The client: joining a room, drawing remote dogs in `IllustratedPark` (they
   already accept outside dogs through `spawnNeighbor`), sending your dog's
   intentions, and pets crossing over.
3. The invite button and join screen. Then test on two phones, run the layout
   gates, and ship.

## Known problems to solve along the way

- **Custom dogs look crude.** A friend's dog with its own coat has no
  illustration, so it falls back to the placeholder drawing that Watch mode
  currently hides. Live sharing needs either a better generated look for custom
  coats or illustrations made from the owner's photos.
- **Time zones.** A friend's dog follows its owner's day and night. A dog
  asleep in Bangkok can be awake in Paris. That is honest, but should be shown
  ("Mochi is asleep — it's night where she lives").
- **Battery.** A second screen left on all day still draws power. Watch mode
  already runs at 30 frames a second and pauses in background tabs.

## Later versions (not v1)

- **v2, the town park:** a public park anyone can join. This needs block and
  report controls and a code of conduct before any text chat.
- **v2:** "Who visited today": dogs that played with yours in the last 24 hours.
- **v3, optional accounts:** the same dog on your phone and your laptop.

## Decisions only the owner can make

1. Private invite links first (recommended), or a public park from day one?
2. Show an owner nickname next to each dog, or dogs only?
3. Start on the free plan and move to US$5 a month when needed?

Sources: [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/),
[Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/),
[Durable Objects WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).
