const NOOP = (k: any, v: any) => {};

type OnEntryExpiry<K, V> = (key: K, value: V) => any;

export interface SuperMapOptions<K, V> {
    onEntryExpiry?: OnEntryExpiry<K, V>;
    capacity?: number;
}

export class SuperMap<K, V> extends Map<K, V> {
    // Keep a reference to the timeout objects because we need to clear them later on.
    //
    // The timeout callback holds onto the key and value, causing them to never get GC'ed.
    #timeouts: Map<K, NodeJS.Timeout> = new Map();
    #capacity: number = Number.MAX_SAFE_INTEGER;
    #onEntryExpiry: OnEntryExpiry<K, V> = NOOP;

    /**
     * @param opts.onEntryExpiry Called when an entry has expired. An entry is considered expired when a positive `ttl` argument is provided in the `SuperMap#set` method and `ttl` milliseconds have passed.
     * @param opts.capacity The maximum amount of entries stored in this map. On overflow, the first element stored is removed.
     */
    constructor(opts: SuperMapOptions<K, V> = {}) {
        super();

        if (
            typeof opts.capacity === "number" &&
            Number.isSafeInteger(opts.capacity) &&
            opts.capacity > 0
        ) {
            this.#capacity = opts.capacity;
        } else if ("capacity" in opts) {
            throw new TypeError(
                "options.capacity must be a positive safe integer",
            );
        }

        if (typeof opts.onEntryExpiry === "function") {
            this.#onEntryExpiry = opts.onEntryExpiry;
        } else if ("onEntryExpiry" in opts) {
            throw new TypeError("options.onEntryExpiry must be a function");
        }
    }

    /**
     * Creates a new entry in this map.
     *
     * @param key The key of the new entry.
     * @param value The value of the new entry.
     * @param ttl Time to live duration of this entry (in milliseconds).
     */
    public set(key: K, value: V, ttl = 0) {
        if (!Number.isSafeInteger(ttl)) {
            throw new TypeError("ttl must be a safe integer");
        }

        // Delete the oldest entry if the map would overflow.
        if (this.size >= this.#capacity && !this.has(key)) {
            this.delete(this.firstKey()!);
        }

        super.set(key, value);

        if (ttl > 0) {
            this.#timeouts.set(
                key,
                setTimeout(() => {
                    this.#timeouts.delete(key);

                    if (this.delete(key)) {
                        this.#onEntryExpiry(key, value);
                    }
                }, ttl).unref(),
            );
        }

        return this;
    }

    public delete(key: K): boolean {
        const timeoutId = this.#timeouts.get(key);

        if (this.#timeouts.delete(key)) {
            clearTimeout(timeoutId);
        }

        return super.delete(key);
    }

    /** Clears all entries. */
    public clear() {
        for (const key of this.keys()) {
            // Additional clean-up work is performed on deletion, hence why I can't use `super.clear()`.
            this.delete(key);
        }
    }

    /**
     * Returns the first inserted value.
     *
     * @see {firstKey}
     * @see {last}
     * @see {lastKey}
     */
    public first(): V | undefined {
        return this.values().next().value;
    }

    /**
     * Returns the first inserted key.
     *
     * @see {first}
     * @see {last}
     * @see {lastKey}
     */
    public firstKey(): K | undefined {
        return this.keys().next().value;
    }

    /**
     * Returns the last inserted value in *O*(n) (!) time.
     *
     * @see {lastKey}
     * @see {first}
     * @see {firstKey}
     */
    public last(): V | undefined {
        const entries = this.entries();
        let lastEntry: [K, V] | undefined;

        while (true) {
            const iter = entries.next();
            if (iter.done) return lastEntry?.[1];

            lastEntry = iter.value;
        }
    }

    /**
     * Returns the last inserted key in *O*(n) (!) time.
     *
     * @see {last}
     * @see {first}
     * @see {firstKey}
     */
    public lastKey(): K | undefined {
        const entries = this.entries();
        let lastEntry: [K, V] | undefined;

        while (true) {
            const iter = entries.next();
            if (iter.done) return lastEntry?.[0];

            lastEntry = iter.value;
        }
    }

    /** Similar to [Array.prototype.some](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some) */
    public some(func: (value: V, key: K, self: this) => boolean) {
        const entries = this.entries();

        while (true) {
            const iter = entries.next();
            if (iter.done) return false;
            if (func(iter.value[1], iter.value[0], this)) return true;
        }
    }

    /** Similar to [Array.prototype.every](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every) */
    public every(func: (value: V, key: K, self: this) => boolean) {
        const entries = this.entries();

        while (true) {
            const iter = entries.next();
            if (iter.done) return true;
            if (!func(iter.value[1], iter.value[0], this)) return false;
        }
    }

    /** Deletes the entries for which the callback function returns false. */
    public retain(cb: (value: V, key: K, self: this) => boolean) {
        const entries = this.entries();

        while (true) {
            const iter = entries.next();
            if (iter.done) break;

            const entry = iter.value;
            if (!cb(entry[1], entry[0], this as never)) {
                this.delete(entry[0]);
            }
        }
    }

    /** Similar to [Array.prototype.filter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter). */
    public filter(func: (value: V, key: K, self: this) => boolean) {
        const map = new SuperMap<K, V>({
            onEntryExpiry: this.#onEntryExpiry,
            capacity: this.#capacity,
        });

        const entries = this.entries();
        while (true) {
            const iter = entries.next();
            if (iter.done) return map;

            const [k, v] = iter.value;
            if (func(v, k, this)) map.set(k, v);
        }
    }

    /**
     * Similar to [Array.prototype.filter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter),
     * but any items that didn't pass the filter are removed directly from this map.
     */
    public filterMut(func: (value: V, key: K, self: this) => boolean) {
        const entries = this.entries();

        while (true) {
            const iter = entries.next();
            if (iter.done) return this;

            const [k, v] = iter.value;
            if (!func(v, k, this)) {
                this.delete(k);
            }
        }
    }

    /**
     * Similar to [Array.prototype.map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map),
     * but this method also accepts a filter callback to filter the entries before mapping them without iterating the whole map again.
     *
     * Prefer using this method instead of `<SuperMap>.filter(·).map(·)`.
     *
     * For more advanced use cases, you are advised to use the `itertools` library.
     *
     * @param filterCb Optional filter callback to filter entries.
     */
    public map<T>(
        mapCb: (value: V, key: K, self: this) => T,
        filterCb?: (value: V, key: K, self: this) => boolean,
    ) {
        return Array.from(this.#mapGenerator(mapCb, filterCb));
    }

    /** Similar to [Array.prototype.find](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find). */
    public find(func: (value: V, key: K, self: this) => boolean): V | null {
        const entries = this.entries();

        while (true) {
            const iter = entries.next();
            if (iter.done) return null;

            const [k, v] = iter.value;

            if (func(v, k, this)) {
                return v;
            }
        }
    }

    /** Returns the first key such that the `func` function returned true. */
    public findKey(func: (value: V, key: K, self: this) => boolean): K | null {
        const entries = this.entries();

        while (true) {
            const iter = entries.next();
            if (iter.done) return null;

            const [k, v] = iter.value;

            if (func(v, k, this)) {
                return k;
            }
        }
    }

    /** Similar to [Array.prototype.reduce](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce). */
    public reduce<T>(
        fn: (accumulator: T | undefined, value: V, key: K, self: this) => T,
        initialValue?: T,
    ) {
        const entries = this.entries();
        var accumulator = initialValue;

        while (true) {
            const iter = entries.next();
            if (iter.done) return accumulator!;

            accumulator = fn(accumulator, iter.value[1], iter.value[0], this);
        }
    }

    /**
     * Similar to [Array.prototype.concat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/concat).
     *
     * Caution: TTLs are not preserved.
     */
    public concat(...children: ReadonlyArray<SuperMap<K, V>>) {
        const map = new SuperMap<K, V>({
            onEntryExpiry: this.#onEntryExpiry,
            capacity: this.#capacity,
        });

        for (const child of children.concat(this)) {
            const entries = child.entries();

            while (true) {
                const iter = entries.next();
                if (iter.done) break;

                map.set.apply(map, iter.value);
            }
        }

        return map;
    }

    /**
     * Similar to [Array.prototype.concat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/concat),d
     * but this method mutates this instance instead of creating a new one.
     *
     * Caution: TTLs of the other maps' entries are not preserved.
     */
    public concatMut(...children: ReadonlyArray<SuperMap<K, V>>) {
        for (const child of children) {
            const entries = child.entries();

            while (true) {
                const iter = entries.next();
                if (iter.done) break;

                this.set.apply(this, iter.value);
            }
        }

        return this;
    }

    /**
     * Similar to [Array.prototype.sort](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort).
     *
     * If you have a collection of entries beforehand, prefer to sort it before inserting them here.
     */
    public sort(cb: (a: [K, V], b: [K, V], self: this) => number) {
        const entries = Array.from(this.entries());

        // Since we will add all entries back anyway, there's no reason to clear `this.#timeouts` as well.
        super.clear();

        entries
            .sort((a, b) => cb(a, b, this))
            .forEach(([k, v]) => super.set(k, v));

        return this;
    }

    *#mapGenerator<T>(
        mapCb: (value: V, key: K, self: this) => T,
        filterCb?: (value: V, key: K, self: this) => boolean,
    ) {
        const entries = this.entries();

        if (filterCb) {
            while (true) {
                const iter = entries.next();
                if (iter.done) return;

                const [k, v] = iter.value;
                if (filterCb(v, k, this)) {
                    yield mapCb(v, k, this);
                }
            }
        } else {
            while (true) {
                const iter = entries.next();
                if (iter.done) return;

                yield mapCb(iter.value[1], iter.value[0], this);
            }
        }
    }
}
