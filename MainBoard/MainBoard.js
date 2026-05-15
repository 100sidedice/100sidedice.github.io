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
        this._onCloseClick = () => this.clear()
        this.closeBtn.addEventListener('click', this._onCloseClick)
        this.panel.appendChild(this.closeBtn)

        // content container
        this.content = document.createElement('div')
        this.content.className = 'content'
        this.panel.appendChild(this.content)

        this.container.appendChild(this.panel)
        this._visible = false
        this._opacity = 0
        this._fadeSpeed = 3.0 // opacity units per second
        this._boundButtons = []
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
        const handler = () => { this.getMenuAction(menuAction) }
        btn.addEventListener(buttonAction, handler)
        this._boundButtons.push({btn, action: buttonAction, handler})
    }

    // Remove all event listeners and DOM references
    dispose() {
        try {
            if (this.closeBtn && this._onCloseClick) this.closeBtn.removeEventListener('click', this._onCloseClick)
        } catch (e) {}
        for (const b of this._boundButtons) {
            try { b.btn.removeEventListener(b.action, b.handler) } catch (e) {}
        }
        this._boundButtons = []
        try { if (this.panel && this.panel.parentNode) this.panel.parentNode.removeChild(this.panel) } catch (e) {}
        this.panel = null
        this.container = null
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
                this.setText(parseText(this.textFile, "about", "text", "types", "images"))
                this.toggle()
                break;
            case 'play':
                this.setText(parseText(this.textFile, "play", "text", "types", "images"))
                this.toggle()
                break;
            case 'projects':
                // render the projects collection as stacked article blocks
                this.setText(renderProjects(this.textFile))
                this.toggle()
                break;
            default:
                // attempt a generic render if the json contains the key
                if (this.textFile && this.textFile[action]) {
                    this.setText(parseText(this.textFile, action, "text", "types", "images"))
                    this.toggle()
                } else {
                    console.log(`No menu action found for ${action}`)
                }
                break;
        }
    }
}
function renderProjects(textFile){
    if (!textFile) return ''
    const now = new Date().toISOString()
    // prefer explicit projects array, fallback to keys that start with 'project-'
    let projects = []
    if (Array.isArray(textFile.projects)) projects = textFile.projects
    else projects = Object.keys(textFile).filter(k=>k.startsWith('project-')).map(k=>Object.assign({id:k}, textFile[k]))

    let out = ''
    for (const p of projects){
        // simple article: time, title, image (if provided) — keep layout natural flow
        const timeVal = p.time || now
        out += `<article class="project-item"><time datetime="${timeVal}">${timeVal}</time>`
        out += `<h2>${p.title || (p.text && p.text[0]) || (p.id || 'Project')}</h2>`
        if (p.image) {
            const src = p.image
            if (p.link) {
                out += `<figure><a href="${p.link}" target="_blank" rel="noopener noreferrer"><img class=\"project-image tilt\" src=\"${src}\" alt=\"${p.title || ''}\"></a></figure>`
            } else {
                out += `<figure><img class=\"project-image tilt\" src=\"${src}\" alt=\"${p.title || ''}\"></figure>`
            }
        }
        if (p.text && p.text.length>1){
            for (let i=1;i<p.text.length;i++){
                out += `<p>${p.text[i]}</p>`
            }
        }
        out += `</article>`
    }
    return out
}
function parseText(textFile, name_key, text_key, token_key, image_key){
    const entry = textFile[name_key]
    if (!entry) return ''
    const textArray = entry[text_key] || []
    const tokens = entry[token_key] || []

    let finalText = ""
    // interleave text and inserted images. images with an `insert` key will be
    // rendered inline immediately after the text index specified by `insert`.
    const images = (image_key && Array.isArray(entry[image_key])) ? entry[image_key].slice() : []

    for (let i = 0; i < textArray.length; i++){
        if (tokens.length <= i) break;
        finalText += `<${tokens[i]}>${textArray[i]}</${tokens[i]}>`

        // images with insert === i should be placed here (flow layout)
        const toInsert = images.filter(img => String(img.insert) === String(i))
        for (const img of toInsert) {
            const src = img.ref || img.src || ''
            const x = (typeof img.x === 'number') ? img.x : 0
            const y = (typeof img.y === 'number') ? img.y : 0
            const scale = (typeof img.scale === 'number') ? img.scale : 1
            // To make percent offsets relative to the container center, render a
            // hidden spacer image to reserve flow space and an absolutely
            // positioned visible image centered in the wrapper. The offsets
            // (`x`,`y`) are applied to the visible image as percent offsets.
            finalText += `<div class="mainboard-images inserted" style="--tx:${x}%; --ty:${y}%; --scale:${scale};">` +
                         `<img class="mainboard-image spacer" src="${src}" alt="" aria-hidden="true">` +
                         `<img class="mainboard-image inserted" src="${src}" alt="" ` +
                         `data-x="${x}" data-y="${y}" data-scale="${scale}">` +
                         `</div>`
        }
        // remove inserted ones from images list so they are not rendered again
        if (toInsert.length) {
            for (const ins of toInsert) {
                const idx = images.indexOf(ins)
                if (idx !== -1) images.splice(idx, 1)
            }
        }
    }

    // remaining images (without insert) are rendered as overlayed artwork
    if (images.length > 0) {
        finalText += '<div class="mainboard-images overlay">'
        for (const img of images){
            const src = img.ref || img.src || ''
            const x = (typeof img.x === 'number') ? img.x : 0
            const y = (typeof img.y === 'number') ? img.y : 0
            const scale = (typeof img.scale === 'number') ? img.scale : 1
            const style = `position:absolute; left:50%; top:50%; transform: translate(-50%,-50%) translate(${x}%, ${y}%) scale(${scale});`
            finalText += `<img class="mainboard-image" src="${src}" alt="" style="${style}" ` +
                         `data-x="${x}" data-y="${y}" data-scale="${scale}">`
        }
        finalText += '</div>'
    }

    return finalText
}