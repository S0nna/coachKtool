#!/usr/bin/env node
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const sourceDir = path.join(rootDir, "extension");
const outputDir = path.join(rootDir, "dist");
const manifest = JSON.parse(await readFile(path.join(sourceDir, "manifest.json"), "utf8"));

if (manifest.manifest_version !== 3 || typeof manifest.version !== "string") {
  throw new Error("extension/manifest.json must declare Manifest V3 and a string version.");
}

const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

async function collectFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolutePath = path.join(dir, entry.name);
    const archivePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await collectFiles(absolutePath, archivePath));
    else if (entry.isFile()) files.push({ absolutePath, archivePath });
  }
  return files;
}

const files = await collectFiles(sourceDir);
if (!files.some(({ archivePath }) => archivePath === "manifest.json")) {
  throw new Error("The Firefox source folder must contain manifest.json at its root.");
}
if (files.length > 0xffff) throw new Error("Too many files for a standard ZIP archive.");

const localParts = [];
const centralParts = [];
let offset = 0;
const dosDate = 0x0021; // 1980-01-01 for reproducible ZIP metadata.

for (const { absolutePath, archivePath } of files) {
  const name = Buffer.from(archivePath, "utf8");
  const original = await readFile(absolutePath);
  const compressed = deflateRawSync(original, { level: 9 });
  const checksum = crc32(original);
  if (name.length > 0xffff || original.length > 0xffffffff || compressed.length > 0xffffffff) {
    throw new Error(`File is too large for a standard ZIP archive: ${archivePath}`);
  }

  const local = Buffer.alloc(30 + name.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(dosDate, 12);
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(original.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  name.copy(local, 30);
  localParts.push(local, compressed);

  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(dosDate, 14);
  central.writeUInt32LE(checksum, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(original.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(offset, 42);
  name.copy(central, 46);
  centralParts.push(central);
  offset += local.length + compressed.length;
}

const centralDirectory = Buffer.concat(centralParts);
if (offset > 0xffffffff || centralDirectory.length > 0xffffffff) {
  throw new Error("Archive exceeds the standard ZIP size limit.");
}
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(0, 4);
end.writeUInt16LE(0, 6);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralDirectory.length, 12);
end.writeUInt32LE(offset, 16);
end.writeUInt16LE(0, 20);

await mkdir(outputDir, { recursive: true });
const outputPath = path.join(outputDir, `CoachKtool-Firefox-${manifest.version}.zip`);
await writeFile(outputPath, Buffer.concat([...localParts, centralDirectory, end]));
console.log(`Created ${path.relative(rootDir, outputPath)} from ${files.length} source files.`);
