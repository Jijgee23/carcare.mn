# carcare.mn — landing (Next.js)

Ops Console дизайны Next.js (App Router + Tailwind) хувилбар.

## Ажиллуулах

\`\`\`bash
npm install
npm run dev
\`\`\`

## Бүтэц

- `app/layout.tsx` — IBM Plex Sans / Mono (кирилл subset), globals
- `app/page.tsx` — секцүүдийн дараалал
- `components/ui.tsx` — Container, Logo, Eyebrow, товчнууд, StatusPill
- `components/*` — TopBar, Nav, Hero, Stats, Audiences, Features, HowItWorks, Pricing, Faq, Cta, Footer
- `tailwind.config.ts` — өнгө (base/panel/line/accent…), grid background, фонтын хувьсагч

Контент бүр компонентын дээд талын массивт байгаа — текст, үнэ, FAQ-г тэндээс шууд засна.
