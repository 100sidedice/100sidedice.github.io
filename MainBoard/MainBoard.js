/* MainBoard UI controller: manages the info panel content and simple animations */
export default class MainBoard {
    constructor() {
        this.container = document.getElementById('mainBoard')
        if (!this.container) return
        this.panel = document.createElement('div')
        this.panel.className = 'panel'

        // close button
        this.closeBtn = document.createElement('button')
        this.closeBtn.className = 'mainboard-close'
        this.closeBtn.setAttribute('aria-label', 'Close')
        this.closeBtn.textContent = '×'
        this.closeBtn.addEventListener('click', ()=> this.clear())
        this.panel.appendChild(this.closeBtn)

        // content container
        this.content = document.createElement('div')
        this.content.className = 'content'
        this.panel.appendChild(this.content)

        this.container.appendChild(this.panel)
        this._visible = false
        this._opacity = 0
        this._fadeSpeed = 3.0 // opacity units per second
        // don't absorb pointer events until visible
        this.container.style.pointerEvents = 'none'
        this.panel.style.pointerEvents = 'none'
    }

    setText(html) {
        if (!this.panel) return
        this.content.innerHTML = html
    }

    clear() {
        if (!this.panel) return
          this.content.innerHTML = ''
        this.hide()
    }

    show() { this._visible = true; this._opacity = 0 }
    hide() { this._visible = false }

    toggle() {
        if (this._visible) this.hide()
        else this.show()
    }

    update(dt) {
        if (!this.panel) return
        // simple fade out when not visible
        if (this._visible) {
            this._opacity = Math.min(1, this._opacity + dt * this._fadeSpeed)
        } else {
            this._opacity = Math.max(0, this._opacity - dt * this._fadeSpeed)
        }
        this.panel.style.opacity = String(this._opacity)
        this.panel.style.pointerEvents = this._opacity > 0.02 ? 'auto' : 'none'
        // ensure container doesn't absorb input when hidden
        if (this.container) this.container.style.pointerEvents = this._opacity > 0.02 ? 'auto' : 'none'
    }

    addButton(buttonID, buttonAction, menuAction){
        if (!this.panel) return
        const btn = document.querySelector(`#${buttonID}`)
        if (!btn) return
        btn.addEventListener(buttonAction, () => {
            this.getMenuAction(menuAction)
        })
    }
    async loadJson(filePath){
        try {
            const file = JSON.parse(await (await fetch(filePath)).text())
            this.textFile = file
            return file
        }catch(err){
            console.warn(`[MainBoard]: Error loading ${filePath}`, err)
        }
    }

    getMenuAction(action){
        switch(action){
            case 'about':
                this.setText(parseText(this.textFile, "about", "text", "types"))
                this.toggle()
                break;
            case 'play':
                this.setText(parseText(this.textFile, "play", "text", "types"))
                this.toggle()
                break;
            default:
                console.log(`No menu action found for ${action}`)
                break;
        }
    }
}
function parseText(textFile, name_key, text_key, token_key){
    const textArray = textFile[name_key][text_key]
    const tokens = textFile[name_key][token_key]

    let finalText = ""
    for (let i = 0; i < textArray.length; i++){
        if (tokens.length < i) break;
        finalText += `<${tokens[i]}>`
        finalText += textArray[i]
        finalText += `</${tokens[i]}>`
    }
    return finalText
}