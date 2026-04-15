import Vector from './Vector.js';
import Signal from './Signal.js';

function getCallerLocation(stackShift = 3) {
    // Create a new error to get the stack trace
    const err = new Error();
    if (!err.stack)
        return '';
    const lines = err.stack.split('\n');
    // stackShift: 0=Error, 1=this function, 2=log/error, 3=caller
    if (lines.length > stackShift) {
        const match = lines[stackShift].match(/\(?([^\s\)]+):(\d+):(\d+)\)?$/);
        if (match) {
            return `${match[1]}:${match[2]}`;
        }
        else {
            // Fallback: show the whole line
            return lines[stackShift].trim();
        }
    }
    return '';
}
/**
 * Provides an on-screen log panel and input for commands/signals, with global error handling and console patching.
 * This is a simple console replacement so I can see logs/errors in school (as devtools is blocked). 
 * It also supports custom signals and flags for quick debugging actions.
 */
class Debug {
    show() {
        this.visible = true;
        this.element.style.background = '#000000cc';
        this.input.style.display = '';
        this._renderLogs();
        try {
            this.element.scrollTop = this.element.scrollHeight;
        } catch (e) {}
    }

    hide() {
        this.visible = false;
        this.element.style.background = '#00000000';
        this.input.style.display = 'none';
        this.element.textContent = '';
    }
    constructor() {
        // Logger overlay
        this.element = document.getElementById('debug');
        if (!this.element) {
            this.element = document.createElement('pre');
            this.element.id = 'debug';
            this.element.style.position = 'fixed';
            this.element.style.left = '0';
            this.element.style.bottom = '0';
            this.element.style.width = '100vw';
            this.element.style.maxHeight = '80vh';
            this.element.style.overflowY = 'auto';
            this.element.style.background = '#000000cc';
            this.element.style.color = '#fff';
            this.element.style.fontSize = '14px';
            this.element.style.zIndex = '9999';
            this.element.style.pointerEvents = 'auto';
            this.element.style.whiteSpace = 'pre-wrap';
            this.element.style.fontFamily = 'monospace';
            this.element.style.padding = '8px 4px 32px 4px';
            this.element.style.boxSizing = 'border-box';
            document.body.appendChild(this.element);
        }
        // Input box
        this.input = document.getElementById('debug-input');
        if (!this.input) {
            this.input = document.createElement('input');
            this.input.id = 'debug-input';
            this.input.type = 'text';
            this.input.style.position = 'fixed';
            this.input.style.left = '0';
            this.input.style.bottom = '0';
            this.input.style.width = '100vw';
            this.input.style.height = '24px';
            this.input.style.zIndex = '10000';
            this.input.style.background = '#222';
            this.input.style.color = '#fff';
            this.input.style.fontSize = '16px';
            this.input.style.fontFamily = 'monospace';
            this.input.style.border = 'none';
            this.input.style.outline = 'none';
            this.input.style.padding = '4px 8px';
            this.input.style.boxSizing = 'border-box';
            this.input.style.pointerEvents = 'auto';
            document.body.appendChild(this.input);
        }

        // Keyword signals map
        this.signals = new Map();
        // Generic flags map (used by other systems to toggle quick behaviors)
        this.flags = new Map();

        // Ensure wheel events on the input are handled (whether the input pre-existed or was just created).
        this.logs = [];
        
        this._debugInputWheelAdded = true;
        const wheelHandler = (e) => {
            try {
                const delta = -e.deltaY;
                if (!this.logs || this.logs.length <= 1) {
                    e.preventDefault();
                    return;
                }
                // Determine how many entries to rotate based on delta magnitude for smoother scroll
                const step = Math.max(1, Math.round(Math.abs(delta) / 50));
                if (delta < 0) {
                    // Scrolling up: move first element(s) to the bottom
                    for (let i = 0; i < step; i++) {
                        const first = this.logs.shift();
                        if (first !== undefined) this.logs.push(first);
                    }
                } else if (delta > 0) {
                    // Scrolling down: move last element(s) to the top
                    for (let i = 0; i < step; i++) {
                        const last = this.logs.pop();
                        if (last !== undefined) this.logs.unshift(last);
                    }
                }
                if (this.visible) this._renderLogs();
                e.preventDefault();
            } catch (err) {
                // ignore
            }
        };

        this.element.addEventListener('wheel', wheelHandler, { passive: false });
        if (this.input) this.input.addEventListener('wheel', wheelHandler, { passive: false });
        
        this.visible = true;
        this.ok = true;
        this._patchGlobal();
        this._setupInput();
        this._setupToggle();

        this.createSignal('copylogs', () => {
            try {
                const text = this.logs
                    .map(l => (typeof l === 'string' ? l : JSON.stringify(l)))
                    .join('\n');

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(() => {
                        this.log('[Debug] Logs copied to clipboard');
                    }).catch(err => {
                        this.error('Clipboard write failed: ' + err);
                    });
                } else {
                    // Fallback for older browsers
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    try {
                        document.execCommand('copy');
                        this.log('[Debug] Logs copied (fallback)');
                    } catch (err) {
                        this.error('Fallback copy failed: ' + err);
                    }
                    document.body.removeChild(textarea);
                }
            } catch (err) {
                this.error('copyLogs signal error: ' + err);
            }
        });
    }
    /**
     * Register a keyword and its action. When the keyword is entered in the debug input, the action will be executed.
     * The action will receive any parameters entered, e.g. setPower(5) will call action(5).
     * @param {string} keyword - The keyword to trigger the action.
     * @param {function} action - The function to execute when the keyword is entered. Receives parameters.
     */
    createSignal(keyword, action) {
        if (typeof keyword !== 'string' || typeof action !== 'function') {
            this.warn('createSignal expects (string, function)');
            return;
        }
        this.signals.set(keyword.toLowerCase(), action);
    }

    /**
     * Remove a signal by keyword.
     * @param {string} keyword - The keyword to remove.
     */
    disconnectSignal(keyword) {
        if (typeof keyword !== 'string') {
            this.warn('disconnectSignal expects a string keyword');
            return;
        }
        this.signals.delete(keyword.toLowerCase());
    }

    /**
     * Emit a registered signal by keyword, invoking its action with any provided arguments.
     * @param {string} keyword
     * @param  {...any} args
     */
    emit(keyword, ...args) {
        if (typeof keyword !== 'string') {
            this.warn('emit expects a string keyword');
            return;
        }
        const key = keyword.toLowerCase();
        if (!this.signals.has(key)) {
            this.warn(`emit: no signal registered for '${keyword}'`);
            return;
        }
        try {
            return this.signals.get(key)(...args);
        } catch (err) {
            this.error(`Signal emit error for '${keyword}': ${err}`);
        }
    }

    /**
     * Add or set a named flag. Flags are stored case-insensitively.
     * @param {string} name
     * @param {*} value
     */
    addFlag(name, value = true) {
        if (typeof name !== 'string') {
            this.warn('addFlag expects a string name');
            return;
        }
        this.flags.set(name.toLowerCase(), value);
        this.log(`[Debug] Flag set: ${name} = ${String(value)}`);
    }

    /**
     * Remove a named flag.
     * @param {string} name
     */
    removeFlag(name) {
        if (typeof name !== 'string') {
            this.warn('removeFlag expects a string name');
            return;
        }
        this.flags.delete(name.toLowerCase());
        this.log(`[Debug] Flag removed: ${name}`);
    }

    /**
     * Retrieve a flag value (case-insensitive). Returns undefined if not set.
     * @param {string} name
     */
    getFlag(name) {
        if (typeof name !== 'string') return undefined;
        return this.flags.get(name.toLowerCase());
    }

    /**
     * Check whether a flag is present (case-insensitive).
     * @param {string} name
     */
    hasFlag(name) {
        if (typeof name !== 'string') return false;
        return this.flags.has(name.toLowerCase());
    }
    try() {
        if (!this.visible) return;
        this.element.style.background = '#000000ff';
        this.ok = true;
    }
    catch () {
        if (!this.visible) return;
        this.element.style.background = '#6d0000ff';
        this.ok = false;
    }
    accept() {
        if (!this.visible) return;
        if (this.ok) {
            this.element.style.background = '#004500ff';
        }
    }
    log(content) {
        // No location for regular logs
        this._addLog(content, null, false);
    }
    error(content) {
        const location = getCallerLocation(3);
        this._addLog('[ERROR] ' + content, location, true);
        this.element.style.background = '#6d0000ff';
    }
    // Add warning support
    warn(content) {
        const location = getCallerLocation(3);
        this._addLog('[WARN] ' + content, location, true);
    }
    _setupInput() {
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const val = this.input.value.trim();
                // Check for keyword with parameters, e.g. setPower(5)
                const match = val.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\((.*)\)$/);
                let keyword, args = [];
                if (match) {
                    keyword = match[1].toLowerCase();
                    // Parse arguments: split by comma, trim, and try to eval each
                    if (match[2].trim()) {
                        args = match[2].split(',').map(s => {
                            s = s.trim();
                            try {
                                // Try to eval numbers, booleans, etc.
                                return eval(s);
                            } catch {
                                return s;
                            }
                        });
                    }
                } else {
                    keyword = val.toLowerCase();
                }
                if (keyword === 'clear') {
                    this.logs = [];
                    this.element.textContent = '';
                    console.log('                ')
                    console.log('End of message stream')
                    console.log('                ')
                } else if (keyword === 'showdom') {
                    const domLines = this._getDomTreeLines(document, 0);
                    for (let line of domLines) {
                        this.log(line);
                    }
                } else if (this.signals.has(keyword)) {
                    // If keyword matches a registered signal, run its action with parameters
                    try {
                        this.signals.get(keyword)(...args);
                        this.log(`[Signal] Executed action for keyword: ${val}`);
                    } catch (err) {
                        this.error(`Signal action error for '${val}': ${err}`);
                    }
                } else if (val) {
                    try {
                        // eslint-disable-next-line no-eval
                        const result = eval(val);
                        this.log('> ' + val + '\n' + result);
                    } catch (err) {
                        this.error('Eval error: ' + err);
                    }
                }
                this.input.value = '';
            }
        });
    }
    _getDomTreeLines(node, depth) {
        let indent = '  '.repeat(depth);
        let lines = [];
        const wrapAt = 80;
        function wrapDomLine(line, wrapAt, indent) {
            let result = [];
            while (line.length > wrapAt) {
                let breakIdx = line.lastIndexOf(' ', wrapAt);
                if (breakIdx === -1 || breakIdx === 0) breakIdx = wrapAt;
                result.push(line.slice(0, breakIdx));
                line = indent + line.slice(breakIdx).trimStart();
            }
            result.push(line);
            return result;
        }
        if (node.nodeType === 9) { // Document
            lines.push(...wrapDomLine('<!DOCTYPE html>', wrapAt, indent));
            if (node.documentElement) {
                lines.push(...this._getDomTreeLines(node.documentElement, depth));
            }
        } else if (node.nodeType === 1) { // Element
            let openTag = `${indent}<${node.tagName.toLowerCase()}`;
            if (node.id) openTag += ` id=\"${node.id}\"`;
            if (node.className) openTag += ` class=\"${node.className}\"`;
            openTag += '>';
            lines.push(...wrapDomLine(openTag, wrapAt, indent));
            if (node.childNodes && node.childNodes.length) {
                for (let child of node.childNodes) {
                    lines.push(...this._getDomTreeLines(child, depth + 1));
                }
            }
            let closeTag = `${indent}</${node.tagName.toLowerCase()}>`;
            lines.push(...wrapDomLine(closeTag, wrapAt, indent));
        } else if (node.nodeType === 3) { // Text
            const text = node.textContent.trim();
            if (text) lines.push(...wrapDomLine(`${indent}"${text}"`, wrapAt, indent));
        }
        return lines;
    }
    _setupToggle() {
        this.element.addEventListener('click', () => {
            this.visible = !this.visible;
            if (this.visible) {
                this.element.style.background = '#000000cc';
                this.input.style.display = '';
                // Restore log text
                this._renderLogs();
                // Scroll to bottom when showing so the most recent logs are visible
                try {
                    this.element.scrollTop = this.element.scrollHeight;
                } catch (e) {
                    // ignore
                }
            } else {
                this.element.style.background = 'transparent';
                this.input.style.display = 'none';
                // Erase log text
                this.element.textContent = '';
            }
        });
    }
    _renderLogs() {
        let full_content = '';
        let sigfigs = 0;
        const width = 2000; // or your preferred width
        const wrapAt = 80;
        function wrapLine(line, wrapAt) {
            let result = '';
            while (line.length > wrapAt) {
                let breakIdx = line.lastIndexOf(' ', wrapAt);
                if (breakIdx === -1 || breakIdx === 0) breakIdx = wrapAt;
                result += line.slice(0, breakIdx) + '\n';
                line = line.slice(breakIdx).trimStart();
            }
            result += line;
            return result;
        }
        let logDisplays = [];
        for (let log of this.logs) {
            let display;
            if (log instanceof Vector) {
                display = `[${Math.round(log.x * (10 ** sigfigs)) / (10 ** sigfigs)}, ${Math.round(log.y * (10 ** sigfigs)) / (10 ** sigfigs)}]`;
            } else if (typeof log === 'string') {
                display = log;
            } else {
                try {
                    display = JSON.stringify(log);
                } catch {
                    display = String(log);
                }
            }
            display = wrapLine(display, wrapAt);
            logDisplays.push(display);
        }
        full_content = logDisplays.join('\n');
        this.element.textContent = full_content;
    }
    _addLog(content, location, isError = false) {
        // Only show location for errors/warnings
        let entry = (location && isError) ? `${content} @ ${location}` : content;
        // Find the index of 'Start of message stream'
        const marker = 'End of message stream';
        let idx = this.logs.findIndex(l => l === marker);
        if (idx !== -1) {
            // Insert two lines above the marker, or at the start if not enough lines
            let insertIdx = Math.max(0, idx - 1);
            this.logs.splice(insertIdx, 0, entry);
        } else {
            // If marker not found, insert at the start
            this.logs.unshift(entry);
        }
        // Keep up to a reasonable cap so older logs can still be scrolled through.
        const MAX_LOGS = 200;
        if (this.logs.length > MAX_LOGS) {
            // Remove oldest entries so length == MAX_LOGS
            this.logs.splice(0, this.logs.length - MAX_LOGS);
        }

        if (this.visible) {
            // If the user is currently scrolled to (or very near) the bottom, we'll auto-scroll
            // after rendering. If they scrolled up, preserve their position so they can inspect older logs.
            const wasAtBottom = (this.element.scrollTop + this.element.clientHeight) >= (this.element.scrollHeight - 5);
            this._renderLogs();
            if (wasAtBottom) {
                // Scroll to bottom to show newest log
                try { this.element.scrollTop = this.element.scrollHeight; } catch (e) { }
            }
        }
    }
    _patchGlobal() {
        // Patch window.onerror
        window.onerror = (msg, url, line, col, err) => {
            if (err && err.stack) {
                // Try to extract the first relevant stack line
                const stackLines = err.stack.split('\n');
                let loc = '';
                for (let i = 1; i < stackLines.length; ++i) {
                    const match = stackLines[i].match(/\(?([^\s\)]+):(\d+):(\d+)\)?$/);
                    if (match) {
                        loc = `${match[1]}:${match[2]}`;
                        break;
                    }
                }
                this.error(`${msg} @ ${loc}`);
            } else {
                this.error(`${msg} @ ${url}:${line}:${col}`);
            }
            return false;
        };
        // Patch unhandled promise rejections
        window.onunhandledrejection = (event) => {
            let loc = '';
            if (event.reason && event.reason.stack) {
                const stackLines = event.reason.stack.split('\n');
                for (let i = 1; i < stackLines.length; ++i) {
                    const match = stackLines[i].match(/\(?([^\s\)]+):(\d+):(\d+)\)?$/);
                    if (match) {
                        loc = `${match[1]}:${match[2]}`;
                        break;
                    }
                }
            }
            this.error('Unhandled rejection: ' + (event.reason && event.reason.message ? event.reason.message : event.reason) + (loc ? ` @ ${loc}` : ''));
        };
        // Patch console
        const origLog = console.log;
        const origWarn = console.warn;
        const origError = console.error;
        console.log = (...args) => {
            this.log(args.map(String).join(' '));
            origLog.apply(console, args);
        };
        console.warn = (...args) => {
            this.warn(args.map(String).join(' '));
            origWarn.apply(console, args);
        };
        console.error = (...args) => {
            this.error(args.map(String).join(' '));
            origError.apply(console, args);
        };
    }
}
// Singleton instance, always available globally
window.Debug = new Debug();
console.log('                ')
console.log('End of message stream')
console.log('                ')
window.Debug.hide()
export default Debug;