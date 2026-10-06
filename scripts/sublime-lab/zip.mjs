// Packar en prototypmapp som zip för uppladdning i Sublime Lab (ProtoSpace).
// Ingen extern dependency: skriver zip-formatet själv med zlib. Sökvägar får alltid "/" och
// index.html hamnar i zip-filens rot.
// Användning: node zip.mjs <mapp> [utfil.zip]   (standard: <mapp>.zip bredvid mappen)
// Packa inte med PowerShells Compress-Archive – den skriver bakåtsnedstreck i sökvägarna och då hittar servern inga filer.

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const src = path.resolve(process.argv[2] || 'dist');
const out = path.resolve(process.argv[3] || `${src}.zip`);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
};

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
});

// DOS-tid för zip-poster
const now = new Date();
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

const local = [];
const central = [];
let offset = 0;

for (const file of walk(src).sort()) {
    const name = Buffer.from(path.relative(src, file).split(path.sep).join('/'), 'utf8');
    const data = fs.readFileSync(file);
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    // Lagra okomprimerat när komprimeringen inte hjälper (bilder, film, woff2)
    const stored = compressed.length >= data.length;
    const body = stored ? data : compressed;
    const crc = crc32(data);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6); // UTF-8-namn
    header.writeUInt16LE(stored ? 0 : 8, 8);
    header.writeUInt16LE(dosTime, 10);
    header.writeUInt16LE(dosDate, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(body.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    local.push(header, name, body);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(stored ? 0 : 8, 10);
    entry.writeUInt16LE(dosTime, 12);
    entry.writeUInt16LE(dosDate, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);

    offset += header.length + name.length + body.length;
}

const centralSize = central.reduce((sum, b) => sum + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(central.length / 2, 8);
end.writeUInt16LE(central.length / 2, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

fs.writeFileSync(out, Buffer.concat([...local, ...central, end]));
console.log(`Zip klar: ${out} (${central.length / 2} filer, ${(fs.statSync(out).size / 1048576).toFixed(1)} MB)\n`);
