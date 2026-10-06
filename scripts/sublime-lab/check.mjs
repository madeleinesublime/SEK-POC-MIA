// Kontrollerar att en färdig prototypmapp följer Sublime Labs (ProtoSpace) regler.
// Användning: node check.mjs <mapp>   (avslutar med felkod 1 om något bryter mot reglerna)

import fs from 'fs';
import path from 'path';

const root = path.resolve(process.argv[2] || 'dist');
const ALLOWED = /\.(html|htm|css|js|mjs|map|json|png|jpg|jpeg|gif|svg|webp|avif|ico|woff|woff2|ttf|otf|mp4|webm|pdf)$/;
const NAME = /^[a-z0-9.-]+$/;
const MAX_FILES = 2000;
const MAX_TOTAL = 200 * 1024 * 1024;
const TARGET_TOTAL = 20 * 1024 * 1024;
const MAX_HTML = 10 * 1024 * 1024;

const errors = [];
const warnings = [];

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? [full, ...walk(full)] : [full];
});

if (!fs.existsSync(root)) {
    console.error(`Hittar inte ${root}`);
    process.exit(1);
}

const all = walk(root);
const files = all.filter((f) => fs.statSync(f).isFile());
const rel = (f) => path.relative(root, f).split(path.sep).join('/');

// Grundkrav: index.html, antal, storlek
if (!fs.existsSync(path.join(root, 'index.html'))) errors.push('index.html saknas i roten');
if (files.length > MAX_FILES) errors.push(`För många filer: ${files.length} (max ${MAX_FILES})`);
const total = files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
if (total > MAX_TOTAL) errors.push(`För stor: ${(total / 1048576).toFixed(1)} MB (max 200 MB)`);
else if (total > TARGET_TOTAL) warnings.push(`Totalt ${(total / 1048576).toFixed(1)} MB – över rekommendationen på 20 MB`);

// Filtyper och filnamn
const lowerSeen = new Map();
for (const f of all) {
    const r = rel(f);
    for (const part of r.split('/')) {
        if (!NAME.test(part)) { errors.push(`Ogiltigt namn (bara a-z 0-9 - .): ${r}`); break; }
    }
    const lower = r.toLowerCase();
    if (lowerSeen.has(lower) && lowerSeen.get(lower) !== r) errors.push(`Samma namn med olika versaler: ${r}`);
    lowerSeen.set(lower, r);
    if (fs.statSync(f).isFile() && !ALLOWED.test(r)) errors.push(`Otillåten filtyp: ${r}`);
}

// HTML: charset, viewport, </body>, <base>, absoluta sökvägar, länkar och resurser som saknas
const htmlFiles = files.filter((f) => /\.html?$/.test(f));
const links = new Map();
const missing = new Set();
const isLocal = (url) => url && !/^(https?:|mailto:|tel:|data:|javascript:|#|\?)/.test(url);
const strip = (url) => url.split('#')[0].split('?')[0];

for (const f of htmlFiles) {
    const r = rel(f);
    const html = fs.readFileSync(f, 'utf8');
    if (fs.statSync(f).size > MAX_HTML) errors.push(`${r}: över 10 MB`);
    if (!/<meta\s+charset=["']?utf-8/i.test(html)) errors.push(`${r}: saknar <meta charset="utf-8">`);
    if (!/<meta\s+name=["']viewport["'][^>]*width=device-width/i.test(html)) errors.push(`${r}: saknar viewport-meta`);
    if (!/<\/body>/i.test(html)) errors.push(`${r}: saknar </body>`);
    if (/<base[\s>]/i.test(html)) errors.push(`${r}: innehåller <base>`);
    if (/target=["']_(top|parent)["']/i.test(html)) errors.push(`${r}: använder target="_top" eller "_parent"`);

    const pageLinks = new Set();
    for (const [, attr, value] of html.matchAll(/\s(href|src|poster|data-poster-mobile|action)=["']([^"']*)["']/gi)) {
        if (value.startsWith('/')) errors.push(`${r}: absolut sökväg ${attr}="${value}"`);
        if (!isLocal(value)) continue;
        const target = path.join(path.dirname(f), strip(value));
        if (!fs.existsSync(target)) missing.add(`${r} → ${value}`);
        else if (/\.html?$/.test(target) && attr.toLowerCase() === 'href') pageLinks.add(target);
    }
    for (const [, value] of html.matchAll(/srcset=["']([^"']*)["']/gi)) {
        for (const candidate of value.split(',').map((c) => c.trim().split(/\s+/)[0])) {
            if (candidate.startsWith('/')) errors.push(`${r}: absolut sökväg i srcset "${candidate}"`);
            else if (isLocal(candidate) && !fs.existsSync(path.join(path.dirname(f), strip(candidate)))) missing.add(`${r} → ${candidate}`);
        }
    }
    for (const [, value] of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
        if (value.startsWith('/')) errors.push(`${r}: absolut url(${value})`);
        else if (isLocal(value) && !fs.existsSync(path.join(path.dirname(f), strip(value)))) missing.add(`${r} → ${value}`);
    }
    links.set(f, pageLinks);
}

// CSS: absoluta url() och resurser som saknas
for (const f of files.filter((f) => f.endsWith('.css'))) {
    const css = fs.readFileSync(f, 'utf8');
    for (const [, value] of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
        if (value.startsWith('/')) errors.push(`${rel(f)}: absolut url(${value})`);
        else if (isLocal(value) && !fs.existsSync(path.join(path.dirname(f), strip(value)))) missing.add(`${rel(f)} → ${value}`);
    }
}

// JS: inget window.parent/top. Lagring är tillåten om den ligger i try/catch (den kastar fel i sandlådan),
// och bibliotek kan nämna localStorage utan att använda det – därför en varning, inte ett fel.
for (const f of files.filter((f) => /\.m?js$/.test(f))) {
    const js = fs.readFileSync(f, 'utf8');
    if (/\b(localStorage|sessionStorage|indexedDB)\b/.test(js)) warnings.push(`${rel(f)}: rör webblagring – se till att den ligger i try/catch och att sidan fungerar utan den`);
    if (/document\.cookie/.test(js)) warnings.push(`${rel(f)}: rör cookies – se till att det ligger i try/catch och att sidan fungerar utan dem`);
    if (/window\.(parent|top)\b/.test(js)) errors.push(`${rel(f)}: rör window.parent/top`);
}

missing.forEach((m) => errors.push(`Saknas: ${m}`));

// Alla sidor ska gå att nå från index.html
const start = path.join(root, 'index.html');
const reached = new Set([start]);
const queue = [start];
while (queue.length) {
    for (const next of links.get(queue.shift()) || []) {
        if (!reached.has(next)) { reached.add(next); queue.push(next); }
    }
}
htmlFiles.filter((f) => !reached.has(f)).forEach((f) => errors.push(`Går inte att nå från index.html: ${rel(f)}`));

// Resultat
console.log(`\nSublime Lab-kontroll av ${rel(root) || root}: ${files.length} filer, ${(total / 1048576).toFixed(1)} MB, ${htmlFiles.length} sidor`);
warnings.forEach((w) => console.log(`  ! ${w}`));
if (errors.length) {
    errors.forEach((e) => console.log(`  ✗ ${e}`));
    console.log(`\n${errors.length} fel – rätta innan uppladdning.\n`);
    process.exit(1);
}
console.log('  ✓ Klar att ladda upp\n');
