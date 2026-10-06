// Samlar det som ska publiceras i Sublime Lab i en egen mapp (standard: dist).
// Tar med alla HTML- och CSS-filer i roten plus de bilder, typsnitt m.m. som de faktiskt refererar till,
// så att repo-filer (CLAUDE.md, PDF, Python, oanvända bilder) inte följer med.
// Användning: node collect.mjs [utmapp]

import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const out = path.resolve(root, process.argv[2] || 'dist');

const ASSET_EXT = /\.(png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|mp4|webm|js|json)$/i;
const files = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name);

const pages = files.filter((f) => /\.(html|css)$/i.test(f));
const text = pages.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
const assets = files.filter((f) => ASSET_EXT.test(f) && (text.includes(f) || text.includes(encodeURI(f))));

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const f of [...pages, ...assets]) fs.copyFileSync(path.join(root, f), path.join(out, f));

console.log(`Kopierade ${pages.length + assets.length} filer till ${path.relative(root, out)}: ${[...pages, ...assets].join(', ')}`);
