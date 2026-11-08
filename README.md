# Mordvember

Nettsiden for Mordvember i TIHLDE.

TanStack Start med Vite Plus og Nitro, Postgres med Drizzle, Vercel Blob for bilder og Vercel Cron for tidsstyrte jobber. All datatilgang skjer på serveren.

## Kom i gang lokalt

```bash
vp install
docker compose up -d --wait       # lokal Postgres, passer med DATABASE_URL i .env.example
cp .env.example .env.local        # fyll inn QR_SECRET
vp run db:migrate
vp run db:seed                   # oppdiktede testbrukere og en testsesong
vp dev
```

Gå til `/login` og velg «velg testbruker». Utviklerinnloggingen finnes bare med `vp dev`. I et produksjonsbygg kaller både siden og handlingen `notFound()` uten betingelse, så den kan ikke slås på med en miljøvariabel.

Uten `BLOB_READ_WRITE_TOKEN` lagres opplastede bilder i `.data/uploads` under utvikling. Uten `PHOTON_EMAIL_API_KEY` skrives e-post til konsollen i stedet for å sendes.

Bygg med `vp build`, og kjør Nitro-serveren med `vp run start`. Kjør `E2E_BASE=http://localhost:3000 vp run test:start-smoke` mot et kjørende produksjonsbygg for å kontrollere HTTP-status, omdirigeringer, cookies og opplastingsgrenser uten database.

`vite.config.ts` samler bygg, tester, Oxlint og Oxfmt. Bruk `vp check` for format, lint og typer, og `vp fmt` for å formatere. Avhengigheter håndteres med `vp install`, `vp add`, `vp remove` og `vp update`; pnpm brukes under panseret. Installer den globale `vp`-kommandoen fra https://viteplus.dev/guide om den mangler. Node-versjonen styres av `.node-version`.

Vercel bruker TanStack Start og `vp run build:vercel`, som beholder produksjonssjekken og databasemigreringen før bygget.

## Tester

| Kommando                      | Hva                                                                                                                                                                                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vp test`                     | Spillmotoren (sirkel, drap, kollisjoner, angring, nåde, diskvalifisering, oppmøte, ukesjekk) og en statisk kontroll av hvem som får lese sirkelen                                                                                                                                |
| `TEST_DATABASE_URL=… vp test` | Tar også med tilgangstester mot en egen database. Databasen tømmes.                                                                                                                                                                                                              |
| `vp run test:e2e`             | Hele spillet i nettleser, fra påmelding til vinner. Krever `vp dev` og ferske testdata.                                                                                                                                                                                          |
| `vp run test:photon`          | Ekte innlogging og e-post mot en lokal etterligning av Photon (`vp run photon:mock`). Start `vp dev` med `PHOTON_ISSUER=http://localhost:4010/api/auth`, `PHOTON_CLIENT_ID=mordvember-test`, `PHOTON_CLIENT_SECRET=mock-hemmelighet` og `PHOTON_EMAIL_API_KEY=mock-epostnokkel`. |
| `vp run test:leak`            | Henter alle sider som deltaker, eliminert, medlem, Index-leder og ikke innlogget, og ser etter lekkasje av sirkelen. Krever ferske testdata.                                                                                                                                     |

## Oppbygning

- `src/game` – spillmotoren som rene funksjoner, uten database.
- `src/server` – tjenester med tilgangskontroll. `circle.ts` er den eneste modulen som leser sirkelen.
- `src/app` – sider, ruter og serverhandlinger. Handlingene er tynne og kaller tjenestene.
- `drizzle` – migreringer. Lag nye med `vp run db:generate` etter endringer i `src/db/schema.ts`.

## Sirkelen

Sirkelen ligger som én ordnet liste per sesong. Alle endringer skjer i en transaksjon med radlås, og hver endring lagres som en hendelse med listen før og etter. En deltaker får bare sitt eget nåværende offer, og bare etter å ha trykket på knappen, til det skjules igjen. Det samme gjelder om offeret er sjekket inn akkurat nå, som ingen andre deltakere kan se. Spillmestere ser det for alle på deltakersiden. Bare spillmestere, og Index-leder med aktiv nødtilgang, får se sirkelen. Hver visning logges.

## Drift

`scheduledTasks` i `vite.config.ts` kjører Nitro-oppgaven `game:cron` hvert tiende minutt. Samme plan kjører lokalt under `vp dev`/Nitro-serveren og genererer Vercel Cron Jobs ved Vercel-bygg. Jobben stenger påmeldinger, lukker glemte utsjekker, sender drapssaker videre etter 12 timer, sender ukevarsel når deltakerne må møte de resterende dagene og lager fredagslista og sender e-post. Sett `CRON_SECRET` i Vercel-prosjektet for både produksjon og preview; Vercel sender den i Authorization-headeren til Nitros genererte `/_vercel/cron`-endepunkt. Det eksisterende `/api/cron`-endepunktet beholdes for autentiserte manuelle kall.
