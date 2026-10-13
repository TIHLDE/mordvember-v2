# Mordvember – spesifikasjon

Nettside for Mordvember, arrangert av KoK i TIHLDE og utviklet av Index. Målet er at arrangørene skal bruke tiden på spillet, ikke på administrasjon.

Frist: alt ferdig før 19. oktober 2026. Én leveranse.

## Rammer

- Repo: `TIHLDE/mordvember-v2`. Eksisterende kode fjernes og erstattes. Arbeidet skjer på en egen gren og leveres som en åpen PR mot `main`. PR-en flettes ikke av den som bygger.
- Stack: Next.js 16 (App Router) på Vercel, Postgres på Neon (Vercel Marketplace) med Drizzle, Vercel Blob for bilder, Vercel Cron for tidsstyrte jobber.
- All datatilgang skjer på serveren. Nettleseren får aldri en databasenøkkel.
- Innlogging: Photon OIDC (`https://photon.tihlde.org/api/auth`). Krever PKCE, `resource`-parameter ved tokenveksling for å få JWT, og identitet fra `/oauth2/userinfo` (ikke `get-session`). Se historikken i dette repoet før omskrivingen (`src/app/api/auth/photon.ts`) for detaljene som ble funnet ut i august.
- Grupper og rolle hentes fra Photon `/groups/mine` (`membership.role` er `member` eller `leader`).
- Studieprogram og kull hentes fra Photon. Slå opp riktig endepunkt i `TIHLDE/Photon` (`apps/api/src/routes/user`).
- E-post sendes gjennom Photon sitt e-post-API med API-nøkkel (`apps/api/src/routes/email` og `api-key` i `TIHLDE/Photon`).
- Språk i grensesnittet: norsk bokmål.
- Utseende: mørkt uttrykk som fjorårets side. Sjekk lisens på fontene før de tas med.

## Roller

| Rolle | Kan | Hvem |
|---|---|---|
| Spillmester | Alt, inkludert å se og endre sirkelen | KoK-leder automatisk (Photon-rolle `leader` i KoK). Flere legges til med brukernavn i appen. |
| Arrangør | Godkjenne drap, gå gjennom fredagslista, se og rette oppmøte, avvise bilder, svare på spørsmål. Ser ikke hvem som har hvem. | Legges til i appen |
| Deltaker | Eget offer, egne drap, egen oppmøtestatus | Alle påmeldte |

- KoK-leder og Index-leder kan alltid legge til og fjerne spillmestere og arrangører. Det gir ikke innsyn i sirkelen.
- En spillmester kan ikke være deltaker i samme sesong, og omvendt.
- Index-leder kan være deltaker. Index-leder har nødtilgang som må slås på aktivt: krever begrunnelse, varer én time, logges, og spillmesterne varsles. Uten aktiv nødtilgang har Index-leder ingen innsyn utover en vanlig deltaker.
- Alt innsyn i og alle endringer av sirkelen logges med hvem og når.
- Sirkelen skal ikke kunne leses ut av noe svar, noen side eller noe API-kall en deltaker eller arrangør kan gjøre. Deltakerne er dyktige programmerere. Et svar til en deltaker inneholder aldri mer enn deltakerens eget nåværende offer.

## Sesong

Alle data hører til en sesong. Fasene flyttes fram manuelt av en spillmester:

1. Oppsett
2. Påmelding åpen
3. Påmelding stengt
4. Spill pågår
5. Avsluttet

- Påmeldingsfristen stenger påmeldingen automatisk. Øvrige overganger krever et trykk.
- «Ny sesong» oppretter en tom sesong og sletter ikke den forrige.
- «Slett sesongdata» er en egen knapp som krever at sesongnavnet skrives inn. Den fjerner bilder, navn, sirkel, drap, oppmøte og spørsmål. Igjen står antall deltakere, antall drap og varighet. Vinneren beholdes bare med vinnerens samtykke.
- Appen minner spillmesterne på sletting 30 dager etter avslutning.
- En eliminert deltaker kan be om å få bildet sitt slettet.

## Påmelding

- Innlogging med TIHLDE-bruker er eneste vei inn.
- Navn hentes fra Photon og kan ikke endres.
- Studieprogram og kull hentes fra Photon og vises til bekreftelse. Knappen «Dette stemmer ikke» sender e-post til `teknologiminister@tihlde.org`. Påmeldingen går gjennom uansett.
- Bilde: profilbildet fra TIHLDE er standard. Deltakeren oppfordres til å bruke et bilde der ansiktet vises tydelig og utildekket, og kan laste opp et annet. Det opplastede bildet lagres bare hos Mordvember og endrer ingenting i Photon.
- Arrangører kan avvise et bilde med en kort melding.
- Samtykke ved påmelding: navn og bilde vises for innloggede TIHLDE-medlemmer og på skjermen på kontoret, og slettes etter arrangementet.
- Fri avmelding fram til fristen. Etter fristen kan bare spillmestere legge til eller fjerne deltakere.
- Nye deltakere vises i rutenettet uten kodeendring.

## Sirkel

- Genereres tilfeldig i fasen «Påmelding stengt». Hver deltaker har nøyaktig ett offer, og sirkelen er én sammenhengende ring.
- Spillmestere kan trekke på nytt og flytte deltakere manuelt før start.
- E-post om første offer sendes når fasen settes til «Spill pågår».
- Alle endringer i sirkelen lagres som hendelser, slik at de kan angres og sirkelen settes tilbake.

## Mitt offer

- Forsiden viser ingenting om offeret.
- Deltakeren går inn på en egen side og holder inne en knapp for å vise navn og bilde. Når knappen slippes, skjules det.
- Varsel i appen og på e-post ved nytt offer. E-posten nevner aldri hvem offeret er.

## Drap

- Både morder og offer kan melde først. Den andre får e-post og et varsel øverst i appen med «Bekreft» og «Dette stemmer ikke».
- Morderen kan bare melde drap på sitt eget offer. Serveren sjekker det. Skjemaet har ingen navneliste.
- Offeret får vite at noen har meldt hen drept, ikke hvem.
- Melderen oppgir drapstidspunkt.
- Ingenting endres før drapet er bekreftet av begge eller godkjent av en admin. Offeret lever og kan selv drepe i mellomtiden.
- Uten svar innen 12 timer går saken til arrangørene. «Dette stemmer ikke» sender den dit med en gang.
- Kolliderende drap (for eksempel at et offer melder et eget drap med tidspunkt etter sitt eget dødstidspunkt) flagges til arrangørene. Systemet avgjør ikke selv.
- Ved gyldig drap: offeret elimineres, morderen overtar offerets offer, drapstallet øker, og tidspunkt lagres.
- Lagres per drap: morder, offer, drapstidspunkt, bekreftelsestidspunkt og hvem som godkjente.
- Spillmestere kan angre et drap. Sirkelen settes da tilbake.
- Når to står igjen, har de hverandre. Vinneren kåres ved siste gyldige drap.

### Nåde

- En eliminert eller ny spiller X settes inn mellom to levende A → B, slik at det blir A → X → B.
- Plassen trekkes tilfeldig som standard. Spillmesteren kan velge plass.
- A får varsel om nytt offer, X får B.
- Drapstall endres ikke.
- Krav til oppmøte og drap gjelder for X fra uka etter.

## Oppmøte

- En roterende QR-kode vises på tavleskjermen på kontoret. Koden byttes hvert 15. sekund og gjelder bare sitt eget vindu pluss noen sekunder slingring.
- Webappen har en innebygd QR-skanner. Koden er også en lenke som virker med mobilens vanlige kamera. Hvis deltakeren ikke er innlogget, godkjenner serveren koden når lenken åpnes og husker det i ti minutter, slik at innsjekken fullføres etter innlogging.
- Første skanning sjekker inn, neste sjekker ut.
- Innsjekk og utsjekk vises med navn og bilde på tavla i noen sekunder.
- Mobilen spør om posisjon ved skanning. Posisjon langt fra kontoret eller nektet posisjon stopper ikke innsjekken, men merker den for arrangørene.
- En dag teller når deltakeren har minst to timer sammenhengende mellom 08.00 og 16.00. Uka går mandag til fredag. Kravet er to tellende dager.
- Glemt utsjekk: økten lukkes kl. 16.00, merkes «ikke sjekket ut» og teller ikke uten manuell godkjenning.
- Deltakeren ser egen status for uka og dagens økt.
- Arrangører kan rette oppmøte manuelt og underkjenne merkede innsjekker.
- Tidssone: Europe/Oslo.

## Ukentlig sjekk

- Torsdag kl. 16.00: advarsel på e-post til deltakere som ligger an til å ryke, med hva som mangler.
- Fredag kl. 16.00: systemet lager lista over deltakere som ikke oppfyller ukas krav, med grunn per person.
- Deltakere som har nådd kravet, er automatisk godkjent og står ikke på lista. En admin kan likevel diskvalifisere hvem som helst manuelt.
- Deltakere som ikke har nådd kravet, må gås gjennom av en admin, som velger «diskvalifiser» eller «unntak» med begrunnelse. Ingen ryker automatisk.
- Arrangører og spillmestere kan gå gjennom lista.
- Ved diskvalifisering tas deltakeren ut av sirkelen. Jegeren overtar offeret og får varsel. Ingen får drapspoeng. Ryker flere på rad, hopper jegeren til neste levende.
- En deltaker med en uavklart drapssak kan ikke diskvalifiseres før saken er avgjort.

### Regler per uke

Stilles inn i adminpanelet og kan endres for en enkelt uke.

| Innstilling | Standard |
|---|---|
| Antall oppmøtedager | 2 |
| Timer sammenhengende | 2 |
| Tidsvindu | 08.00–16.00 |
| Drap som kreves | 0 |

## Adminpanel

- Spillmester: se hele sirkelen, flytte ofre, endre status, gi nåde, angre drap og andre feilregistreringer, styre sesongfaser, ukeregler, milepæler, statistikkbrytere, roller og skjermlenke.
- Arrangør: saker til godkjenning, fredagslista, oppmøte, bildegodkjenning og spørsmål. Ingen visning som avslører hvem som har hvem.
- Revisjonslogg over alle adminhandlinger.

## Tavle

- Egen fullskjermsvisning som åpnes med en hemmelig skjermlenke. Lenken lages av en spillmester og kan trekkes tilbake.
- Rutenett med alle deltakere: levende i farger, eliminerte i svart-hvitt. Viser ikke forskjell på drept og diskvalifisert.
- Antall spillere igjen.
- Roterende QR-kode.
- Navn og bilde ved innsjekk og utsjekk.
- Milepælkunngjøringer i fullskjerm.
- Henter nye data hvert tiende sekund.
- Eliminerte blir svart-hvite med en tilfeldig forsinkelse på 15–60 minutter, slik at tidspunktet ikke avslører hvem som tok hvem. Drapet teller fra riktig tidspunkt.
- Avslører aldri hvem som har tatt hvem.
- Statistikk med egen av/på-bryter for hver: drap i dag (på), tid siden siste drap (på), dagens morder (av).

## Milepæler

- 50 % igjen, 25 % igjen, 10 igjen, 3 igjen og vinner.
- Vises på tavla og sendes på e-post til alle påmeldte, også eliminerte.
- Grensene kan endres i innstillingene. E-post kan slås av per milepæl.

## Hvem ser hva

| Hvem | Ser |
|---|---|
| Ikke innlogget | Forside med regler, datoer, antall spillere igjen og innlogging. Ingen navn eller bilder. |
| Innlogget medlem som ikke spiller | Deltakerrutenettet, og påmelding før fristen |
| Deltaker | Det samme, pluss «Mitt offer», drapsmelding, oppmøte og egne varsler |
| Eliminert deltaker | Rutenettet og egen historikk |

Bilder serveres gjennom en innlogget rute eller skjermlenken. Blob-adresser skal ikke kunne gjettes eller åpnes uten tilgang.

## E-post

| Hendelse | Mottaker |
|---|---|
| Spillet starter, første offer er klart | Alle deltakere |
| Nytt offer | Deltakeren |
| Noen har meldt et drap du er part i, bekreft | Den andre parten |
| Advarsel før fredagssjekken | Deltakere som ligger an til å ryke |
| Diskvalifisert eller eliminert | Deltakeren |
| Bilde avvist | Deltakeren |
| Feil studie eller kull | `teknologiminister@tihlde.org` |
| Sak til godkjenning, nytt spørsmål | Spillmestere og arrangører |
| Milepæl | Alle påmeldte |
| Nødtilgang aktivert | Spillmestere |

Malene kan redigeres i adminpanelet. Varsler vises også i appen.

## Spørsmål til spillmesterne

- Skjema i appen. Spillmestere og arrangører får e-post og ser spørsmålet i en innboks.
- Svaret går privat til den som spurte, i appen og på e-post.
- Admin kan publisere spørsmål og svar anonymt på en side med ofte stilte spørsmål.

## Utvikling og verifisering

- Lokal Postgres med oppdiktede deltakere. Ingen ekte navn, bilder eller andre personopplysninger i repoet, i testdata, i commits eller i PR-en.
- Utviklerinnlogging som lar en velge testbruker. Den skal ikke kunne slås på i produksjon, heller ikke med en miljøvariabel.
- Spillmotoren (sirkel, drap, kollisjoner, angring, nåde, diskvalifisering av flere på rad, oppmøteregelen, ukesjekken) skrives som rene funksjoner og testes uttømmende, inkludert at sirkelen alltid er én ring over alle levende.
- Gjennomkjøring i nettleser av hele spillet fra påmelding til vinner.
- Egen kontroll av at ingen side eller rute gir en deltaker eller arrangør mer enn deltakerens eget offer.
- Typesjekk, lint og bygg skal være grønne.
- Ingen hemmeligheter i repoet. `.env.example` lister alt som trengs.

## Gjenstår for eier etter PR

- Vercel-prosjekt med Neon og Blob.
- Miljøvariabler: Photon klient-ID og hemmelighet, e-post-API-nøkkel, hemmelighet for QR-koder og skjermlenke.
- Returadresser i Photon-klienten for produksjon og forhåndsvisning.
- Domene.
- Én ekte innlogging og én ekte e-post for å bekrefte koblingen mot Photon.
