<div align="center">
    <p>
		<a href="https://www.npmjs.com/package/@thunder04/supermap">
        	<img src="https://img.shields.io/npm/v/@thunder04/supermap.svg?maxAge=3600&style=flat&logo=npm&color=ff5540" alt="Version" />
		</a>
		<a href="https://www.npmjs.com/package/@thunder04/supermap">
        	<img src="https://img.shields.io/npm/dt/@thunder04/supermap.svg?maxAge=3600&style=flat&logo=npm&color=ff5540" alt="Downloads" />
		</a>
    </p>
</div>

# @thunder04/supermap
Extended Map with Array-like methods with TS typings and ESM support. Made for my projects, but it can be used for yours too 👀

## Features
- Automatic sweeping. Set an interval for automatic entry-sweeping with (optional) entry lifetime and (optional) an on-sweep callback.
- Entry TTL. Custom Time To Live duration (in milliseconds) for each entry of a `SuperMap`.
- Entry limit. Set the amount of entries a `SuperMap` can have.

## Methods (*inherits from [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map#instance_methods)*)
- `set(key, value, [ttl: number])` Identical to [Map.prototype.set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/set) but with a third argument.
    - `[ttl]`: The time to live duration of the entry (in milliseconds). If the `expireAfter` option has been provided, the ttl will sum with it. It has no effect if the `intervalTime` option is not included.
- `first([key: boolean])` Gets the first key or value of the Map.
    - `[key]`: If set to `true`, it will return the first key instead of the first value.
- `last([key: boolean])` Gets the last key or value of the Map. *This method should be avoided as it iterates the whole Map*.
    - `[key]`: If set to `true`, it will return the last key instead of the last value.
- `some(func: (value, key, self) => boolean)` Identical to [Array.prototype.some](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some).
- `every(func: (value, key, self) => boolean)` Identical to [Array.prototype.every](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every).
- `filter(func: (value, key, self) => boolean)` Identical to [Array.prototype.filter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter).
- `find(func: (value, key, self) => boolean, [returnKey: boolean])` Identical to [Array.prototype.find](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find) but with a second argument.
- `map(func: (value, key, self) => boolean, [filter: (value, key, self) => boolean])` Identical to [Array.prototype.map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map) but this method also accepts a `filter` function to filter the entries before mapping them __without__ re-iterating the whole map.
    - `[filter: (value, key, self) => boolean]`: If included, the `map` callback will be called only if the entry passes the `filter` function.
    - `[returnKey]`: If set to `true`, it will return the found key instead of the found value.
- `reduce(func: (accumulator, value, key, self) => T, initialValue)` Identical to [Array.prototype.reduce](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce).
- `concat(children)` Identical to [Array.prototype.concat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/concat).
- `concatMut(children)` Identical to [Array.prototype.concat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/concat) but this method modifies the instance instead of creating a new one.
- `sweep(sweeper: (value, key, self) => boolean)` Deletes the entries that pass the `sweeper` callback and optionally calls the `onSweep` callback (provided in options).
- `sort(sortFn: (vA: V, vB: V, kA: K, kB: K, self: this) => number)` Identical to [Array.prototype.sort](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort).
- `startInterval()` Starts or restarts the sweeping interval. It gets automatically called in the constructor if the `intervalTime` option has been provided.
- `stopInterval()` Stops the sweeping interval.

## Contributions
Contributions are welcome! Do you want to add new features? Do you want to make performance optimizations? It's simple! Fork this repository, make your changes and create a [pull request](https://github.com/thunder04/supermap/pulls)!