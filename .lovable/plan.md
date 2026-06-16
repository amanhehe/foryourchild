# Fix Auth + Add Pictures & Sentences

## 1. Fix signup & login (button spins forever)

Google sign-in works because it goes through Lovable's broker; email/password goes straight to the backend and, in the in-app **preview**, the request can hang so the button spins forever. Right now there's no error handling for a stuck request, so the user just sees a spinner.

Changes:
- **Make sure email auth is fully enabled** with instant account activation (no email-confirmation step) so accounts work the moment they're created.
- **Harden the auth form** in `src/routes/auth.tsx`:
  - Add a request timeout so the button can never spin forever — if the network stalls, show a clear, friendly error and re-enable the button.
  - After a successful login/signup, wait for the session to be confirmed before navigating to the dashboard (prevents bouncing back to the login screen).
  - Surface the real error text in the toast so failures are visible instead of silent.
- **Verify the fix** by testing sign-up and log-in against the **published** site (the preview proxy is the usual culprit; the published URL is the source of truth). I'll report exactly what happens.

## 2. AI illustrations for each word

Each practice word gets its own custom kid-friendly illustration.

- Add a server endpoint that generates a clean, colorful cartoon illustration for a given word using the AI image gateway.
- To keep it fast and cheap, generated pictures are **cached in cloud storage keyed by the word**, so common words (cat, dog, sun) are only ever generated once and reused for every child.
- In the learning screen (`learn.$childId.tsx`), show the illustration above each word with a gentle loading shimmer while it renders.

## 3. Reading & speaking sentences

After the word drills, add a **Reading Time** stage to each session.

- The lesson generator (`getLesson`) will also return 2–3 short, decodable **sentences** that use the lesson's practice words.
- New phase in the session flow:
  - **Buddy reads to child** — tap to hear Buddy read the sentence aloud (text-to-speech).
  - **Read-aloud** — the child reads the sentence; Buddy listens (speech recognition), scores it, and gives warm feedback, awarding XP/coins just like the word stage.
- Sentence words are highlighted so kids connect the words they practiced to real reading.

## Technical notes
- Image generation uses a TanStack **server route** (streaming/image responses can't go through typed server functions), calling `https://ai.gateway.lovable.dev/v1/images/generations` with the existing `LOVABLE_API_KEY`. Generated PNGs are uploaded to a public storage bucket and the public URL is returned + cached.
- A new public storage bucket (e.g. `word-images`) is created via migration with a public read policy.
- `getLesson` is extended to return `sentences: string[]` alongside the existing words; the scoring reuses `scorePronunciation`.
- Session flow becomes: words → reading sentences → done, with XP/coins accumulated across both and saved via `awardProgress`.
