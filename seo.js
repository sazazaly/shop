// SEO / AEO / GEO 빌드 플러그인: 메타·OG·JSON-LD 주입, 상품별 정적 페이지, sitemap/robots/llms.txt, 상품 SVG 이미지 생성
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { products, colorHex } from './src/products.js'

const NAME = 'MONO'
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const won = (n) => n.toLocaleString('ko-KR') + '원'
const textColor = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 140 ? '#222' : '#fff' }
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`

export function seo({ site, naverVerify = '', googleVerify = '' }) {
  const base = site.replace(/\/$/, '')
  const productDesc = (p) => `${p.name} (${p.category}) ${won(p.price)}. 색상 ${p.colors.join('·')}, 사이즈 ${p.sizes.join('/')}. ${NAME} 데일리 베이직 의류.`
  const productUrl = (p) => `${base}/product/${p.id}`
  const image = (p) => `${base}/img/${p.id}.svg`

  const head = ({ title, desc, url, type = 'website', image: img = `${base}/og.png`, schema = [], robots = 'index,follow,max-image-preview:large,max-snippet:-1' }) => `<!--seo:start-->
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta name="robots" content="${robots}" />
<link rel="canonical" href="${url}" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<meta name="theme-color" content="#17171a" />
${googleVerify ? `<meta name="google-site-verification" content="${esc(googleVerify)}" />\n` : ''}${naverVerify ? `<meta name="naver-site-verification" content="${esc(naverVerify)}" />\n` : ''}<meta property="og:site_name" content="${NAME}" />
<meta property="og:locale" content="ko_KR" />
<meta property="og:type" content="${type}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${img}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${img}" />
${schema.map(ld).join('\n')}
<!--seo:end-->`

  const homeSchema = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: NAME, url: base + '/', inLanguage: 'ko-KR', potentialAction: { '@type': 'SearchAction', target: `${base}/?q={search_term_string}`, 'query-input': 'required name=search_term_string' } },
    { '@context': 'https://schema.org', '@type': 'Organization', name: NAME, url: base + '/', logo: `${base}/favicon.svg` },
    { '@context': 'https://schema.org', '@type': 'ItemList', name: `${NAME} 전체 상품`, itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: productUrl(p), name: p.name })) },
  ]
  const productSchema = (p) => [
    { '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: productDesc(p), sku: `MONO-${p.id}`, category: p.category, image: image(p), brand: { '@type': 'Brand', name: NAME }, color: p.colors.join(', '),
      offers: { '@type': 'Offer', url: productUrl(p), priceCurrency: 'KRW', price: p.price, availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition' } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: base + '/' },
      { '@type': 'ListItem', position: 2, name: p.category, item: base + '/' },
      { '@type': 'ListItem', position: 3, name: p.name, item: productUrl(p) } ] },
  ]

  const homeBody = `<!--seo:body-start--><noscript><h1>${NAME} — 매일 입는 베이직 의류 쇼핑몰</h1><p>상의, 하의, 아우터, 액세서리 ${products.length}종을 만나보세요.</p><ul>${products.map((p) => `<li><a href="/product/${p.id}">${esc(p.name)}</a> — ${esc(p.category)}, ${won(p.price)}</li>`).join('')}</ul></noscript><!--seo:body-end-->`
  const productBody = (p) => `<!--seo:body-start--><noscript><nav><a href="/">${NAME} 홈</a></nav><h1>${esc(p.name)}</h1><p>${esc(productDesc(p))}</p><p>${esc(p.desc)}</p></noscript><!--seo:body-end-->`

  const homeHead = head({ title: `${NAME} — 매일 입는 베이직 의류 쇼핑몰`, desc: `${NAME}는 티셔츠, 셔츠, 팬츠, 코트 등 데일리 베이직 의류를 판매합니다. 상의·하의·아우터·액세서리 ${products.length}종.`, url: base + '/', schema: homeSchema })

  return {
    name: 'seo',
    transformIndexHtml: { order: 'pre', handler: (html) => html.replace('<!--seo-head-->', homeHead).replace('<!--seo-body-->', homeBody) },
    closeBundle() {
      const dist = join(process.cwd(), 'dist')
      const w = (f, c) => { mkdirSync(join(dist, f, '..'), { recursive: true }); writeFileSync(join(dist, f), c) }
      const tpl = readFileSync(join(dist, 'index.html'), 'utf8')
      const swap = (html, h, b) => html.replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, () => h).replace(/<!--seo:body-start-->[\s\S]*?<!--seo:body-end-->/, () => b)
      for (const p of products) {
        w(`product/${p.id}/index.html`, swap(tpl, head({ title: `${p.name} | ${NAME}`, desc: productDesc(p), url: productUrl(p), type: 'product', schema: productSchema(p) }), productBody(p)))
        const hex = colorHex(p.colors[0])
        w(`img/${p.id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="${hex}"/><text x="400" y="380" text-anchor="middle" font-family="sans-serif" font-size="28" fill="${textColor(hex)}" opacity=".7">${esc(p.category)}</text><text x="400" y="440" text-anchor="middle" font-family="sans-serif" font-size="48" font-weight="700" fill="${textColor(hex)}">${esc(p.name)}</text></svg>`)
      }
      const today = new Date().toISOString().slice(0, 10)
      w('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[base + '/', ...products.map(productUrl)].map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`)
      w('robots.txt', `User-agent: *\nAllow: /\nDisallow: /success\nDisallow: /fail\nDisallow: /api/\n\n# AI 검색/답변 엔진 크롤러 허용 (AEO/GEO)\n${['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'Yeti', 'Bingbot'].map((b) => `User-agent: ${b}\nAllow: /\n`).join('\n')}\nSitemap: ${base}/sitemap.xml\n`)
      w('llms.txt', `# ${NAME}\n\n> ${NAME}는 데일리 베이직 의류(상의·하의·아우터·액세서리)를 판매하는 쇼핑몰 데모 사이트입니다. 가격은 원화(KRW)입니다.\n\n## 상품\n${products.map((p) => `- [${p.name}](${productUrl(p)}): ${p.category}, ${won(p.price)}, 색상 ${p.colors.join('/')}, 사이즈 ${p.sizes.join('/')}`).join('\n')}\n\n## 안내\n- 사이트맵: ${base}/sitemap.xml\n- 결제는 토스페이먼츠 테스트 환경이며 실제 청구는 없습니다.\n`)
      if (base.includes('example.com')) console.warn('\n[seo] SITE_URL 이 설정되지 않았습니다. shop/.env 에 SITE_URL=https://실제도메인 을 넣고 다시 빌드하세요.\n')
    },
  }
}
