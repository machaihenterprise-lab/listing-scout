Testing notes

This file contains quick, manual test steps for the `/api/messages` route and the conversation UI.

1) Start the dev server

```bash
npm run dev
```

2) Smoke test the `/api/messages` endpoint (integration test)

- Replace `<leadId>` with a real lead id present in your Supabase DB.

```bash
node scripts/test-messages-api.js <leadId>
```

- Expected: HTTP 200 and a JSON body `{ ok: true, data: [...] }` (or array) printed to stdout.

3) UI verification

- Open `http://localhost:3000` in your browser.
- Select a lead in the left column — the conversation area should show a spinner while messages load, then the messages for that lead.
- Add a new lead via Quick Add / Add Lead modal — the left tab should switch to the new lead's status and the lead should become selected.

Notes

- The test script expects the dev server to be reachable at `http://localhost:3000`.
- The server-side API uses `SUPABASE_SERVICE_ROLE_KEY` to query messages; ensure it's set in your environment when running the Next.js server.
