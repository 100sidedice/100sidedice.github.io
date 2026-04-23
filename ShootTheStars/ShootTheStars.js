import { StarGroup } from "./effects/stars.js"
import { HarvesterGroup } from "./effects/harvesters.js"
import Shop from "./shop.js"
import DataManager from '../Core/DataManager.js'



export default class ShootTheStars {
    static async preload() {
        // initialize shop UI and start syncing
        Shop.init()
        Shop.startItemsSync()
        Shop.renderItemsList()

        
    }

    constructor(ctx) {
        this.ctx = ctx
        this.starGroup = new StarGroup()
        this.harvesterGroup = new HarvesterGroup(this.starGroup)
        this.starGroup.spawnInitalStars()

        this.dragon = null

          window.Debug.createSignal("setItem", (name,amount)=>{
              DataManager.saver.setData(`items/${name}`, amount);
          })
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
        Shop.renderItemsList()
        this.harvesterGroup.update(deltaTime)
    }
}
