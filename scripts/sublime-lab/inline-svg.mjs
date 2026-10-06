// Bäddar in SVG-ikoner och loggor som data-URI:er i den byggda CSS:en och HTML:en.
// I Sublime Lab (ProtoSpace) körs sidan i en sandlådad iframe med ursprunget "null". CSS-masker hämtas alltid med CORS
// och SVG i <img> kräver rätt MIME-typ från servern – inbäddade SVG:er hämtas inte alls och fungerar därför
// oavsett serverns inställningar. Körs efter bygget, före kontrollen. Ändrar filerna i mappen på plats.
// Användning: node inline-svg.mjs <mapp>

import fs from 'fs';
import path from 'path';

const root = path.resolve(process.argv[2] || 'dist');

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
});

const cache = new Map();
const dataUri = (file) => {
    if (!cache.has(file)) {
        const svg = fs.readFileSync(file, 'utf8').replace(/<\?xml[^>]*>\s*/, '').trim();
        cache.set(file, `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`);
    }
    return cache.get(file);
};

// Löser en relativ SVG-sökväg från filen som refererar till den; null om den inte finns
const resolveSvg = (from, url) => {
    const clean = url.split('#')[0].split('?')[0];
    if (!clean.endsWith('.svg') || /^(data:|https?:|\/)/.test(clean)) return null;
    const target = path.join(path.dirname(from), clean);
    return fs.existsSync(target) ? target : null;
};

let count = 0;
const replaceUrls = (file, text) => text.replace(/url\(\s*(['"]?)([^'")]+\.svg)\1\s*\)/g, (match, quote, url) => {
    const target = resolveSvg(file, url);
    if (!target) return match;
    count++;
    return `url("${dataUri(target)}")`;
});

for (const file of walk(root)) {
    if (file.endsWith('.css')) {
        const css = fs.readFileSync(file, 'utf8');
        fs.writeFileSync(file, replaceUrls(file, css));
    }
    if (/\.html?$/.test(file)) {
        let html = fs.readFileSync(file, 'utf8');
        // <img src="…svg"> – inte <link href> (favikonen hämtas av webbläsaren, inte av sidan)
        html = html.replace(/(<img\b[^>]*?\ssrc=)(["'])([^"']+\.svg)\2/gi, (match, before, quote, url) => {
            const target = resolveSvg(file, url);
            if (!target) return match;
            count++;
            return `${before}${quote}${dataUri(target)}${quote}`;
        });
        html = replaceUrls(file, html);
        fs.writeFileSync(file, html);
    }
}

console.log(`SVG inbäddade: ${count} referenser (${cache.size} filer)`);
