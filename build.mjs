import { opendir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import esbuild from 'esbuild'

async function* walk(folder) {
    for await (const dirent of await opendir(folder)) {
        const path = join(folder, dirent.name)

        if (dirent.isFile()) yield { path, dirent }
        else if (dirent.isDirectory()) yield* walk(path)
    }
}

const entryPoints = []
for await (const o of walk('src')) {
    entryPoints.push(o.path)
}

esbuild.buildSync({
    absWorkingDir: process.cwd(),
    minifyIdentifiers: true,
    minifyWhitespace: true,
    minifySyntax: false,
    platform: 'node',
    keepNames: true,
    outdir: 'dist',
    format: 'cjs',
    bundle: true,
    entryPoints,
})

await writeFile('./dist/index.mjs', "import m from './index.js';export default m", { flag: 'wx' })
    .catch(() => null)