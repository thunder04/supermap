class SuperMap<K, V> extends Map<K, V> {
    #options: RequiredPick<SuperMapOptions<K, V>, 'expireAfter' | 'itemsLimit'>
    #dateCache: Map<K, number> | null = null
    #interval: NodeJS.Timeout | null = null

    constructor(options: Partial<SuperMapOptions<K, V>> = {}) {
        options = Object.assign({
            expireAfter: null,
            itemsLimit: -1
        }, options)

        if (options.expireAfter !== null && !Number.isSafeInteger(options.expireAfter)) throw new TypeError('options.expireAfter must be a safe integer')
        if ('intervalTime' in options && !Number.isSafeInteger(options.intervalTime)) throw new TypeError('options.intervalTime must be a safe integer')

        super()
        this.#options = options as never

        if ('intervalTime' in options) {
            this.#dateCache = new Map()
            this.startInterval()
        }
    }

    public delete(key: K) { return this.#dateCache?.delete(key), super.delete(key) }
    public toJSON() { return ({ entries: this.toArray(), options: this.#options }) }
    public clear() { return this.stopInterval(), super.clear() }
    public toArray() { return Array.from(this.entries()) }

    public set(key: K, value: V) {
        if (this.#options.itemsLimit === 0) return this

        if (this.#options.itemsLimit > 0) {
            if (this.size >= this.#options.itemsLimit && this.has(key) === false) {
                const key = this.first(true)!
                this.#dateCache?.delete(key)
                this.delete(key)
            }
        }

        return this.#dateCache?.set(key, Date.now()), super.set(key, value)
    }

    public first(key?: false): V | undefined
    public first(key: true): K | undefined
    public first(key?: boolean): unknown {
        return key ? this.keys().next().value : this.values().next().value
    }

    public some(func: (value: V, key: K, self: this) => boolean) {
        const entries = this.entries()

        while (true) {
            const iter = entries.next()
            if (iter.done) return false

            const [k, v] = iter.value
            if (func(v, k, this)) return true
        }
    }

    public every(func: (value: V, key: K, self: this) => boolean) {
        const entries = this.entries()

        while (true) {
            const iter = entries.next()
            if (iter.done) return true

            const [k, v] = iter.value
            if (func(v, k, this) === false) return false
        }
    }

    public sweep(func: (value: V, key: K, self: this) => boolean) {
        if (this.size === 0) return -1
        const prev = this.size

        super.forEach((v, k) => {
            if (func(v, k, this)) {
                this.#options.onSweep?.(v, k)
                this.delete(k)
            }
        })

        return prev - this.size
    }

    public filter(func: (value: V, key: K, self: this) => boolean) {
        const res = new SuperMap<K, V>(this.#options), entries = this.entries()

        while (true) {
            const iter = entries.next()
            if (iter.done) return res

            const [k, v] = iter.value
            if (func(v, k, this)) res.set(k, v)
        }
    }

    public map<T>(
        mapFn: (value: V, key: K, self: this) => T,
        filterFn: (value: V, key: K, self: this) => boolean = () => true
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

    public sort(sortFn: (vA: V, vB: V, kA: K, kB: K, self: this) => number) {
        const entries = this.toArray()
        this.clear()

        entries
            .sort(([kA, vA], [kB, vB]) => sortFn(vA, vB, kA, kB, this))
            .forEach((v) => this.set(...v))

        return this
    }

    public startInterval() {
        if (this.#dateCache === null) return false
        this.stopInterval()

        if ('intervalTime' in this.#options) {
            this.#interval = setInterval(
                () => this.#onSweep(), this.#options.intervalTime!
            ).unref()
        }

        return true
    }

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
        const expireAfter = this.#options.expireAfter, now = Date.now()

        if (expireAfter !== null)
            //TODO: In theory the dateCache should have the exact key ordering as `this`. Try to iterate them simultaneously?
            this.sweep((_, k) => expireAfter < now - (this.#dateCache!.get(k) || 0))
        else this.sweep(() => true)
    }

    *#mapGenerator<T>(
        mapFn: (value: V, key: K, self: this) => T,
        filterFn: (value: V, key: K, self: this) => boolean
    ) {
        const entries = this.entries()

        while (true) {
            const iter = entries.next()
            if (iter.done) break

            const [k, v] = iter.value
            if (filterFn(v, k, this)) yield mapFn(v, k, this)
        }
    }
}

export = SuperMap

declare interface SuperMapOptions<K = any, V = any> {
    onSweep: (value: V, key: K) => unknown
    expireAfter: number | null
    intervalTime: number
    itemsLimit: number
}

type RequiredPick<T, K extends keyof T> = Partial<T> & { [P in K]-?: T[P] }
