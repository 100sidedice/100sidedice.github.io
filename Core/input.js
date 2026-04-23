// input.js
// Provides Mouse and Keys classes with per-frame update semantics.

class Button {
  constructor() {
    this.held = false;
    this._justPressed = false;
    this._justReleased = false;
  }

  press() {
    if (!this.held) {
      this.held = true;
      this._justPressed = true;
    }
  }

  release() {
    if (this.held) {
      this.held = false;
      this._justReleased = true;
    }
  }

  // Call each frame with deltaTime (seconds)
  update(dt) {
    // justPressed/justReleased last exactly one update tick
    this._justPressed = false;
    this._justReleased = false;
  }

  isHeld() { return this.held; }
  justPressed() { return this._justPressed; }
  isReleased() { return this._justReleased; }
}

class Mouse {
  constructor(canvas) {
    if (!canvas) throw new Error('Mouse requires a canvas element');
    this.canvas = canvas;
    this.left = new Button();
    this.right = new Button();
    this.x = 0;
    this.y = 0;
    this._lastX = 0;
    this._lastY = 0;
    this.dx = 0;
    this.dy = 0;

    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onContextMenu = this._onContextMenu.bind(this);

    this.canvas.addEventListener('pointerdown', this._onPointerDown, {passive: false});
    this.canvas.addEventListener('pointerup', this._onPointerUp, {passive: false});
    this.canvas.addEventListener('pointermove', this._onPointerMove, {passive: true});
    this.canvas.addEventListener('contextmenu', this._onContextMenu);
  }

  _onPointerDown(e) {
    // Only handle primary/secondary buttons
    if (e.button === 0) this.left.press();
    if (e.button === 2) this.right.press();
    try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
    // prevent defaults only when interacting with the canvas element to avoid interfering with other UI
    if (e.target === this.canvas || this.canvas.contains && this.canvas.contains(e.target)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  _onPointerUp(e) {
    if (e.button === 0) this.left.release();
    if (e.button === 2) this.right.release();
    try { e.target.releasePointerCapture(e.pointerId); } catch (err) {}
    if (e.target === this.canvas || this.canvas.contains && this.canvas.contains(e.target)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  _onPointerMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.x = x;
    this.y = y;
  }

  _onContextMenu(e) {
    // prevent default context menu on canvas so right-click acts as input
    e.preventDefault();
  }

  update(dt) {
    this.dx = this.x - this._lastX;
    this.dy = this.y - this._lastY;
    this._lastX = this.x;
    this._lastY = this.y;
    this.left.update(dt);
    this.right.update(dt);
  }

  // Remove event listeners when disposed to avoid leaks
  dispose() {
    try {
      this.canvas.removeEventListener('pointerdown', this._onPointerDown, {passive: false});
      this.canvas.removeEventListener('pointerup', this._onPointerUp, {passive: false});
      this.canvas.removeEventListener('pointermove', this._onPointerMove, {passive: true});
      this.canvas.removeEventListener('contextmenu', this._onContextMenu);
    } catch (e) {}
  }
}

class Keys {
  constructor() {
    this._map = Object.create(null);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._onKeyDown, {passive: false});
    window.addEventListener('keyup', this._onKeyUp, {passive: false});
  }

  _isTypingElement() {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || el.isContentEditable) return true;
    return false;
  }

  _onKeyDown(e) {
    if (this._isTypingElement()) return; // prevent input bleed
    const k = e.key;
    let btn = this._map[k];
    if (!btn) { btn = new Button(); this._map[k] = btn; }
    btn.press();
    // prevent default to stop page scrolling for space/arrow keys when canvas is focused
    e.preventDefault();
  }

  _onKeyUp(e) {
    if (this._isTypingElement()) return;
    const k = e.key;
    let btn = this._map[k];
    if (!btn) { btn = new Button(); this._map[k] = btn; }
    btn.release();
    e.preventDefault();
  }

  // Update per frame and clear one-frame flags
  update(dt) {
    for (const k in this._map) {
      this._map[k].update(dt);
    }
  }

  // Accessors
  isHeld(key) {
    const b = this._map[key];
    return b ? b.isHeld() : false;
  }
  justPressed(key) {
    const b = this._map[key];
    return b ? b.justPressed() : false;
  }
  isReleased(key) {
    const b = this._map[key];
    return b ? b.isReleased() : false;
  }

  // Get the Button object for advanced use
  getButton(key) {
    if (!this._map[key]) this._map[key] = new Button();
    return this._map[key];
  }

  // Remove key listeners to avoid leaks
  dispose() {
    try {
      window.removeEventListener('keydown', this._onKeyDown, {passive: false});
      window.removeEventListener('keyup', this._onKeyUp, {passive: false});
    } catch (e) {}
  }
}

// Export classes; avoid creating globals here. Use Core/DataManager for centralized instances.

export { Mouse, Keys };
