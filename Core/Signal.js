export default class Signal { 
    constructor() {
        this.listeners = new Map();
        this.returnCallback = null; // callback for onReturn
    }

    connect(nameOrCallback, callback) {
        if (typeof nameOrCallback === 'function' && callback === undefined) {
            const cb = nameOrCallback;
            const name = cb.name || `listener_${this.listeners.size+1}`;
            this.listeners.set(name, cb);
        } else if (typeof nameOrCallback === 'string' && typeof callback === 'function') {
            this.listeners.set(nameOrCallback, callback);
        } else {
            console.warn('Signal.connect expects (name, function) or (function)');
        }
    }

    disconnect(name) {
        if (typeof name === 'string') {
            this.listeners.delete(name);
        } else {
            console.warn('Signal.disconnect expects a name string');
        }
    }

    hasListener(name) {
        return this.listeners.has(name);
    }

    onReturn(callback) {
        if (typeof callback === 'function') {
            this.returnCallback = callback;
        } else {
            console.warn('Signal.onReturn expects a function');
        }
    }

    /**
     * Emit the signal
     * @param  {...any} args - arguments to pass to listeners
     * @returns {Map<string, any>|undefined} map of named listener return values if last arg is 'callback=true'
     */
    emit(...args) {
        let collect = false;

        // Check if last argument is 'callback=true'
        const lastArg = args[args.length - 1];
        if (typeof lastArg === 'string' && lastArg.toLowerCase() === 'callback=true') {
            collect = true;
            args.pop();
        }

        const returnValues = collect ? new Map() : undefined;

        for (const [name, callback] of this.listeners.entries()) {
            try {
                const result = callback(...args);

                // Call onReturn if result is truthy
                if (result && this.returnCallback) {
                    this.returnCallback(result);
                }

                // Collect only named listeners (ignore auto-generated)
                if (collect && !name.startsWith('listener_')) {
                    returnValues.set(name, result);
                }

            } catch (e) {
                console.error('Signal callback error:', e);
            }
        }

        if (collect) return returnValues;
    }

    clear() {
        this.listeners.clear();
        this.returnCallback = null;
    }
}