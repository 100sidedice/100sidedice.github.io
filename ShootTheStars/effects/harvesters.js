class Harvester {
    constructor(group, x, y) {
        this.group = group
        this.pos = { x: x, y: y }
        this.vel = { x: 0, y: 0 }
        this.target = null
        this.radius = 8
    }

    findTarget() {
        // choose nearest star
        const stars = this.group.starGroup.stars
        if (!stars || stars.length === 0) return null
        let best = null
        let bestDist = Infinity
        for (const s of stars) {
            // skip if already claimed by another harvester
            if (this.group.claimed && this.group.claimed.has(s)) continue
            const dx = s.pos.x - this.pos.x
            const dy = s.pos.y - this.pos.y
            const d = Math.hypot(dx, dy)
            if (d < bestDist) { bestDist = d; best = s }
        }
        return best
    }

    update(dt) {
        const speed = Number(this.group.getSpeed()) || 80
        const drift = Number(this.group.getDrift()) || 0.15

        if (!this.target || this.group.starGroup.stars.indexOf(this.target) === -1) {
            // unclaim previous if it was removed
            if (this.target && this.group.claimed) this.group.claimed.delete(this.target)
            this.target = null
            const t = this.findTarget()
            if (t) {
                this.target = t
                if (this.group.claimed) this.group.claimed.add(t)
            }
        }
        if (this.target) {
            const dx = this.target.pos.x - this.pos.x
            const dy = this.target.pos.y - this.pos.y
            const dist = Math.hypot(dx, dy)

            // introduce inaccuracy proportional to (1 - drift) so low-drift harvesters miss more
            const inaccuracy = Math.max(0, 1 - drift)
            const targetAngle = Math.atan2(dy, dx)
            const angleNoise = (Math.random() - 0.5) * inaccuracy * Math.PI * 0.9
            const desiredAngle = targetAngle + angleNoise
            const desired = { x: Math.cos(desiredAngle) * speed, y: Math.sin(desiredAngle) * speed }

            // apply steering: stronger drift increases how quickly velocity aligns to desired
            const steerFactor = Math.min(1, drift * dt * 6)
            this.vel.x += (desired.x - this.vel.x) * steerFactor
            this.vel.y += (desired.y - this.vel.y) * steerFactor

            // clamp velocity magnitude
            const vmag = Math.hypot(this.vel.x, this.vel.y)
            if (vmag > speed) {
                this.vel.x = this.vel.x / vmag * speed
                this.vel.y = this.vel.y / vmag * speed
            }

            // move
            this.pos.x += this.vel.x * dt
            this.pos.y += this.vel.y * dt

            // check collision with target after movement (so misses while sliding are possible)
            const ndx = this.target.pos.x - this.pos.x
            const ndy = this.target.pos.y - this.pos.y
            const newDist = Math.hypot(ndx, ndy)
            const hitDist = this.target.size + this.radius
            if (newDist < hitDist) {
                // unclaim then collect target as if user clicked it
                if (this.group.claimed) this.group.claimed.delete(this.target)
                this.group.starGroup.collectStar(this.target)
                // immediately forget target and find next
                this.target = null
            }
        } else {
            // wander slowly
            this.pos.x += (Math.random() - 0.5) * 10 * dt
            this.pos.y += (Math.random() - 0.5) * 10 * dt
        }
    }

    draw(ctx, dragon = null) {
        if (!dragon){
            // draw a subtle red line toward target
            
            ctx.fillStyle = '#35aaff33'
            ctx.beginPath()
            ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2)
            ctx.fill()
        }else{
            
            // draw blue harvester
            const dx = this.target ? this.target.pos.x - this.pos.x : this.vel.x
            if(dx > 0){
                ctx.save()
                ctx.translate(this.pos.x, this.pos.y)
                ctx.scale(-1,1)
                ctx.drawImage(dragon, -this.radius, -this.radius, this.radius*2, this.radius*2);
                ctx.restore()
            }else{
                ctx.drawImage(dragon, this.pos.x-this.radius, this.pos.y-this.radius, this.radius*2, this.radius*2);
            }
        }
        

    }
}

export class HarvesterGroup {
    constructor(starGroup) {
        this.harvesters = []
        this.starGroup = starGroup
        this.claimed = new Set()
    }

    // query upgrades via global manager
    getAmount() {
        if (window.upgrades && typeof window.upgrades.getStat === 'function') return Math.max(0, Math.floor(window.upgrades.getStat('harvesters','amount',0)))
        return 0
    }
    getSpeed() {
        if (window.upgrades && typeof window.upgrades.getStat === 'function') return Number(window.upgrades.getStat('harvesters','speed',80))
        return 80
    }
    getDrift() {
        // default low drift (lots of sliding). Upgrades should increase this toward 1.0
        if (window.upgrades && typeof window.upgrades.getStat === 'function') return Number(window.upgrades.getStat('harvesters','drift',0.15))
        return 0.15
    }

    sync() {
        const need = this.getAmount()
        while (this.harvesters.length < need) {
            const x = Math.random() * window.innerWidth
            const y = Math.random() * window.innerHeight
            this.harvesters.push(new Harvester(this, x, y))
        }
        while (this.harvesters.length > need) {
            const h = this.harvesters.pop()
            if (h && h.target && this.claimed) this.claimed.delete(h.target)
        }
    }

    update(dt) {
        this.sync()
        for (const h of this.harvesters) h.update(dt)
    }

    draw(ctx, dragon=null) {
        for (const h of this.harvesters) h.draw(ctx, dragon)
    }
}
