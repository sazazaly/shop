import { useEffect, useRef, useState } from 'react'
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk'
import { products } from './products.js'

const CLIENT_KEY = (import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm').trim() // 기본: 토스 공식 문서용 테스트 키
const USE_TOSS = CLIENT_KEY.startsWith('test_') || CLIENT_KEY.startsWith('live_')
const PENDING = 'pendingOrder'

const won = (n) => n.toLocaleString('ko-KR') + '원'
const METHODS = ['신용/체크카드', '계좌이체', '간편결제', '무통장입금']
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// 가상 결제 시뮬레이션: 실제 결제/네트워크 없음. 결과는 선택한 시나리오에 따라 결정.
export function Checkout({ cart, back, onPaid }) {
  const [f, setF] = useState({ name: '', phone: '', addr: '' })
  const [method, setMethod] = useState(METHODS[0])
  const [scenario, setScenario] = useState('success')
  const [phase, setPhase] = useState('form') // form | processing | fail
  const [err, setErr] = useState('')
  const [order, setOrder] = useState(null)
  const [ready, setReady] = useState(!USE_TOSS)
  const widgets = useRef(null)
  const lines = cart.map((i) => ({ ...i, p: products.find((x) => x.id === i.id) }))
  const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const valid = f.name.trim() && f.phone.trim() && f.addr.trim()

  useEffect(() => {
    if (!USE_TOSS) return
    let dead = false
    ;(async () => {
      try {
        const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cart.map((i) => ({ id: i.id, qty: i.qty })) }) })
        const o = await r.json()
        if (!r.ok) throw new Error(o.message)
        const tp = await loadTossPayments(CLIENT_KEY)
        const w = tp.widgets({ customerKey: ANONYMOUS })
        await w.setAmount({ currency: 'KRW', value: o.amount })
        await Promise.all([
          w.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' }),
          w.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' }),
        ])
        if (dead) return
        widgets.current = w; setOrder(o); setReady(true)
      } catch (e) { if (!dead) setErr(e.message || '결제창을 불러오지 못했어요.') }
    })()
    return () => { dead = true }
  }, [])

  const payToss = async () => {
    try {
      sessionStorage.setItem(PENDING, JSON.stringify({ orderId: order.orderId, ...f, lines: lines.map(({ id, color, size, qty }) => ({ id, color, size, qty })) }))
      await widgets.current.requestPayment({
        orderId: order.orderId, orderName: order.orderName, customerName: f.name,
        successUrl: location.origin + '/success', failUrl: location.origin + '/fail',
      })
    } catch (e) { if (e.code !== 'USER_CANCEL') setErr(e.message) }
  }

  const pay = async () => {
    if (USE_TOSS) return payToss()
    setPhase('processing')
    await wait(1800)
    if (scenario === 'fail') { setErr('카드 한도 초과 (시뮬레이션)'); return setPhase('fail') }
    onPaid({ orderNo: 'SIM-' + Date.now().toString(36).toUpperCase(), method, total, lines, ...f })
  }

  if (phase === 'processing') return <section className="page center"><div className="spinner" /><h2>결제 처리 중…</h2><p className="empty">잠시만 기다려주세요</p></section>
  if (phase === 'fail') return (<section className="page center"><h2>결제에 실패했어요</h2><p className="warn">{err}</p>
    <button className="primary paybtn" onClick={() => { setScenario('success'); setPhase('form') }}>다시 시도</button></section>)

  return (<section className="page"><button className="back" onClick={back}>← 장바구니</button><h2>주문 / 결제</h2>
    <h4 className="sec">배송 정보</h4>
    <div className="form">
      <input placeholder="이름" value={f.name} onChange={set('name')} />
      <input placeholder="연락처" inputMode="tel" value={f.phone} onChange={set('phone')} />
      <input placeholder="배송지 주소" value={f.addr} onChange={set('addr')} />
    </div>
    <h4 className="sec">결제 수단</h4>
    {err && <p className="warn">{err}</p>}
    {USE_TOSS ? <><div id="payment-method" /><div id="agreement" /></> : <div className="methods">{METHODS.map((m) => <label key={m} className={m === method ? 'on' : ''}><input type="radio" checked={m === method} onChange={() => setMethod(m)} />{m}</label>)}</div>}
    <h4 className="sec">주문 상품</h4>
    <ul className="cart">{lines.map((l, k) => <li key={k}><div className="meta"><b>{l.p.name}</b><span>{l.color} / {l.size} · {l.qty}개</span></div><strong>{won(l.p.price * l.qty)}</strong></li>)}</ul>
    <div className="sum"><span>총 결제금액</span><strong>{won(total)}</strong></div>
    {!USE_TOSS && <label className="sim">시뮬레이션 결과
      <select value={scenario} onChange={(e) => setScenario(e.target.value)}><option value="success">결제 성공</option><option value="fail">결제 실패</option></select>
    </label>}
    <button className="primary paybtn" disabled={!valid || !ready} onClick={pay}>{won(total)} 결제하기</button>
    <p className="note">{USE_TOSS ? '토스페이먼츠 테스트 환경입니다.' : '가상 결제 시뮬레이션입니다.'} 실제 결제·청구는 발생하지 않습니다.</p>
  </section>)
}

export function Done({ order, home }) {
  return (<section className="page center"><div className="check">✓</div><h2>결제가 완료됐어요</h2>
    <p className="empty" style={{ padding: '4px 0 16px' }}>주문번호 {order.orderNo} · {order.method}</p>
    <ul className="cart" style={{ textAlign: 'left' }}>{order.lines.map((l, k) => <li key={k}><div className="meta"><b>{l.p.name}</b><span>{l.color} / {l.size} · {l.qty}개</span></div><strong>{won(l.p.price * l.qty)}</strong></li>)}</ul>
    <div className="sum"><span>결제금액</span><strong>{won(order.total)}</strong></div>
    <p className="note">{order.name}님, {order.addr}로 배송될 예정이에요 (시뮬레이션)</p>
    <button className="primary paybtn" onClick={home}>쇼핑 계속하기</button></section>)
}

export function Success({ clearCart, home }) {
  const [st, setSt] = useState({ loading: true })
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const pend = JSON.parse(sessionStorage.getItem(PENDING) || 'null')
    fetch('/api/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentKey: q.get('paymentKey'), orderId: q.get('orderId'), amount: q.get('amount') }) })
      .then(async (r) => {
        const d = await r.json(); if (!r.ok) throw new Error(d.message || '결제 승인 실패')
        const lines = (pend?.lines || []).map((l) => ({ ...l, p: products.find((x) => x.id === l.id) }))
        sessionStorage.removeItem(PENDING); clearCart()
        setSt({ order: { orderNo: d.orderId, method: d.method, total: d.totalAmount, lines, name: pend?.name || '', addr: pend?.addr || '' } })
      })
      .catch((e) => setSt({ error: e.message }))
  }, [])
  if (st.loading) return <p className="empty">결제를 확인하는 중…</p>
  if (st.error) return <section className="page center"><h2>결제 승인 실패</h2><p className="warn">{st.error}</p><button className="primary paybtn" onClick={home}>홈으로</button></section>
  return <Done order={st.order} home={home} />
}

export function Fail({ home }) {
  const q = new URLSearchParams(location.search)
  return (<section className="page center"><h2>결제에 실패했어요</h2><p className="warn">{q.get('message')} ({q.get('code')})</p><button className="primary paybtn" onClick={home}>홈으로</button></section>)
}
