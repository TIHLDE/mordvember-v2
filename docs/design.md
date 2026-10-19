# Designsystem

Dette er fasiten for hvordan Mordvember ser ut og oppfører seg. Når du lager en
ny side eller et nytt skjema: finn nærmeste eksempel her og gjør likt.

Dokumentet beskriver koden slik den er. Er dokumentet og koden uenige, gjelder
koden. Da retter du dokumentet. Legg ikke inn farger eller mål her som ikke
allerede brukes i koden.

Gjelder spillersidene (`src/app/(site)`) og adminpanelet (`src/app/admin`).
Tavla på kontoret (`src/app/tavle`) er laget for en stor skjerm på avstand og
følger sine egne mål. Se [Tavla](#10-tavla).

---

## 1. Grunnprinsipper

1. **Mørkt og rolig.** Svart bunn, hvite flater med lav dekkevne og én
   aksentfarge: blodrød. Rødt betyr «gjør dette» eller «noe er galt». Bruk det
   ikke til pynt.
2. **Ingen kort inni kort.** Inne i et `Card` deler du opp med
   `divide-y divide-white/5`, ikke med nye bokser med ramme.
3. **Ingenting scroller sidelengs.** Ikke siden, ikke menyene, ikke tabeller.
   Rader brytes til neste linje (`flex-wrap`). Tabeller med handlinger i hver
   rad blir lister (se `admin/deltakere`).
4. **Mobil først.** De fleste spillere bruker mobilen. Alt skal fungere i 375 px
   bredde før det pyntes for desktop.
5. **Respons med én gang.** Knapper krymper litt når du trykker. Skjemaet låses
   mens det sendes. Svaret vises rett under skjemaet.

---

## 2. Farger

Alle tokens ligger i `src/app/globals.css` under `@theme`.

| Rolle | Klasse | Verdi |
|---|---|---|
| Sidebunn | `bg-ink` | `#0b0b0d`, med en rødlig radialgradient øverst |
| Aksent | `bg-blood` / `text-blood` | `#b3121b` |
| Aksent, hover | `bg-blood-light` | `#d01f29` |
| Flate (kort) | `bg-white/[0.03]` | |
| Hårstrek | `border-white/10`, inne i kort `divide-white/5` | |
| Tekst, sterk | `text-white` | Navn, titler, verdier |
| Tekst, vanlig | `text-zinc-300` | Brødtekst |
| Tekst, dempet | `text-zinc-400` | Undertitler, forklaringer |
| Tekst, hjelp | `text-zinc-500` | Metadata, tidspunkt, hint |

Statusfarger finnes bare i `Badge` og `Notice`: `red`, `amber`, `green` og
`zinc`. Ikke lag nye fargekombinasjoner på stedet.

Fokus vises med en rød ring (`:focus-visible` i `globals.css`). Fjern den
aldri uten å erstatte den.

---

## 3. Typografi

| Nivå | Klasse | Hvor |
|---|---|---|
| Sidetittel | `PageTitle` (`font-display text-4xl sm:text-5xl text-blood`) | Én per side |
| Undertittel | `PageTitle sub` (`text-zinc-400`, `max-w-prose`) | Rett under tittelen |
| Korttittel | `Card title` (`text-lg font-semibold tracking-tight`) | |
| Brødtekst | `text-sm` | Alt innhold i kort |
| Hjelpetekst | `text-xs text-zinc-500` | Hint under felt, tidspunkt |
| Store tall | `text-3xl font-semibold tabular-nums` eller `font-display text-6xl` | Statistikk |

- Creepster (`font-display`) brukes **bare** til logo, sidetitler og store tall
  på forsiden og tavla. Aldri i knapper, etiketter eller brødtekst.
- Tall som endrer seg eller står i kolonner får `tabular-nums`.
- Lange titler og undertitler får `text-balance` / `text-pretty` (ligger
  allerede i `PageTitle`).

---

## 4. Avstand

| Hva | Klasse |
|---|---|
| Sidebredde, spillersider | `max-w-5xl` (smale sider: `max-w-xl`, `max-w-2xl` eller `max-w-md`) |
| Sidebredde, admin | `max-w-7xl` ved siden av menyen (ligger i `AdminShell`) |
| Luft over innholdet | `pt-8`, under `pb-16` (ligger i layoutene) |
| Mellom tittel og innhold | `mb-8` (ligger i `PageTitle`) |
| Mellom kort på en side | `space-y-6` på ytterste `div` |
| Rutenett av kort | `grid gap-4` |
| Innvendig i kort | `p-5 sm:p-6` (ligger i `Card`) |
| Mellom felt i et skjema | `space-y-4` |
| Mellom knapper på rad | `flex flex-wrap gap-2` |
| Rad i en liste | `py-2.5` til `py-4`, med `first:pt-0 last:pb-0` |
| Mellom avsnitt og knapp under | `mb-4` på avsnittet |

Bruk 4-, 6- og 8-trinnene i Tailwind. Unngå `mt-1`/`mb-2` mellom større
blokker. Det var hovedgrunnen til at sidene så trange ut før.

---

## 5. Hjørner

| Element | Radius |
|---|---|
| Kort, bilder i kort, varselbokser | `rounded-2xl` / `rounded-xl` |
| Knapper, felt, menylenker | `rounded-lg` |
| Merker (`Badge`) | `rounded-md` |
| Avatar, telleboble, holdeknappen på «Mitt offer» | `rounded-full` |

---

## 6. Komponenter

Alt ligger i `src/components/ui.tsx`. Bruk dem. Skriv ikke en rå
`<button className="bg-...">` eller et eget input-oppsett.

### Knapper – `Button`, `LinkButton`, `buttonClass()`

| Variant | Brukes til |
|---|---|
| `primary` (standard) | Hovedhandlingen. Helst én per kort. |
| `ghost` | Sidestilte handlinger: «Avvis», «Tilbake», «Flytt» |
| `danger` | En enkelt destruktiv handling: «Meld meg av», «Slett data» |
| `danger-ghost` | Destruktiv handling som går igjen i hver rad i en lang liste, så siden ikke blir en vegg av rødt |

| Størrelse | Mål | Brukes til |
|---|---|---|
| `md` (standard) | `min-h-10` (40 px) | Alt i vanlige skjemaer |
| `sm` | `min-h-8` (32 px) | Tette rader i adminlister, ukenavigasjon |

- `min-h` og ikke fast høyde, så lange etiketter kan bryte linja på mobil.
- Trykk gir `active:scale-[0.97]`, men ikke når brukeren har slått av bevegelse.
- En lenke som ser ut som en knapp er `LinkButton`. Trenger du klassene på noe
  annet (for eksempel «Logg inn» i headeren), bruk `buttonClass()`.

### Skjema – `ActionForm`, `Field`, `inputClass`, `Checkbox`

```tsx
<ActionForm action={someAction} className="space-y-4" confirm="Er du sikker?">
  <Field label="Når skjedde det?" hint="Valgfri hjelpetekst">
    <input type="datetime-local" name="killedAt" className={inputClass} />
  </Field>
  <Checkbox name="consent" required>Jeg godtar …</Checkbox>
  <Button type="submit">Lagre</Button>
</ActionForm>
```

- `className` på `ActionForm` styrer oppsettet av feltene. Svaret («Lagret»
  eller en feilmelding) havner alltid **under** feltene, også når feltene står
  på én rad.
- Mens skjemaet sendes er alle felt og knapper låst. Ikke lag egen «Laster»-tekst.
- `inputClass` er fullbredde. Skal feltet ha en annen bredde, bruk
  `` `${inputBase} w-20` `` (eller `w-auto`, `w-44`). Å legge en bredde på
  `inputClass` virker ikke, fordi `w-full` vinner.
- Felt har 16 px tekst på mobil (`text-base sm:text-sm`). Ellers zoomer iOS
  inn på siden når feltet får fokus.
- Et felt uten synlig etikett skal ha `aria-label`. Plassholdertekst er ikke en
  etikett.
- Avkrysning er alltid `Checkbox`. Hele teksten er klikkbar.

### Rad-skjema

Når et felt og en knapp hører sammen på én linje:

```tsx
<ActionForm action={addStaffAction} className="flex flex-wrap gap-2">
  <input name="username" aria-label="TIHLDE-brukernavn" className={`${inputClass} min-w-48 flex-1`} />
  <Button type="submit">Legg til</Button>
</ActionForm>
```

`min-w-48 flex-1` gjør at feltet tar plassen som er igjen, men bryter til egen
linje før det blir for smalt. Står flere felt på rad, pakk dem i `Field` med
`items-end` på raden, så etikettene står over (se «Legg inn oppmøte manuelt»).

### Merker og meldinger – `Badge`, `Notice`, `Empty`

- `Badge` er en kort status i en rad: «Venter på deg», «Godkjent».
- `Notice` er en melding over innholdet: «Du er påmeldt!», «Bildet ble avvist»,
  «Nødtilgang er aktiv». Tone `green`, `amber` eller `red`.
- `Empty` er teksten i en tom liste: «Ingen saker.»

### Kort og lister

```tsx
<Card title="Min historikk">
  <ul className="divide-y divide-white/5 text-sm">
    {rows.map((r) => (
      <li key={r.id} className="flex flex-wrap items-center gap-2 py-2.5 first:pt-0 last:pb-0">…</li>
    ))}
  </ul>
</Card>
```

- Mange like rader: én `Card` med `divide-y`, ikke ett kort per rad.
- Et rutenett av kort bare når hvert element har mye innhold.
- En rad med navn og handling: `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`.
  Navnet står over knappen på mobil og ved siden av på desktop.
- Et kort som er en lenke (tallene på admin-forsiden): legg `group` på lenken
  og `group-hover:` på kortet.

---

## 7. Navigasjon

**Headeren** (`SiteHeader`) er klistret til toppen, 56 px høy, med frostet
glass (`bg-ink/75 backdrop-blur-xl`). Innholdet glir under. Logo til venstre,
«Logg ut» og avatar til høyre.

- Fra `lg` står menyen i samme rad som logoen.
- Under `lg` står menyen på egen linje under logoen og brytes til flere linjer.
  Den scroller aldri sidelengs.
- Adminpanelet har ikke `SiteHeader`, men sin egen ramme (`AdminShell`).

**Menylenker** (`NavLinks`) er like i headeren og i adminmenyen:

- Vanlig: `text-zinc-400`, hover gir svak flate.
- Aktiv: `bg-white/10 text-white` og `aria-current="page"`.
- Lenker til en rot-side (`/`, `/admin`) må ha `exact: true`. Ellers lyser de
  opp på alle undersider.
- Uleste varsler vises som en rød telleboble ved lenken, ikke som «Varsler (3)».

**Adminmenyen** (`AdminShell`) er en sidemeny i full høyde, 256 px bred
(`w-64`), med lenkene delt i grupper. Innholdet fyller resten av bredden, under
en klistret topplinje med brødsmuler, «Logg ut» og avatar. På mobil er menyen
skjult bak en menyknapp i topplinja og glir inn fra venstre.

---

## 8. Bevegelse

Bevegelse skal gi tilbakemelding, ikke underholde.

| Hva | Verdi |
|---|---|
| Standard varighet | `duration-150` |
| Kurve | `ease-out-strong` (`cubic-bezier(0.23, 1, 0.32, 1)`) |
| Trykk på knapp | `active:scale-[0.97]` |
| Trykk på holdeknappen | `active:scale-95` |

- Animer bare `transform`, `opacity`, `background-color`, `border-color` og
  `box-shadow`. Aldri `transition-all`.
- Hover på kort, rader og knapper gjør flaten og rammen litt lysere. Ingen
  skygge og ingen løft.
- Respons skjer når brukeren trykker ned, ikke når hen slipper. «Mitt offer»
  viser bildet på `pointerdown` og skjuler det på `pointerup`, `pointerleave` og
  `blur`.
- `prefers-reduced-motion` slår av all bevegelse (`globals.css`). Knapper har i
  tillegg `motion-reduce:active:scale-100`.
- `prefers-reduced-transparency` gjør headeren helt ugjennomsiktig (klassen
  `material`).

---

## 9. Tekst

- Alt i grensesnittet er bokmål.
- Knapper sier hva som skjer: «Meld drap», «Send svar», «Diskvalifiser». Ikke
  «OK» eller «Send inn».
- Bekreftelser (`confirm` på `ActionForm`) bare før noe som ikke kan angres
  eller som varsler andre. Spør med et spørsmål: «Melde drap på offeret ditt?»
- Feilmeldinger forteller hva brukeren kan gjøre: «QR-koden er utløpt eller
  ugyldig. Skann på nytt.»

---

## 10. Tavla

`src/app/tavle/[token]/Board.tsx` vises på en TV på kontoret og leses på
avstand. Der gjelder større mål: `text-3xl` på tall, `text-6xl`–`text-8xl` på
overskrifter, ingen header og ingen knapper. Den følger fargene over, men ikke
avstandene.

---

## Filer som eier systemet

| Fil | Eier |
|---|---|
| `src/app/globals.css` | Farger, font, kurve, fokusring, redusert bevegelse |
| `src/components/ui.tsx` | `Card`, `PageTitle`, `Button`, `LinkButton`, `buttonClass`, `inputClass`, `inputBase`, `Field`, `Checkbox`, `Badge`, `Notice`, `Empty`, `cx` |
| `src/components/ActionForm.tsx` | Skjema med låsing, bekreftelse og svar under |
| `src/components/NavLinks.tsx` | Menylenker med aktiv tilstand og telleboble |
| `src/components/SiteHeader.tsx` | Header og banneret «Et drap du er part i venter på svar fra deg» |
| `src/app/admin/layout.tsx` | Hvilke lenker adminmenyen viser |
| `src/components/AdminShell.tsx` | Adminrammen: sidemeny, topplinje og innholdsbredde |
