// Förhandsvisar en prototypmapp som Sublime Lab (ProtoSpace) kör den: under en okänd undermapp,
// i en sandlådad iframe utan eget ursprung (origin "null"), där localStorage m.m. kastar fel.
// Användning: node preview.mjs <mapp> [--port 8765] [--strict]
//   --strict  skickar SVG med fel MIME-typ och utan CORS-huvud – fångar ikoner/loggor som bara
//             fungerar på en tillåtande server. Övriga filer får Access-Control-Allow-Origin: *
//             (moduler, CSS med crossorigin och typsnitt kräver det i sandlådan).
// Öppna sedan http://localhost:<port>/ – välj sida med #sida.html, t.ex. http://localhost:8765/#om.html
// Varje 404 skrivs ut i terminalen.

import http from 'http';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const root = path.resolve(args.find((a) => !a.startsWith('--')) || 'dist');
const port = Number(args[args.indexOf('--port') + 1]) || 8765;
const strict = args.includes('--strict');
const SUB = '/okand-undermapp/v1/';

const types = {
    '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
    '.mjs': 'text/javascript', '.json': 'application/json', '.map': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
    '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
    '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf',
};

const frame = `<!doctype html><html lang="sv"><head><meta charset="utf-8"><title>Sublime Lab-förhandsvisning</title>
<style>html,body{margin:0;height:100%}iframe{width:100%;height:100%;border:0;display:block}</style></head>
<body><iframe id="f" sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"></iframe>
<script>const f=document.getElementById('f');const go=()=>{f.src='${SUB}'+(location.hash.slice(1)||'index.html')};addEventListener('hashchange',go);go();</script>
</body></html>`;

if (!fs.existsSync(path.join(root, 'index.html'))) {
    console.error(`Hittar ingen index.html i ${root}`);
    process.exit(1);
}

http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/' || url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(frame);
    }
    if (!url.startsWith(SUB)) {
        res.writeHead(404);
        return res.end();
    }

    const file = path.join(root, url.slice(SUB.length));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        console.log(`404  ${url.slice(SUB.length)}   (från ${req.headers.referer?.split(SUB)[1] || 'okänd sida'})`);
        res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
        return res.end('404');
    }

    const ext = path.extname(file).toLowerCase();
    const isSvg = ext === '.svg';
    const headers = {
        'Content-Type': strict && isSvg ? 'text/plain' : types[ext] || 'application/octet-stream',
        'Accept-Ranges': 'bytes',
        ...(strict && isSvg ? {} : { 'Access-Control-Allow-Origin': '*' }),
    };
    const { size } = fs.statSync(file);
    const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
    if (range) {
        const start = Number(range[1] || 0);
        const end = range[2] ? Number(range[2]) : size - 1;
        res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
        return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, 'Content-Length': size });
    fs.createReadStream(file).pipe(res);
}).listen(port, () => {
    console.log(`Förhandsvisning av ${root}${strict ? ' (strikt)' : ''}: http://localhost:${port}/   (Ctrl+C för att stoppa)`);
});
