import { StarGroup } from "./effects/stars.js"
import { HarvesterGroup } from "./effects/harvesters.js"
import { initShop, startItemsSync, stopItemsSync, renderItemsList } from "./shop.js"

export default class ShootTheStars {
    static async preload() {
        // initialize shop UI and start syncing
        initShop()
        startItemsSync()
        renderItemsList()

        
    }

    constructor(ctx) {
        this.ctx = ctx
        this.starGroup = new StarGroup()
        this.harvesterGroup = new HarvesterGroup(this.starGroup)
        this.starGroup.spawnInitalStars()

        this.dragon = null
    }

    draw() {
        // draw using CSS-pixel coordinates
        this.ctx.fillStyle = '#06021a'
        this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight)

        this.starGroup.draw(this.ctx)
        this.harvesterGroup.draw(this.ctx, this.dragon)
    }

    update(deltaTime) {
        this.starGroup.update(deltaTime)
        if (window.saver) renderItemsList()
        this.harvesterGroup.update(deltaTime)
    }
}
