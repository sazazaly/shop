import { useEffect, useMemo, useState } from 'react'
import { products, CATEGORIES, colorHex } from './products.js'
import { Checkout, Done, Success, Fail } from './Checkout.jsx'

const won = (n) => n.toLocaleString('ko-KR') + '원'
function useLocal(key, init) {
  const [v, setV] = useState(() => { try { return JSON.parse(localStorage.getItem(key)) ?? init } catch { return init } })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)) } catch {} }, [key, v])
  return [v, setV]
}
const textColor = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n>>16)*299 + ((n>>8)&255)*587 + (n&255)*114)/1000 > 140 ? '#222' : '#fff' }

function Thumb({ p, color }) {
  const hex = colorHex(color ?? p.colors[0])
  return <div className="thumb" style={{ background: hex, color: textColor(hex) }}><span>{p.category}</span><b>{p.name}</b></div>
}

export default function App() {
  const path = location.pathname
  const [view, setView] = useState(() => { const m = location.pathname.match(/^\/product\/(\d+)\/?$/); return m && products.some((x) => x.id === +m[1]) ? { name: 'detail', id: +m[1] } : { name: 'list' } })
  const [cart, setCart] = useLocal('cart', [])
  const [wish, setWish] = useLocal('wish', [])
  const [toast, setToast] = useState('')
  const count = cart.reduce((s, i) => s + i.qty, 0)
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 1800) }
  const toggleWish = (id) => setWish((w) => w.includes(id) ? w.filter((x) => x !== id) : [...w, id])
  const addCart = (item) => {
    setCart((c) => {
      const k = c.findIndex((i) => i.id === item.id && i.color === item.color && i.size === item.size)
      if (k < 0) return [...c, { ...item, qty: 1 }]
      return c.map((i, n) => n === k ? { ...i, qty: i.qty + 1 } : i)
    })
    say('장바구니에 담았어요')
  }
  const clearCart = () => setCart([])
  const go = (v) => { setView(v); window.scrollTo(0, 0); const u = v.name === 'detail' ? `/product/${v.id}` : '/'; if (location.pathname !== u) history.pushState(null, '', u) }
  useEffect(() => { // 뒤로가기/앞으로가기 시 URL에 맞춰 화면 복원
    const onPop = () => { const m = location.pathname.match(/^\/product\/(\d+)\/?$/); setView(m ? { name: 'detail', id: +m[1] } : { name: 'list' }) }
    addEventListener('popstate', onPop); return () => removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => { // 화면 전환 시 title/robots 갱신 (장바구니·결제 등 비공개 화면은 noindex)
    const p = view.name === 'detail' ? products.find((x) => x.id === view.id) : null
    document.title = p ? `${p.name} | MONO` : view.name === 'list' ? 'MONO — 매일 입는 베이직 의류 쇼핑몰' : `${{ wish: '찜한 상품', cart: '장바구니', checkout: '주문하기', done: '주문 완료' }[view.name]} | MONO`
    let m = document.querySelector('meta[name=robots]'); if (m) m.content = ['list', 'detail'].includes(view.name) ? 'index,follow,max-image-preview:large,max-snippet:-1' : 'noindex,nofollow'
  }, [view])

  return (<>
    <header className="top">
      <button className="logo" onClick={() => go({ name: 'list' })}>MONO</button>
      <nav>
        <button onClick={() => go({ name: 'wish' })}>찜 {wish.length > 0 && <i>{wish.length}</i>}</button>
        <button onClick={() => go({ name: 'cart' })}>장바구니 {count > 0 && <i>{count}</i>}</button>
      </nav>
    </header>
    <main>
      {path === '/success' && <Success clearCart={clearCart} home={() => { location.href = '/' }} />}
      {path === '/fail' && <Fail home={() => { location.href = '/' }} />}
      {path !== '/success' && path !== '/fail' && <>
      {view.name === 'list' && <List onOpen={(id) => go({ name: 'detail', id })} wish={wish} toggleWish={toggleWish} />}
      {view.name === 'detail' && <Detail p={products.find((x) => x.id === view.id)} wish={wish} toggleWish={toggleWish} addCart={addCart} back={() => go({ name: 'list' })} />}
      {view.name === 'wish' && <Wish wish={wish} onOpen={(id) => go({ name: 'detail', id })} toggleWish={toggleWish} />}
      {view.name === 'cart' && <Cart cart={cart} setCart={setCart} onOpen={(id) => go({ name: 'detail', id })} onCheckout={() => go({ name: 'checkout' })} />}
      {view.name === 'checkout' && <Checkout cart={cart} back={() => go({ name: 'cart' })} onPaid={(order) => { clearCart(); go({ name: 'done', order }) }} />}
      {view.name === 'done' && <Done order={view.order} home={() => go({ name: 'list' })} />}
      </>}
    </main>
    <footer>데모 사이트 · 토스페이먼츠 테스트 결제</footer>
    {toast && <div className="toast">{toast}</div>}
  </>)
}

function Card({ p, onOpen, wish, toggleWish }) {
  const on = wish.includes(p.id)
  return (<article className="card">
    <a className="imgbtn" href={`/product/${p.id}`} onClick={(e) => { e.preventDefault(); onOpen(p.id) }} aria-label={p.name}><Thumb p={p} /></a>
    <button className={'heart' + (on ? ' on' : '')} onClick={() => toggleWish(p.id)} aria-label="찜">{on ? '♥' : '♡'}</button>
    <h3><a href={`/product/${p.id}`} onClick={(e) => { e.preventDefault(); onOpen(p.id) }}>{p.name}</a></h3>
    <p>{won(p.price)}</p>
    <div className="dots">{p.colors.map((c) => <span key={c} title={c} style={{ background: colorHex(c) }} />)}</div>
  </article>)
}

function List({ onOpen, wish, toggleWish }) {
  const [cat, setCat] = useState('전체')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('new')
  const items = useMemo(() => {
    let r = products.filter((p) => (cat === '전체' || p.category === cat) && p.name.includes(q.trim()))
    if (sort === 'low') r = [...r].sort((a, b) => a.price - b.price)
    if (sort === 'high') r = [...r].sort((a, b) => b.price - a.price)
    if (sort === 'new') r = [...r].sort((a, b) => b.id - a.id)
    return r
  }, [cat, q, sort])
  return (<>
    <section className="hero"><h1>Everyday basics.</h1><p>매일 입는 옷, 군더더기 없이.</p></section>
    <div className="tools">
      <div className="tabs">{CATEGORIES.map((c) => <button key={c} className={c === cat ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div>
      <div className="row">
        <input placeholder="상품 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="new">신상품순</option><option value="low">낮은 가격순</option><option value="high">높은 가격순</option>
        </select>
      </div>
    </div>
    {items.length === 0 ? <p className="empty">검색 결과가 없어요.</p> :
      <div className="grid">{items.map((p) => <Card key={p.id} p={p} onOpen={onOpen} wish={wish} toggleWish={toggleWish} />)}</div>}
  </>)
}

function Detail({ p, wish, toggleWish, addCart, back }) {
  const [color, setColor] = useState(p.colors[0])
  const [size, setSize] = useState(null)
  const [warn, setWarn] = useState(false)
  const on = wish.includes(p.id)
  const add = () => { if (!size) return setWarn(true); setWarn(false); addCart({ id: p.id, color, size }) }
  return (<div className="detail">
    <button className="back" onClick={back}>← 목록</button>
    <div className="dwrap">
      <Thumb p={p} color={color} />
      <div className="info">
        <small>{p.category}</small><h2>{p.name}</h2><strong>{won(p.price)}</strong>
        <p className="desc">{p.desc}</p>
        <h4>색상 · {color}</h4>
        <div className="dots big">{p.colors.map((c) => <button key={c} className={c === color ? 'on' : ''} style={{ background: colorHex(c) }} onClick={() => setColor(c)} aria-label={c} />)}</div>
        <h4>사이즈</h4>
        <div className="sizes">{p.sizes.map((s) => <button key={s} className={s === size ? 'on' : ''} onClick={() => { setSize(s); setWarn(false) }}>{s}</button>)}</div>
        {warn && <p className="warn">사이즈를 선택해주세요.</p>}
        <div className="actions">
          <button className="primary" onClick={add}>장바구니 담기</button>
          <button className="ghost" onClick={() => toggleWish(p.id)}>{on ? '♥ 찜 해제' : '♡ 찜하기'}</button>
        </div>
      </div>
    </div>
  </div>)
}

function Wish({ wish, onOpen, toggleWish }) {
  const items = products.filter((p) => wish.includes(p.id))
  return (<section className="page"><h2>찜한 상품</h2>
    {items.length === 0 ? <p className="empty">찜한 상품이 없어요.</p> :
      <div className="grid">{items.map((p) => <Card key={p.id} p={p} onOpen={onOpen} wish={wish} toggleWish={toggleWish} />)}</div>}
  </section>)
}

function Cart({ cart, setCart, onOpen, onCheckout }) {
  const total = cart.reduce((s, i) => s + products.find((p) => p.id === i.id).price * i.qty, 0)
  const upd = (k, d) => setCart((c) => c.map((i, n) => n === k ? { ...i, qty: Math.max(1, i.qty + d) } : i))
  const del = (k) => setCart((c) => c.filter((_, n) => n !== k))
  return (<section className="page"><h2>장바구니</h2>
    {cart.length === 0 ? <p className="empty">장바구니가 비어 있어요.</p> : <>
      <ul className="cart">{cart.map((i, k) => { const p = products.find((x) => x.id === i.id); return (
        <li key={k}>
          <button className="mini" onClick={() => onOpen(p.id)}><Thumb p={p} color={i.color} /></button>
          <div className="meta"><b>{p.name}</b><span>{i.color} / {i.size}</span><span>{won(p.price)}</span></div>
          <div className="qty"><button onClick={() => upd(k, -1)}>−</button><span>{i.qty}</span><button onClick={() => upd(k, 1)}>+</button></div>
          <button className="x" onClick={() => del(k)} aria-label="삭제">✕</button>
        </li>) })}</ul>
      <div className="sum"><span>합계</span><strong>{won(total)}</strong></div>
      <button className="primary paybtn" onClick={onCheckout}>주문하기</button>
    </>}
  </section>)
}
