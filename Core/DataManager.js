import Saver from './Saver.js'
import UpgradesManager from '../ShootTheStars/upgrades.js'
import { Mouse, Keys } from './input.js'

class DataManager {
    constructor() {
        this.saver = null
        this.upgrades = null
        this.mouse = null
        this.keys = null
        this.ready = null
    }

    async init({ canvas, saverOptions } = {}) {
        if (this.ready) return this.ready
        this.ready = (async () => {
            // initialize saver
            this.saver = new Saver(saverOptions || { dbName: '100sidedice', saveId: 'default' })
            await this.saver.ready

            // initialize upgrades (passes saver for persistence)
            this.upgrades = new UpgradesManager(this.saver)
            // wait for upgrades to load shops
            if (this.upgrades && this.upgrades._loadPromise) await this.upgrades._loadPromise

            // input
            if (canvas) {
                this.mouse = new Mouse(canvas)
            }
            this.keys = new Keys()

            return this
        })()
        return this.ready
    }

    // convenience to dispose inputs and other resources
    dispose() {
        try { if (this.mouse && typeof this.mouse.dispose === 'function') this.mouse.dispose() } catch (e) {}
        try { if (this.keys && typeof this.keys.dispose === 'function') this.keys.dispose() } catch (e) {}
        try { if (this.saver && typeof this.saver.save === 'function') this.saver.save() } catch (e) {}
        this.mouse = null
        this.keys = null
        this.saver = null
        this.upgrades = null
        this.ready = null
    }
}

const dataManager = new DataManager()
export default dataManager
