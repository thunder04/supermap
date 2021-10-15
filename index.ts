class SuperMap<K, V> extends Map<K, V> {
    #options: RequiredPick<SuperMapOptions<K, V>, 'expireAfter' | 'itemsLimit'>
    #dateCache: Map<K, number> | null = null
    #interval: NodeJS.Timeout | null = null

    constructor(options: Partial<SuperMapOptions<K, V>> = {}) {
        options = Object.assign({
            expireAfter: 0,
            itemsLimit: -1
        }, options)

        if ('intervalTime' in options && !Number.isSafeInteger(options.intervalTime)) throw new TypeError('options.intervalTime must be a safe integer')
        if ('expireAfter' in options && !Number.isSafeInteger(options.expireAfter)) throw new TypeError('options.expireAfter must be a safe integer')
        if ('itemsLimit' in options && !Number.isSafeInteger(options.itemsLimit)) throw new TypeError('options.itemsLimit must be a safe integer')
        if ('onSweep' in options && typeof options.onSweep !== 'function') throw new TypeError('options.onSweep must be a function')

        super()
        this.#options = options as never

        if ('intervalTime' in options) {
            this.#dateCache = new Map()
            this.startInterval()
        }
    }

    public delete(key: K) { return this.#dateCache?.delete(key), super.delete(key) }
    /** Converts the entries of the map to an array. */
    public toArray() { return Array.from(this.entries()) }

    public set(key: K, value: V, ttl = 0) {
        if (Number.isSafeInteger(ttl) === false) throw new TypeError('ttl must be a safe integer')
        const itemsLimit = this.#options.itemsLimit

        if (itemsLimit > -1) {
            if (itemsLimit === 0) return this

            if (this.size >= itemsLimit && this.has(key) === false)
                this.delete(this.first(true)!)
        }

        return this.#dateCache?.set(key, Date.now() + ttl), super.set(key, value)
    }

    /** Clears the map. Optionally stops the interval as well. */
    public clear(stopInterval = false) {
        if (stopInterval) this.stopInterval()
        else this.#dateCache?.clear()
        return super.clear()
    }

    /** Gets the first key or value (if it exists) */
    public first(key?: false): V | undefined
    public first(key: true): K | undefined
    public first(key?: boolean): unknown {
        return key ? this.keys().next().value : this.values().next().value
    }

    /** 
      * Gets the last key or value (if it exists)
      * 
      * **Avoid using this method as it calls the this.toArray() method. If it's unavoidable, at least cache the results.**
     */
    public last(key?: false): V | undefined
    public last(key: true): K | undefined
    public last(key?: boolean): unknown {
        const [k, v] = this.toArray()[this.size - 1]
        return key ? k : v
    }

    /** See [Array.prototype.some](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some) */
    public some(func: (value: V, key: K, self: this) => boolean) {
        const entries = this.entries()

        while (true) {
            const iter = entries.next()
            if (iter.done) return false

            const [k, v] = iter.value
            if (func(v, k, this)) return true
        }
    }

    /** See [Array.prototype.every](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every) */
    public every(func: (value: V, key: K, self: this) => boolean) {
        const entries = this.entries()

        while (true) {
            const iter = entries.next()
            if (iter.done) return true

            const [k, v] = iter.value
            if (func(v, k, this) === false) return false
        }
    }

    /** Deletes the entries that pass the sweeper function and optionally calls the `onSweep` callback (defined in `options`) */
    public sweep(sweeper: (value: V, key: K, self: this) => boolean) {
        if (this.size === 0) return -1
        const prev = this.size

        super.forEach((v, k) => {
            if (sweeper(v, k, this as never)) {
                this.#options.onSweep?.(v, k)
                this.delete(k)
            }
        })

        return prev - this.size
    }

    /** See [Array.prototype.filter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter) */
    public filter(func: (value: V, key: K, self: this) => boolean) {
        const res = new SuperMap<K, V>(this.#options), entries = this.entries()

        while (true) {
            const iter = entries.next()
            if (iter.done) return res

            const [k, v] = iter.value
            if (func(v, k, this)) res.set(k, v)
        }
    }

    /** 
     * Identical to [Array.prototype.map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map)
     * with the difference that this method also accepts a `filter` function to filter entries before mapping them.
     */
    public map<T>(
        mapFn: (value: V, key: K, self: this) => T,
        filterFn?: (value: V, key: K, self: this) => boolean
    ) { return Array.from(this.#mapGenerator(mapFn, filterFn)) }

    public find(func: (value: V, key: K, self: this) => boolean, returnKey: true): K | null
    public find(func: (value: V, key: K, self: this) => boolean, returnKey?: false): V | null
    public find(func: (value: V, key: K, self: this) => boolean, returnKey = false): K | V | null {
        const entries = this.entries()

        while (true) {
            const iter = entries.next()
            if (iter.done) return null

            const [k, v] = iter.value
            if (func(v, k, this)) return returnKey ? k : v
        }
    }

    /** See [Array.prototype.reduce](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce) */
    public reduce<T>(fn: (accumulator: T | undefined, value: V, key: K, self: this) => T, initialValue?: T) {
        const entries = this.entries()
        var accumulator = initialValue

        while (true) {
            const iter = entries.next()
            if (iter.done) return accumulator!

            const [k, v] = iter.value
            accumulator = fn(accumulator, v, k, this)
        }
    }

    /** See [Array.prototype.concat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/concat) */
    public concat(...children: ReadonlyArray<SuperMap<K, V>>) {
        const results = new SuperMap<K, V>(this.#options)

        for (const child of children.concat(this)) {
            const entries = child.entries()

            while (true) {
                const iter = entries.next()
                if (iter.done) break

                results.set(...iter.value)
            }
        }

        return results
    }

    /**
     * Identical to [Array.prototype.concat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/concat)
     * with the difference that this method mutates the instance instead of creating a new one (like `SuperMap.prototype.concat`)
     */
    public concatMut(...children: ReadonlyArray<SuperMap<K, V>>) {
        for (const child of children) {
            const entries = child.entries()

            while (true) {
                const iter = entries.next()
                if (iter.done) break

                this.set(...iter.value)
            }
        }

        return this
    }

    /** See [Array.prototype.sort](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort) */
    public sort(sortFn: (vA: V, vB: V, kA: K, kB: K, self: this) => number) {
        const entries = this.toArray()
        this.clear()

        entries
            .sort(([kA, vA], [kB, vB]) => sortFn(vA, vB, kA, kB, this))
            .forEach((v) => this.set(...v))

        return this
    }

    /** Re-starts the interval. It gets automatically called in the constructor if the `options.intervalTime` property exists */
    public startInterval() {
        if (this.#dateCache === null || !('intervalTime' in this.#options)) return false

        this.stopInterval()
        this.#interval = setInterval(() => this.#onSweep(), this.#options.intervalTime!).unref()

        return true
    }

    /** Stops the interval. */
    public stopInterval() {
        if (this.#dateCache === null) return false
        this.#dateCache.clear()

        if (this.#interval !== null) {
            clearInterval(this.#interval)
            this.#interval = null
        }

        return true
    }

    #onSweep() {
        if (this.#dateCache === null) return
        const entries = this.entries(), dEntries = this.#dateCache.entries()
        const { expireAfter, onSweep } = this.#options, now = Date.now()

        while (true) {
            const entry = entries.next()
            if (entry.done) return

            const creationDate = dEntries.next().value[1]

            if (expireAfter < now - creationDate) {
                const [k, v] = entry.value

                onSweep?.(v, k)
                this.delete(k)
            }
        }
    }

    *#mapGenerator<T>(
        mapFn: (value: V, key: K, self: this) => T,
        filterFn?: (value: V, key: K, self: this) => boolean
    ) {
        const entries = this.entries()

        //The code duplication is intentional for performance reasons.
        if (filterFn) {
            while (true) {
                const iter = entries.next()
                if (iter.done) break

                const [k, v] = iter.value
                if (filterFn(v, k, this)) yield mapFn(v, k, this)
            }
        } else {
            while (true) {
                const iter = entries.next()
                if (iter.done) break

                const [k, v] = iter.value
                yield mapFn(v, k, this)
            }
        }
    }
}

//@ts-ignore
export = SuperMap

declare interface SuperMapOptions<K = any, V = any> {
    onSweep: (value: V, key: K) => any
    intervalTime: number
    expireAfter: number
    itemsLimit: number
}

type RequiredPick<T, K extends keyof T> = Partial<T> & { [P in K]-?: T[P] }