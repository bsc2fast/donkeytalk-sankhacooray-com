# donkeytalk.sankhacooray.com

Marketing site for Donkey Talk, a Mac app that turns anyone who talks in a
quiet room into a donkey on a wall screen, voice by voice, with live
transcripts and a kind librarian asking for silence. A Cloudflare Worker:
static files in `public/`, `/api/*` handled by `src/index.js`, enquiries
stored in D1.

The app itself is **not** in this repo. It is a private build that runs
locally on one Mac; this page only shows screenshots of it and collects
enquiries from librarians, educators and anyone who values the idea.

```sh
npm install
npm run dev        # http://localhost:4872 (local D1; run `npm run db:local` once)
npm run deploy     # needs CLOUDFLARE_API_TOKEN or `npx wrangler login`
npm run db:init    # creates the enquiries table in the remote D1 (once)
npx wrangler secret put ENQUIRY_KEY   # bearer key for reading enquiries over HTTP
```

## Enquiries

- `POST /api/enquire` with JSON `{ name, email, org, role, space, message }`.
  `role` is one of librarian, educator, facilities, student, other.
  Honeypot field `website`; one enquiry per email or IP per minute.
- `GET /api/enquiries[?status=new&limit=100]` with `Authorization: Bearer <ENQUIRY_KEY>`.
- `POST /api/enquiries/:id/status` `{ "status": "new|contacted|qualified|closed|spam" }`.
- From the terminal: `ENQUIRY_KEY=… npm run enquiries [status]`.
- Or straight from D1:
  `npx wrangler d1 execute donkeytalk --remote --command "select id,at,name,email,org,role,space,status from enquiries order by at desc"`.

## Page

One HTML file, `public/index.html`, laid out as screen-fit groups
(`public/screen-fit.js` packs sections into whole screens and pages with the
arrow keys). Light and dark themes with a switch in the app bar; `?theme=light`
forces one for screenshots. Scene images in `public/assets/scene-*.jpg` are
screenshots of the app's demo mode.

## Share card and icons

`public/assets/og-card.jpg` (1200×630) is rendered from `og/og-card.html`:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
  --allow-file-access-from-files --force-device-scale-factor=1 --window-size=1200,630 \
  --virtual-time-budget=6000 --screenshot=$PWD/og/og-card.png file://$PWD/og/og-card.html
sips -s format jpeg -s formatOptions 85 og/og-card.png --out public/assets/og-card.jpg
```

Bump `?v=N` on the `og:image` URLs after changing it so chat apps refetch.
Icons: `public/assets/icon.svg` is the logo; the 192, 512 and 180 PNGs are
rendered from it, the maskable 512 from `og/icon-maskable.svg` (logo inside
the central 60%).
