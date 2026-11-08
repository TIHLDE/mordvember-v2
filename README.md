# Mordvember

Nettsiden for Mordvember i TIHLDE.

TanStack Start med Vite og Nitro, Postgres med Drizzle, Vercel Blob for bilder og Vercel Cron for tidsstyrte jobber. All datatilgang skjer på serveren.

## Kom i gang lokalt

```bash
pnpm install
docker compose up -d --wait       # lokal Postgres, passer med DATABASE_URL i .env.example
cp .env.example .env.local        # fyll inn QR_SECRET
pnpm db:migrate
pnpm db:seed                   # oppdiktede testbrukere og en testsesong
pnpm dev
```

Gå til `/login` og velg «velg testbruker». Utviklerinnloggingen finnes bare med `pnpm dev`. I et produksjonsbygg kaller både siden og handlingen `notFound()` uten betingelse, så den kan ikke slås på med en miljøvariabel.

Uten `BLOB_READ_WRITE_TOKEN` lagres opplastede bilder i `.data/uploads` under utvikling. Uten `PHOTON_EMAIL_API_KEY` skrives e-post til konsollen i stedet for å sendes.

Bygg med `pnpm build`, og kjør Nitro-serveren med `pnpm start`. Kjør `E2E_BASE=http://localhost:3000 pnpm test:start-smoke` mot et kjørende produksjonsbygg for å kontrollere HTTP-status, omdirigeringer, cookies og opplastingsgrenser uten database.

Vercel-oppsettet peker fortsatt på Next-bygget og må velges om separat før utrulling. Se `MIGRATION.md`.

## Tester

| Kommando | Hva |
|---|---|
| `pnpm test` | Spillmotoren (sirkel, drap, kollisjoner, angring, nåde, diskvalifisering, oppmøte, ukesjekk) og en statisk kontroll av hvem som får lese sirkelen |
| `TEST_DATABASE_URL=… pnpm test` | Tar også med tilgangstester mot en egen database. Databasen tømmes. |
| `pnpm test:e2e` | Hele spillet i nettleser, fra påmelding til vinner. Krever `pnpm dev` og ferske testdata. |
| `pnpm test:photon` | Ekte innlogging og e-post mot en lokal etterligning av Photon (`pnpm photon:mock`). Start `pnpm dev` med `PHOTON_ISSUER=http://localhost:4010/api/auth`, `PHOTON_CLIENT_ID=mordvember-test`, `PHOTON_CLIENT_SECRET=mock-hemmelighet` og `PHOTON_EMAIL_API_KEY=mock-epostnokkel`. |
| `pnpm test:leak` | Henter alle sider som deltaker, eliminert, medlem, Index-leder og ikke innlogget, og ser etter lekkasje av sirkelen. Krever ferske testdata. |

## Oppbygning

- `src/game` – spillmotoren som rene funksjoner, uten database.
- `src/server` – tjenester med tilgangskontroll. `circle.ts` er den eneste modulen som leser sirkelen.
- `src/app` – sider, ruter og serverhandlinger. Handlingene er tynne og kaller tjenestene.
- `drizzle` – migreringer. Lag nye med `pnpm db:generate` etter endringer i `src/db/schema.ts`.

## Sirkelen

Sirkelen ligger som én ordnet liste per sesong. Alle endringer skjer i en transaksjon med radlås, og hver endring lagres som en hendelse med listen før og etter. En deltaker får bare sitt eget nåværende offer, og bare etter å ha trykket på knappen, til det skjules igjen. Det samme gjelder om offeret er sjekket inn akkurat nå, som ingen andre deltakere kan se. Spillmestere ser det for alle på deltakersiden. Bare spillmestere, og Index-leder med aktiv nødtilgang, får se sirkelen. Hver visning logges.

## Drift

`vercel.json` kjører `/api/cron` hvert tiende minutt. Jobben stenger påmeldinger, lukker glemte utsjekker, sender drapssaker videre etter 12 timer, sender ukevarsel når deltakerne må møte de resterende dagene og lager fredagslista og sender e-post. Kallet krever `CRON_SECRET`, som Vercel setter selv.
