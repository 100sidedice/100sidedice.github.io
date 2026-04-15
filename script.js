import globalizeSettings from "./ShootTheStars/data/settings.js"
globalizeSettings() // Make settings available globally

import ShootTheStars from "./ShootTheStars/ShootTheStars.js"
import Saver from "./Core/Saver.js"
import { Mouse, Keys } from "./Core/input.js"
import UpgradesManager from "./ShootTheStars/upgrades.js"
import MainBoard from "./MainBoard/MainBoard.js"


// Input instances (globalized in input.js as classes)

const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d') 

/**
 * messy, but in this case just easier
 */
window.mouse = new Mouse(canvas)
window.keys = new Keys()
window.saver = new Saver({dbName: '100sidedice', saveId: 'default'})
window.upgrades = new UpgradesManager(window.saver)


function resizeCanvas() {
	const dpr = window.devicePixelRatio || 1
	// Set the CSS size to the viewport size
	canvas.style.width = window.innerWidth + 'px'
	canvas.style.height = window.innerHeight + 'px'
	// Set the drawing buffer size scaled by devicePixelRatio for sharpness
	canvas.width = Math.floor(window.innerWidth * dpr)
	canvas.height = Math.floor(window.innerHeight * dpr)
	// Scale drawing operations to use CSS pixels
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}



// Shop UI is handled in ShootTheStars/shop.js (initShop, startItemsSync, renderItemsList)

/**
 * Main program class
 */
class Program {
    constructor() {
        this.game = new ShootTheStars(ctx)

        

        this.autosaveInterval = 10000 // 10 seconds
        this.lastAutosave = performance.now()
        // Start autosave timer
        this.autosaveTimer = setInterval(() => {
            window.saver.save()
        }, this.autosaveInterval)
    }

    // Core loop: compute delta, handle input, delegate to game
    loop() {
        const now = performance.now()
        // compute delta time (seconds) and cap to 0.25s to avoid large jumps
        const rawDt = (now - (this.lastTime || now)) / 1000
        this.deltaTime = Math.min(rawDt, 0.25)
        this.lastTime = now

        window.keys.update(this.deltaTime)
        window.mouse.update(this.deltaTime)
        // update main information panel
        this.mainBoard.update(this.deltaTime)

        this.game.update(this.deltaTime)

        

        this.game.draw()
        window.requestAnimationFrame(this.loop.bind(this))
    }
    static async preload() {
        console.log('hello')
        // wait for saver and upgrades so game state reflects upgrades immediately
        await window.saver.ready
        await window.upgrades._loadPromise

        
        ShootTheStars.preload() // initialize shop and start syncing items
        
        // create program and mainBoard, then start loop
        const program = new Program()
        // Create the mainBoard UI and load text content from JSON file
        program.mainBoard = new MainBoard()
        await program.mainBoard.loadJson('text.json')

        program.mainBoard.addButton('about', 'click', 'about')

        const dragon = new Image();
        dragon.src = "Dragon/dragon.png";
        await dragon.decode();

        program.game.dragon = dragon

        // start the main loop
        program.loop()


        // Add pressed state handling for left sidebar buttons so they clear on mouseup anywhere
        const onPointerDown = (ev) => {
            const b = ev.target.closest && ev.target.closest('.linkbox')
            if (b) {
                b.classList.add('pressed')
            }
        }
        const clearPressed = ()=>{
            document.querySelectorAll('.linkbox.pressed').forEach(el=>el.classList.remove('pressed'))
        }
        document.addEventListener('mousedown', onPointerDown)
        document.addEventListener('mouseup', clearPressed)
        return program
    }
}


window.addEventListener('resize', resizeCanvas)
window.addEventListener('orientationchange', resizeCanvas)
resizeCanvas()

// start preload; any errors will be logged
Program.preload().catch((e)=>{ 
    console.error('Program.preload failed', e) 
})