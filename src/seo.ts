// Page titles, descriptions and structured data, shared by the app (runtime) and scripts/prerender.ts (build).
// No runtime imports on purpose: Node runs this file directly at build time.
import type { Match } from './data'

export type Lang = 'en' | 'ar'
export type Page =
  | { kind: 'home'; count: number }
  | { kind: 'matches'; count: number }
  | { kind: 'match'; match: Match }
  | { kind: 'setup'; mode: 'solo' | 'same' | 'versus' }
  | { kind: 'play' }

export type Meta = {
  title: string
  description: string
  /** Path without the language prefix, e.g. "/match/bar-mun-2009". */
  path: string
  noindex?: boolean
  image: string
  jsonLd?: object[]
}

const year = (m: Match) => m.date.slice(0, 4)
const dateText = (m: Match, lang: Lang) =>
  new Date(m.date + 'T12:00:00Z').toLocaleDateString(lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** "Barcelona 2–0 Manchester United" */
export const fixture = (m: Match, lang: Lang) => `${m.home.team[lang]} ${m.score} ${m.away.team[lang]}`

export function meta(page: Page, lang: Lang, brand: string, site: string): Meta {
  const ar = lang === 'ar'
  const image = `${site}/og/default.jpg`
  switch (page.kind) {
    case 'home':
      return {
        path: '/', image,
        title: ar ? `${brand} · سمِّ التشكيلة الأساسية لأشهر مباريات كرة القدم` : `${brand} · Name the starting XI of famous football matches`,
        description: ar
          ? `لعبة تخمين تشكيلات كرة القدم. اختر مباراة شهيرة وسترى الخطة وأحد عشر قميصًا بلا أسماء، ثم سمِّ التشكيلة الأساسية. العب وحدك أو مع أصدقائك على نفس الجوال أو أرسل تحديًا. ${page.count} مباراة بالعربية والإنجليزية.`
          : `A football lineup quiz. Pick a famous match, see the formation and eleven blank shirts, and name the starting XI. Play solo, pass the phone around with friends, or send a challenge. ${page.count} matches, in English and Arabic.`,
        jsonLd: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: brand, url: site + (ar ? '/ar' : '/'), inLanguage: lang }],
      }
    case 'matches':
      return {
        path: '/matches', image,
        title: ar ? `كل المباريات · ${brand}` : `All matches · ${brand}`,
        description: ar
          ? `${page.count} مباراة لتخمين تشكيلاتها: نهائيات دوري أبطال أوروبا وكأس العالم وكأس أوروبا وكأس الأمم الأفريقية وكأس آسيا وكأس العرب وغيرها.`
          : `${page.count} matches to guess the lineups of: Champions League, World Cup and Euro finals, the Africa Cup of Nations, Asian Cup, Arab Cup and more.`,
      }
    case 'match': {
      const m = page.match
      const note = m.note ? ` ${m.note[lang]}.` : ''
      const url = `${site}${ar ? '/ar' : ''}/match/${m.id}`
      return {
        path: `/match/${m.id}`,
        image: `${site}/og/${m.id}.jpg`,
        title: ar
          ? `${fixture(m, lang)}، ${m.comp.ar} ${year(m)}: سمِّ التشكيلتين · ${brand}`
          : `${fixture(m, lang)}, ${year(m)} ${m.comp.en}: name the starting XIs · ${brand}`,
        description: ar
          ? `هل تعرف التشكيلتين الأساسيتين في ${m.comp.ar} ${year(m)}؟ ${m.home.team.ar} ضد ${m.away.team.ar} في ${m.venue.ar}، ${dateText(m, lang)}.${note} لعبة مجانية: وحدك أو مع أصدقائك أو كتحدٍّ.`
          : `Can you name both starting lineups from the ${year(m)} ${m.comp.en}? ${m.home.team.en} vs ${m.away.team.en} at ${m.venue.en}, ${dateText(m, lang)}.${note} A free football quiz: solo, with friends or as a challenge.`,
        jsonLd: [
          {
            '@context': 'https://schema.org', '@type': 'SportsEvent', url, inLanguage: lang,
            name: `${m.home.team[lang]} – ${m.away.team[lang]} (${m.comp[lang]} ${year(m)})`,
            startDate: m.date, sport: 'Association football', eventStatus: 'https://schema.org/EventScheduled',
            location: { '@type': 'Place', name: m.venue[lang] },
            homeTeam: { '@type': 'SportsTeam', name: m.home.team[lang] },
            awayTeam: { '@type': 'SportsTeam', name: m.away.team[lang] },
          },
          {
            '@context': 'https://schema.org', '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: brand, item: `${site}${ar ? '/ar' : '/'}` },
              { '@type': 'ListItem', position: 2, name: ar ? 'كل المباريات' : 'All matches', item: `${site}${ar ? '/ar' : ''}/matches` },
              { '@type': 'ListItem', position: 3, name: fixture(m, lang), item: url },
            ],
          },
        ],
      }
    }
    case 'setup': {
      const name = { solo: ar ? 'فردي' : 'Solo', same: ar ? 'نفس التشكيلة' : 'Same XI', versus: ar ? 'فريق ضد فريق' : 'Team vs team' }[page.mode]
      return { path: `/setup/${page.mode}`, image, noindex: true, title: `${name} · ${brand}`, description: ar ? 'اختر مباراة وابدأ اللعب.' : 'Pick a match and kick off.' }
    }
    case 'play':
      return { path: '/play', image, noindex: true, title: brand, description: '' }
  }
}
