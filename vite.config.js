import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { randomUUID } from 'node:crypto'
import { products } from './src/products.js'
import { seo } from './seo.js'

// 토스 공식 샘플의 문서용 테스트 시크릿 키 (공개 키, 실제 청구 없음). 내 키는 shop/.env 로 덮어쓰기.
const DOCS_SECRET = 'test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6'

// 토스페이먼츠 승인(confirm)용 서버 API. 시크릿 키는 shop/.env 의 TOSS_SECRET_KEY (브라우저에 노출되지 않음)
function payApi(SECRET) {
  const orders = new Map() // orderId -> amount (서버가 금액을 직접 계산·보관해 위변조 방지)
  const json = (res, code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)) }
  const readBody = (req) => new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => { try { ok(JSON.parse(d || '{}')) } catch { ok({}) } }) })
  const handler = async (req, res, next) => {
    if (req.method !== 'POST') return next()
    if (req.url === '/api/orders') {
      const { items = [] } = await readBody(req)
      let amount = 0, names = []
      for (const i of items) {
        const p = products.find((x) => x.id === i.id)
        if (!p || !Number.isInteger(i.qty) || i.qty < 1) return json(res, 400, { message: '잘못된 상품' })
        amount += p.price * i.qty; names.push(p.name)
      }
      if (!amount) return json(res, 400, { message: '빈 주문' })
      const orderId = 'order_' + randomUUID().replace(/-/g, '')
      const orderName = names.length > 1 ? `${names[0]} 외 ${names.length - 1}건` : names[0]
      orders.set(orderId, amount)
      return json(res, 200, { orderId, amount, orderName })
    }
    if (req.url === '/api/confirm') {
      const { paymentKey, orderId, amount } = await readBody(req)
      if (!SECRET) return json(res, 500, { message: '서버에 TOSS_SECRET_KEY 가 설정되지 않았습니다. shop/.env 를 확인하세요.' })
      if (orders.get(orderId) !== Number(amount)) return json(res, 400, { message: '주문 금액이 일치하지 않습니다.' })
      const r = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
        method: 'POST',
        headers: { Authorization: 'Basic ' + Buffer.from(SECRET + ':').toString('base64'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
      })
      const data = await r.json()
      if (r.ok) orders.delete(orderId)
      return json(res, r.status, data)
    }
    next()
  }
  return { name: 'pay-api', configureServer(s) { s.middlewares.use(handler) }, configurePreviewServer(s) { s.middlewares.use(handler) } }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), payApi(env.TOSS_SECRET_KEY || DOCS_SECRET), seo({ site: env.SITE_URL || 'https://shop.example.com', naverVerify: env.NAVER_SITE_VERIFICATION, googleVerify: env.GOOGLE_SITE_VERIFICATION })] }
})
