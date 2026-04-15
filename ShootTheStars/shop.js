// Shop and item UI helpers for ShootTheStars
// Relies on globals: document, window.saver, window.upgrades, SETTINGS
import { formatLargeNumber } from "./bigNumbers.js"

const itemsContainer = document.querySelector('#items')
let itemsBox = null

function ensureItemsBox() {
    if (!itemsContainer) return null
    if (!itemsBox) {
        itemsBox = document.createElement('ul')
        itemsContainer.appendChild(itemsBox)
    }
    return itemsBox
}

function calcUpgradeCost(def, level) {
    const base = Number(def?.starting_cost || 1)
    const growth = Number(def?.cost_growth || 1)
    const computed = Math.floor(base * Math.pow(growth, level))
    const linearMin = base + Number(level || 0)
    return Math.max(1, computed, linearMin)
}

function renderItemsList() {
    const items = window.saver.getData('items') || {}

    if (!items || Object.keys(items).length === 0) return
    const box = ensureItemsBox()
    if (!box) return
    const existing = {}
    for (const li of Array.from(box.children)) {
        const name = li.dataset.itemName
        if (name) existing[name] = li
    }

    for (const [name, amount] of Object.entries(items)) {
        let displayAmount = amount
        try {
            if (window.upgrades && window.upgrades.shops && window.upgrades.getStat && window.upgrades.shops[name]) {
                const derived = window.upgrades.getStat(name, 'amount', Number(amount) || 0)
                if (derived !== undefined && derived !== null) displayAmount = Math.floor(Number(derived) || 0)
            }
        } catch (e) { }

        if (existing[name]) {
            existing[name].textContent = `${name}:${formatLargeNumber(displayAmount,7)}`
            delete existing[name]
        } else {
            const li = document.createElement('li')
            li.dataset.itemName = name
            li.className = 'item'
            li.textContent = `${name}:${formatLargeNumber(displayAmount,7)}`
            box.appendChild(li)
        }
    }

    for (const leftoverName of Object.keys(existing)) {
        const li = existing[leftoverName]
        if (li && li.parentNode === box) box.removeChild(li)
    }
}

let _shopsCache = null
async function loadShops() {
    if (_shopsCache) return _shopsCache
    try {
        const resp = await fetch('ShootTheStars/data/shops.json')
        _shopsCache = await resp.json()
        return _shopsCache
    } catch (err) {
        console.warn('Failed to load shops.json', err)
        return {}
    }
}

function closeShop() {
    const modal = document.getElementById('shop-modal')
    if (!modal) return
    modal.classList.add('hidden')
    modal.setAttribute('aria-hidden', 'true')
    const content = document.getElementById('shop-content')
    if (content) content.innerHTML = ''
}

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)) }

async function animatePurchaseFinal(entry){
    const fadeMs = Number(SETTINGS.PURCHASE_FADE_MS || 500)
    const particleMs = Number(SETTINGS.PURCHASE_PARTICLE_MS || 700)
    const particleCount = Number(SETTINGS.PURCHASE_PARTICLE_COUNT || 18)
    const particleSpeed = Number(SETTINGS.PURCHASE_PARTICLE_SPEED || 220)

    entry.style.position = entry.style.position || 'relative'
    const overlay = document.createElement('div')
    overlay.className = 'purchase-overlay'
    entry.appendChild(overlay)

    overlay.style.transition = `opacity ${fadeMs}ms ease`
    requestAnimationFrame(()=> overlay.style.opacity = '1')
    await sleep(fadeMs)

    const shopDialog = entry.closest('.shop-dialog') || document.getElementById('shop-modal') || document.body
    const shopRect = shopDialog.getBoundingClientRect()
    const entryRect = entry.getBoundingClientRect()

    const particles = []
    for (let i=0;i<particleCount;i++){
        const p = document.createElement('div')
        p.className = 'purchase-particle'
        const startX = entryRect.left - shopRect.left + entryRect.width/2
        const startY = entryRect.top - shopRect.top + entryRect.height/2
        p.style.left = `${startX - 4}px`
        p.style.top = `${startY - 4}px`
        shopDialog.appendChild(p)
        particles.push(p)
    }

    const anims = particles.map((p)=>{
        const angle = Math.random() * Math.PI * 2
        const dist = particleSpeed * (0.6 + Math.random() * 0.8)
        const dx = Math.cos(angle) * dist
        const dy = Math.sin(angle) * dist
        const rot = (Math.random()-0.5)*720
        const anim = p.animate([
            { transform: 'translate(0px,0px) rotate(0deg)', opacity: 1 },
            { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 0 }
        ], { duration: particleMs, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' })
        return anim.finished.then(()=>{ if (p && p.parentNode) p.parentNode.removeChild(p) })
    })

    const origHeight = entry.scrollHeight
    entry.style.transition = `height ${particleMs}ms ease, margin ${particleMs}ms ease, opacity ${particleMs}ms ease`
    entry.style.height = origHeight + 'px'
    entry.getBoundingClientRect()
    requestAnimationFrame(()=>{
        entry.style.height = '0px'
        entry.style.margin = '0'
        entry.style.opacity = '0'
    })

    await Promise.all(anims)

    try { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay) } catch(e){}
    try { if (entry && entry.parentNode) entry.parentNode.removeChild(entry) } catch(e){}
    await sleep(60)
}

async function openShopForItem(itemName) {
    await window.saver.ready
    const shops = await loadShops()
    const key = itemName.toLowerCase()
    const shop = shops[key]
    const modal = document.getElementById('shop-modal')
    const title = document.getElementById('shop-title')
    const content = document.getElementById('shop-content')
    if (!modal || !content || !title) return
    title.textContent = (shop && shop.header) ? shop.header : `Shop — ${itemName}`
    content.innerHTML = ''

    if (!shop || !shop.items) {
        const empty = document.createElement('div')
        empty.className = 'shop-empty'
        empty.textContent = 'No shop available for this item.'
        content.appendChild(empty)
    } else {
        const list = document.createElement('div')
        list.className = 'shop-list'
        const isUnlocked = async (def, itemName, upgradeId) => {
            if (!def || !def.condition) return true
            const persistent = window.saver.getData(`unlocks/${itemName}/${upgradeId}`, false)
            if (persistent) return true
            for (const [condKey, threshold] of Object.entries(def.condition)) {
                let val = window.saver.getData(condKey, undefined)
                if (val === undefined || val === null) val = window.saver.getData(`items/${condKey}`, undefined)
                if (val === undefined || val === null) continue
                const num = Number(val)
                if (!Number.isNaN(num) && num >= Number(threshold)) {
                    window.saver.setData(`unlocks/${itemName}/${upgradeId}`, true)
                    try { await window.saver.save() } catch(e){}
                    return true
                }
            }
            return false
        }

        const isRevealed = async (def, itemName, upgradeId) => {
            if (!def || !def.fog_condition) return true
            const persistent = window.saver.getData(`unlocks/${itemName}/${upgradeId}_fog`, false)
            if (persistent) return true
            for (const [condKey, threshold] of Object.entries(def.fog_condition)) {
                let val = window.saver.getData(condKey, undefined)
                if (val === undefined || val === null) val = window.saver.getData(`items/${condKey}`, undefined)
                if (val === undefined || val === null) continue
                const num = Number(val)
                if (!Number.isNaN(num) && num >= Number(threshold)) {
                    window.saver.setData(`unlocks/${itemName}/${upgradeId}_fog`, true)
                    try { await window.saver.save() } catch(e){}
                    return true
                }
            }
            return false
        }

        for (const [upgradeId, def] of Object.entries(shop.items)) {
            const shopCurrencyKey = (shop && shop.currency) ? shop.currency : itemName
            const currencyKey = def && def.currency ? def.currency : shopCurrencyKey
            const displayName = def.name || upgradeId
            const max = def.max || Infinity
            const unlocked = await isUnlocked(def, itemName, upgradeId)
            if (!unlocked) continue
            const revealed = await isRevealed(def, itemName, upgradeId)
            if (!revealed) {
                const fogEntry = document.createElement('button')
                fogEntry.className = 'shop-entry fogged'
                fogEntry.type = 'button'
                const labelSpan = document.createElement('span')
                labelSpan.className = 'label'
                labelSpan.textContent = '???'
                const metaSpan = document.createElement('span')
                metaSpan.className = 'meta'
                metaSpan.textContent = '???'
                fogEntry.appendChild(labelSpan)
                fogEntry.appendChild(metaSpan)
                fogEntry.disabled = true
                list.appendChild(fogEntry)
                continue
            }

            let current = window.saver.getData(`upgrades/${itemName}/${upgradeId}`, 0) || 0
            if (!current && def && def.name) {
                current = window.saver.getData(`upgrades/${itemName}/${def.name}`, 0) || 0
            }
            if (current >= max) continue

            const entry = document.createElement('button')
            entry.className = 'shop-entry'
            entry.type = 'button'

            const metaSpan = document.createElement('span')
            metaSpan.className = 'meta'

            const labelSpan = document.createElement('span')
            labelSpan.className = 'label'
            labelSpan.textContent = displayName

            entry.appendChild(labelSpan)
            entry.appendChild(metaSpan)

            const refresh = () => {
                const cur = window.saver.getData(`upgrades/${itemName}/${upgradeId}`, 0) || 0
                const cost = calcUpgradeCost(def, cur)
                metaSpan.textContent = `${cur}/${max} — ${cost} ${currencyKey}`
            }
            refresh()

            entry.addEventListener('click', async () => {
                const currentInside = window.saver.getData(`upgrades/${itemName}/${upgradeId}`, 0) || 0
                if (currentInside >= max) return
                const cost = calcUpgradeCost(def, currentInside)
                // `shopCurrencyKey` and `currencyKey` are captured from outer scope
                let currencyAvailable = 0
                let currencyIsShop = false
                try {
                    if (window.upgrades && window.upgrades.shops && window.upgrades.shops[currencyKey]) {
                        currencyAvailable = Math.floor(Number(window.upgrades.getStat(currencyKey, 'amount', window.saver.getData(`items/${currencyKey}`, 0))) || 0)
                        currencyIsShop = true
                    } else {
                        currencyAvailable = window.saver.getData(`items/${currencyKey}`, 0) || 0
                    }
                } catch (e) { currencyAvailable = window.saver.getData(`items/${currencyKey}`, 0) || 0 }
                if (currencyAvailable < cost) {
                    entry.animate([{transform:'scale(1)'},{transform:'scale(0.98)'},{transform:'scale(1)'}], {duration:220})
                    return
                }
                if (currencyIsShop) {
                    // Some shop currencies (e.g. `harvesters`) are tracked as an
                    // upgrade count like `upgrades/<shop>/amount`. If the shop
                    // defines an `amount` item, deduct from that upgrades key;
                    // otherwise fall back to `items/<currency>`.
                    const shopDef = window.upgrades && window.upgrades.shops && window.upgrades.shops[currencyKey]
                    if (shopDef && shopDef.items && Object.prototype.hasOwnProperty.call(shopDef.items, 'amount')) {
                        const prevAmt = window.saver.getData(`upgrades/${currencyKey}/amount`, 0) || 0
                        window.saver.setData(`upgrades/${currencyKey}/amount`, Math.max(0, prevAmt - cost))
                    } else {
                        const prevAmt = window.saver.getData(`items/${currencyKey}`, 0) || 0
                        window.saver.setData(`items/${currencyKey}`, Math.max(0, prevAmt - cost))
                    }
                } else {
                    window.saver.setData(`items/${currencyKey}`, currencyAvailable - cost)
                }
                window.saver.setData(`upgrades/${itemName}/${upgradeId}`, currentInside + 1)
                if (def && def.unlocks_shop) {
                    const shopKey = def.unlocks_shop
                    window.saver.setData(`unlocks/shops/${shopKey}`, true)
                    const items = window.saver.getData('items') || {}
                    if (!(shopKey in items)) {
                        window.saver.setData(`items/${shopKey}`, 0)
                    }
                    try {
                        const prev = window.saver.getData(`upgrades/${shopKey}/amount`, 0) || 0
                        window.saver.setData(`upgrades/${shopKey}/amount`, prev + 1)
                    } catch (e) { console.warn('failed to grant free harvester', e) }
                }
                await window.saver.save()
                const newCurrent = currentInside + 1
                const finalBought = (newCurrent >= max)
                if (finalBought) {
                    try {
                        await animatePurchaseFinal(entry)
                    } catch (e) { console.warn('purchase animation failed', e) }
                    openShopForItem(itemName)
                } else {
                    openShopForItem(itemName)
                }
            })
            list.appendChild(entry)
        }
        content.appendChild(list)
    }

    modal.classList.remove('hidden')
    modal.setAttribute('aria-hidden', 'false')
}

function initShop() {
    if (itemsContainer) {
        itemsContainer.addEventListener('click', (ev) => {
            let el = ev.target
            while (el && el !== itemsContainer) {
                if (el.matches && el.matches('.item')) {
                    const name = el.dataset.itemName
                    if (name) openShopForItem(name)
                    return
                }
                el = el.parentNode
            }
        })
    }

    document.addEventListener('click', (ev) => {
        if (ev.target && ev.target.id === 'shop-close') closeShop()
    })

    window.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') closeShop()
    })
}

let _itemsSyncInterval = null
function startItemsSync(pollMs = 500) {
    if (_itemsSyncInterval) return
    _itemsSyncInterval = setInterval(renderItemsList, pollMs)
}
function stopItemsSync() {
    if (!_itemsSyncInterval) return
    clearInterval(_itemsSyncInterval)
    _itemsSyncInterval = null
}

export { initShop, startItemsSync, stopItemsSync, renderItemsList }
