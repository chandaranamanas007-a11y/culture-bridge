# Culture Bridge — India × Mauritius

A live, Kahoot-style quiz built for the Interact Beyond Borders workshop.
One person hosts and shares their screen; everyone else joins on their own
phone or laptop with a 4-letter room code. Questions cover festivals, food,
language, and shared values across Gujarat and Mauritius, and can be edited
freely in `src/data/questions.js`.

It's a normal Vite + React site, so it deploys to Vercel for free. The
"live" part (everyone seeing the same question at the same time) is powered
by a free Firebase Realtime Database — you need your own free Firebase
project for this to work.

## 1. Create a free Firebase project (5 minutes)

1. Go to https://console.firebase.google.com and sign in with a Google account.
2. Click **Add project**, give it any name (e.g. `culture-bridge`), and finish setup (you can skip Google Analytics).
3. In the left sidebar, go to **Build → Realtime Database**, click **Create Database**, choose any region, and start in **test mode** (fine for a short-lived event — see step 6 to lock it down after).
4. In the left sidebar, click the gear icon → **Project settings**. Under "Your apps", click the **</> (Web)** icon to register a new web app (any nickname). It will show you a `firebaseConfig` object with values like `apiKey`, `authDomain`, `databaseURL`, etc. — keep this tab open, you'll need these values next.

## 2. Run it locally (optional, to test before deploying)

```bash
npm install
cp .env.example .env
# paste your firebaseConfig values into .env
npm run dev
```

Open the printed localhost URL in two browser tabs — one as `/host`, one as `/play` — to try it end-to-end.

## 3. Deploy to Vercel

**Easiest path (no terminal):**

1. Push this folder to a new GitHub repository (or use GitHub's "upload files" web UI to drag the whole folder in).
2. Go to https://vercel.com, sign in, click **Add New → Project**, and import that repository. Vercel auto-detects Vite — leave the defaults.
3. Before deploying, expand **Environment Variables** and add each key from `.env.example` (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, etc.) with the values from your Firebase config.
4. Click **Deploy**. You'll get a URL like `https://culture-bridge-xyz.vercel.app`.

**Or with the Vercel CLI:**

```bash
npm install -g vercel
vercel
# follow the prompts, then add the same env vars when asked,
# or afterwards via `vercel env add`
```

## 4. Running the actual session

1. Host opens `your-site.vercel.app/host`, clicks **Create room**, and shares their screen on the call.
2. Everyone else opens `your-site.vercel.app/play` on their own device, enters the room code shown on the host's screen, their name, and which country they're joining from.
3. Host clicks **Start game** once enough players have joined.
4. For each question: give players time to answer, click **Reveal answer** to lock it and show the live tally + explanation, then **Next question**.
5. After the last question, everyone sees the final leaderboard automatically.

## 5. Editing the questions

Open `src/data/questions.js` — each question is a plain object with a
prompt, 4 options, the correct index, and a short explanation shown after
reveal. Add, remove, or rewrite freely; no other code needs to change.
This is a great task to hand to a couple of Organisation Committee
volunteers — have the Mauritius club contribute questions about their own
culture so it's genuinely two-way.

## 6. Locking down the database after the event (optional)

Test mode leaves the database open to anyone with the URL. Once the
workshop series is done, go to Realtime Database → **Rules** in Firebase
and set:

```json
{
  "rules": {
    ".read": false,
    ".write": false
  }
}
```

or simply delete the Firebase project if you won't reuse it.
