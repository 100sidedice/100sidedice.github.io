export default class UpgradesManager {
    constructor(saver) {
        this.saver = saver
        this.shops = null
        this._loadPromise = this._loadShops()
    }

    async _loadShops() {
        try {
            const resp = await fetch('ShootTheStars/data/shops.json')
            this.shops = await resp.json()
        } catch (err) {
            console.warn('UpgradesManager: failed to load shops.json', err)
            this.shops = {}
        }
        return this.shops
    }

    // Return shop definition for an item (keyed by lowercased item name)
    getShopForItem(itemName) {
        if (!itemName) return null
        const key = String(itemName).toLowerCase()
        return this.shops && this.shops[key] ? this.shops[key] : null
    }

    // Synchronously compute a stat after applying purchased upgrades.
    // If shops are not loaded yet, returns the base value.
    getStat(itemName, statName, baseValue) {
        if (!this.shops) return baseValue
        const shop = this.getShopForItem(itemName)
        if (!shop || !shop.items) return baseValue

        // collect modifications in buckets so we can apply (base + adds) * muls
        let addSum = 0
        let mulProduct = 1
        let setValue = undefined

        for (const [upgradeId, def] of Object.entries(shop.items)) {
            const effect = def.effect
            if (!effect || effect.stat !== statName) continue
            let bought = this.saver.getData(`upgrades/${itemName}/${upgradeId}`, 0)
            // compatibility: check old-style display-name key if no purchases found
            if (!bought && def && def.name) {
                const oldBought = this.saver.getData(`upgrades/${itemName}/${def.name}`, 0)
                if (oldBought) bought = oldBought
            }
            if (!bought) continue
            const amt = effect.amount ?? 0
            const action = (effect.action || 'add')
            if (action === 'add') {
                let effective = amt * bought
                // support optional threshold scaling driven by JSON (e.g. def.threshold or def.harvester_threshold)
                const threshold = def.threshold ?? def.harvester_threshold ?? 0
                if (threshold > 0) {
                    const subjectAmount = this.getStat(itemName, 'amount', 0) ?? 0
                    const scale = Math.min(1, subjectAmount / threshold)
                    effective = effective * scale
                }
                addSum += effective
            } else if (action === 'mul' || action === 'multiply') {
                let effectivePow = Math.pow(amt, bought)
                const thresholdMul = def.threshold ?? def.harvester_threshold ?? 0
                if (thresholdMul > 0) {
                    const subjectAmount = this.getStat(itemName, 'amount', 0) ?? 0
                    const scale = Math.min(1, subjectAmount / thresholdMul)
                    // blend between 1 and effectivePow based on scale
                    effectivePow = 1 + (effectivePow - 1) * scale
                }
                mulProduct *= effectivePow
            } else if (action === 'set') {
                setValue = amt
            }
        }

        let value = (baseValue + addSum) * mulProduct
        if (setValue !== undefined) value = setValue
        return value
    }
}
