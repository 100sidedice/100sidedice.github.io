// Shop and item UI helpers for ShootTheStars
// Now refactored into a class `ShopManager` and exported as a singleton.
// Uses `DataManager` for persistence and upgrades; expects `SETTINGS` global.
import { formatLargeNumber } from "./bigNumbers.js"
import DataManager from '../Core/DataManager.js'

class ShopManager {
    constructor() {
        this.itemsContainer = document.querySelector('#items')
        this.itemsBox = null
        this._shopsCache = null
        this._itemsSyncInterval = null
        this._saverListenerKey = null
        this._onItemsClick = null
        this._onDocClick = null
        this._onKeyDown = null
    }

    ensureItemsBox() {
        if (!this.itemsContainer) return null
        if (!this.itemsBox) {
            this.itemsBox = document.createElement('ul')
            this.itemsContainer.appendChild(this.itemsBox)
        }
        return this.itemsBox
    }

    calcUpgradeCost(def, level) {
        const base = Number(def?.starting_cost ?? 1)
        const growth = Number(def?.cost_growth ?? 1)
        const computed = Math.floor(base * Math.pow(growth, level))
        const linearMin = base + Number(level ?? 0)
        return Math.max(1, computed, linearMin)
    }

    renderItemsList() {
        const items = DataManager.saver.getData('items') || {}
        if (!items || Object.keys(items).length === 0) return
        const box = this.ensureItemsBox()
        if (!box) return
        const existing = {}
        for (const li of Array.from(box.children)) {
            const name = li.dataset.itemName
            if (name) existing[name] = li
        }

        for (const [name, amount] of Object.entries(items)) {
            let displayAmount = amount
            try {
                if (DataManager.upgrades?.shops?.[name]) {
                    const derived = DataManager.upgrades.getStat(name, 'amount', Number(amount ?? 0) || 0)
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

    async loadShops() {
        if (this._shopsCache) return this._shopsCache
        try {
            const resp = await fetch('ShootTheStars/data/shops.json')
            this._shopsCache = await resp.json()
            return this._shopsCache
        } catch (err) {
            console.warn('Failed to load shops.json', err)
            return {}
        }
    }

    closeShop() {
        const modal = document.getElementById('shop-modal')
        if (!modal) return
        modal.classList.add('hidden')
        modal.setAttribute('aria-hidden', 'true')
        const content = document.getElementById('shop-content')
        if (content) content.innerHTML = ''
    }

    sleep(ms){ return new Promise(r=>setTimeout(r,ms)) }

    async animatePurchaseFinal(entry){
        const fadeMs = SETTINGS.PURCHASE_FADE_MS
        const particleMs = SETTINGS.PURCHASE_PARTICLE_MS
        const particleCount = SETTINGS.PURCHASE_PARTICLE_COUNT
        const particleSpeed = SETTINGS.PURCHASE_PARTICLE_SPEED

        entry.style.position = entry.style.position || 'relative'
        const overlay = document.createElement('div')
        overlay.className = 'purchase-overlay'
        entry.appendChild(overlay)

        overlay.style.transition = `opacity ${fadeMs}ms ease`
        requestAnimationFrame(()=> overlay.style.opacity = '1')
        await this.sleep(fadeMs)

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
        await this.sleep(60)
    }

    async openShopForItem(itemName) {
        await (DataManager.ready || DataManager.init())
        const shops = await this.loadShops()
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
                const persistent = DataManager.saver.getData(`unlocks/${itemName}/${upgradeId}`, false)
                if (persistent) return true
                for (const [condKey, threshold] of Object.entries(def.condition)) {
                    let val = DataManager.saver.getData(condKey, undefined)
                    if (val === undefined || val === null) val = DataManager.saver.getData(`items/${condKey}`, undefined)
                    if (val === undefined || val === null) continue
                    const num = Number(val)
                    if (!Number.isNaN(num) && num >= Number(threshold)) {
                        DataManager.saver.setData(`unlocks/${itemName}/${upgradeId}`, true)
                        try { await DataManager.saver.save() } catch(e){}
                        return true
                    }
                }
                return false
            }

            const isRevealed = async (def, itemName, upgradeId) => {
                if (!def || !def.fog_condition) return true
                const persistent = DataManager.saver.getData(`unlocks/${itemName}/${upgradeId}_fog`, false)
                if (persistent) return true
                for (const [condKey, threshold] of Object.entries(def.fog_condition)) {
                    let val = DataManager.saver.getData(condKey, undefined)
                    if (val === undefined || val === null) val = DataManager.saver.getData(`items/${condKey}`, undefined)
                    if (val === undefined || val === null) continue
                    const num = Number(val)
                    if (!Number.isNaN(num) && num >= Number(threshold)) {
                        DataManager.saver.setData(`unlocks/${itemName}/${upgradeId}_fog`, true)
                        try { await DataManager.saver.save() } catch(e){}
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

                let current = DataManager.saver.getData(`upgrades/${itemName}/${upgradeId}`, 0) ?? 0
                if (!current && def && def.name) {
                    current = DataManager.saver.getData(`upgrades/${itemName}/${def.name}`, 0) ?? 0
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
                    const cur = DataManager.saver.getData(`upgrades/${itemName}/${upgradeId}`, 0) ?? 0
                    const cost = this.calcUpgradeCost(def, cur)
                    metaSpan.textContent = `${cur}/${max} — ${cost} ${currencyKey}`
                }
                refresh()

                entry.addEventListener('click', async () => {
                    const currentInside = DataManager.saver.getData(`upgrades/${itemName}/${upgradeId}`, 0) ?? 0
                    if (currentInside >= max) return
                    const cost = this.calcUpgradeCost(def, currentInside)
                    // `shopCurrencyKey` and `currencyKey` are captured from outer scope
                    let currencyAvailable = 0
                    let currencyIsShop = false
                    try {
                        if (DataManager.upgrades?.shops?.[currencyKey]) {
                            currencyAvailable = Math.floor(Number(DataManager.upgrades.getStat(currencyKey, 'amount', DataManager.saver.getData(`items/${currencyKey}`, 0))) || 0)
                            currencyIsShop = true
                        } else {
                            currencyAvailable = DataManager.saver.getData(`items/${currencyKey}`, 0) ?? 0
                        }
                    } catch (e) { currencyAvailable = DataManager.saver.getData(`items/${currencyKey}`, 0) ?? 0 }
                    if (currencyAvailable < cost) {
                        entry.animate([{transform:'scale(1)'},{transform:'scale(0.98)'},{transform:'scale(1)'}], {duration:220})
                        return
                    }
                    if (currencyIsShop) {
                        const shopDef = DataManager.upgrades?.shops?.[currencyKey]
                        // Prefer deducting from `items/<currencyKey>` (new standard).
                        // Fallback to `upgrades/<currencyKey>/amount` for compatibility.
                        const prevItemsAmt = DataManager.saver.getData(`items/${currencyKey}`, undefined)
                            if (prevItemsAmt === undefined || prevItemsAmt === null) {
                            if (shopDef && shopDef.items && Object.prototype.hasOwnProperty.call(shopDef.items, 'amount')) {
                                    const prevAmt = DataManager.saver.getData(`upgrades/${currencyKey}/amount`, 0) ?? 0
                                DataManager.saver.setData(`upgrades/${currencyKey}/amount`, Math.max(0, prevAmt - cost))
                            } else {
                                    const prevAmt = DataManager.saver.getData(`items/${currencyKey}`, 0) ?? 0
                                    DataManager.saver.setData(`items/${currencyKey}`, Math.max(0, prevAmt - cost))
                            }
                        } else {
                            DataManager.saver.setData(`items/${currencyKey}`, Math.max(0, Number(prevItemsAmt) - cost))
                        }
                    } else {
                        DataManager.saver.setData(`items/${currencyKey}`, currencyAvailable - cost)
                    }

                    // If this upgrade is bound to an item (e.g. harvesters), update
                    // the item count and keep the upgrade level in sync with the
                    // item count. Otherwise just increment the upgrade level.
                    if (def && def.item_to_levels) {
                        const mappedItem = def.item_to_levels
                        const prevItem = DataManager.saver.getData(`items/${mappedItem}`, 0) ?? 0
                        DataManager.saver.setData(`items/${mappedItem}`, prevItem + 1)
                        // Keep the upgrade level compatible with older codepaths.
                        DataManager.saver.setData(`upgrades/${itemName}/${upgradeId}`, prevItem + 1)
                    } else {
                        DataManager.saver.setData(`upgrades/${itemName}/${upgradeId}`, currentInside + 1)
                    }
                    if (def && def.unlocks_shop) {
                        const shopKey = def.unlocks_shop
                        DataManager.saver.setData(`unlocks/shops/${shopKey}`, true)
                        const items = DataManager.saver.getData('items') || {}
                        if (!(shopKey in items)) {
                            DataManager.saver.setData(`items/${shopKey}`, 0)
                        }
                        try {
                            // When unlocking a shop that represents an item (like
                            // harvesters), grant one item and keep upgrades in
                            // sync if the shop defines such a binding.
                                const prevItem = DataManager.saver.getData(`items/${shopKey}`, 0) ?? 0
                                DataManager.saver.setData(`items/${shopKey}`, prevItem + 1)
                                // Also attempt to keep any `upgrades/<shop>/amount`
                                // key in sync for compatibility.
                                DataManager.saver.setData(`upgrades/${shopKey}/amount`, prevItem + 1)
                        } catch (e) { console.warn('failed to grant free harvester', e) }
                    }
                    await DataManager.saver.save()
                    const newCurrent = currentInside + 1
                    const finalBought = (newCurrent >= max)
                    if (finalBought) {
                        try {
                            await this.animatePurchaseFinal(entry)
                        } catch (e) { console.warn('purchase animation failed', e) }
                        this.openShopForItem(itemName)
                    } else {
                        this.openShopForItem(itemName)
                    }
                })
                list.appendChild(entry)
            }
            content.appendChild(list)
        }

        modal.classList.remove('hidden')
        modal.setAttribute('aria-hidden', 'false')
    }

    init() {
        if (this.itemsContainer) {
            this._onItemsClick = (ev) => {
                let el = ev.target
                while (el && el !== this.itemsContainer) {
                    if (el.matches && el.matches('.item')) {
                        const name = el.dataset.itemName
                        if (name) this.openShopForItem(name)
                        return
                    }
                    el = el.parentNode
                }
            }
            this.itemsContainer.addEventListener('click', this._onItemsClick)
        }

        this._onDocClick = (ev) => { if (ev.target && ev.target.id === 'shop-close') this.closeShop() }
        document.addEventListener('click', this._onDocClick)

        this._onKeyDown = (ev) => { if (ev.key === 'Escape') this.closeShop() }
        window.addEventListener('keydown', this._onKeyDown)
    }

    startItemsSync(pollMs = 500) {
        if (this._itemsSyncInterval || this._saverListenerKey) return
        // Prefer event-driven updates if Saver exposes an onChange Signal
        try {
            if (DataManager.saver.onChange) {
                this._saverListenerKey = 'ShopManager_renderItems'
                DataManager.saver.onChange.connect(this._saverListenerKey, (path, value) => {
                    // only re-render when items (or upgrades/unlocks) change
                    if (!path) return this.renderItemsList()
                    if (typeof path === 'string' && (path === 'items' || path.startsWith('items/') || path.startsWith('upgrades/') || path.startsWith('unlocks/'))) this.renderItemsList()
                    else if (path === '/' || path === '') this.renderItemsList()
                })
                // initial render
                this.renderItemsList()
                return
            }
        } catch (e) {}
        // fallback: polling
        this._itemsSyncInterval = setInterval(()=>this.renderItemsList(), pollMs)
    }
    stopItemsSync() {
        if (this._itemsSyncInterval) {
            clearInterval(this._itemsSyncInterval)
            this._itemsSyncInterval = null
        }
        if (this._saverListenerKey && DataManager.saver.onChange) {
            try { DataManager.saver.onChange.disconnect(this._saverListenerKey) } catch (e) {}
            this._saverListenerKey = null
        }
    }

    dispose() {
        this.stopItemsSync()
        if (this.itemsContainer && this._onItemsClick) {
            try { this.itemsContainer.removeEventListener('click', this._onItemsClick) } catch (e) {}
            this._onItemsClick = null
        }
        if (this._onDocClick) { try { document.removeEventListener('click', this._onDocClick) } catch(e) {} this._onDocClick = null }
        if (this._onKeyDown) { try { window.removeEventListener('keydown', this._onKeyDown) } catch(e) {} this._onKeyDown = null }
        this.itemsBox = null
    }
}

const Shop = new ShopManager()
export default Shop
