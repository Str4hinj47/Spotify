# OVERTAKE website
Static marketing site + live leaderboard. Deploy this folder at `/` and the game
(`cd ../overtake && npm run build` → `dist/`) at `/play/` on the same domain
(Vercel/Cloudflare Pages rewrites or two static mounts). Then in Supabase
Dashboard → Auth → URL Configuration set Site URL + redirect allowlist to that
domain (production sign-up links depend on it).
