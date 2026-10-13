# Mordvember

Nettsiden for Mordvember i TIHLDE. Spesifikasjonen ligger i [docs/SPEC.md](docs/SPEC.md).

Next.js 16 (App Router), Postgres med Drizzle, Vercel Blob for bilder og Vercel Cron for tidsstyrte jobber. All datatilgang skjer på serveren.

## Kom i gang lokalt

```bash
npm install
cp .env.example .env.local        # fyll inn DATABASE_URL og QR_SECRET
npm run db:migrate
npm run db:seed                   # oppdiktede testbrukere og en testsesong
npm run dev
```

Gå til `/login` og velg «velg testbruker». Utviklerinnloggingen finnes bare med `next dev`. I et produksjonsbygg kaller både siden og handlingen `notFound()` uten betingelse, så den kan ikke slås på med en miljøvariabel.

Uten `BLOB_READ_WRITE_TOKEN` lagres opplastede bilder i `.data/uploads` under utvikling. Uten `PHOTON_EMAIL_API_KEY` skrives e-post til konsollen i stedet for å sendes.

## Tester

| Kommando | Hva |
|---|---|
| `npm test` | Spillmotoren (sirkel, drap, kollisjoner, angring, nåde, diskvalifisering, oppmøte, ukesjekk) og en statisk kontroll av hvem som får lese sirkelen |
| `TEST_DATABASE_URL=… npm test` | Tar også med tilgangstester mot en egen database. Databasen tømmes. |
| `npm run test:e2e` | Hele spillet i nettleser, fra påmelding til vinner. Krever `npm run dev` og ferske testdata. |
| `npm run test:leak` | Henter alle sider som deltaker, eliminert, arrangør, medlem, Index-leder og ikke innlogget, og ser etter lekkasje av sirkelen. Krever ferske testdata. |

## Oppbygning

- `src/game` – spillmotoren som rene funksjoner, uten database.
- `src/server` – tjenester med tilgangskontroll. `circle.ts` er den eneste modulen som leser sirkelen.
- `src/app` – sider, ruter og serverhandlinger. Handlingene er tynne og kaller tjenestene.
- `drizzle` – migreringer. Lag nye med `npm run db:generate` etter endringer i `src/db/schema.ts`.

## Sirkelen

Sirkelen ligger som én ordnet liste per sesong. Alle endringer skjer i en transaksjon med radlås, og hver endring lagres som en hendelse med listen før og etter. En deltaker får bare sitt eget nåværende offer, og bare mens knappen holdes inne. Arrangører ser aldri hvem som har hvem. Bare spillmestere, og Index-leder med aktiv nødtilgang, får se sirkelen. Hver visning logges.

## Drift

`vercel.json` kjører `/api/cron` hvert tiende minutt. Jobben stenger påmeldinger, lukker glemte utsjekker, sender drapssaker videre etter 12 timer, sender torsdagsvarsel og lager fredagslista, sender milepæl-e-post og påminnelse om sletting. Kallet krever `CRON_SECRET`, som Vercel setter selv.
