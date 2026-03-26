import fs from 'node:fs';
import path from 'node:path';
import * as lucide from 'lucide-react';
const root = process.cwd();
const exported = new Set(Object.keys(lucide));
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
}

walk(path.join(root, 'src'));

const importRegex = /import\s*\{([^}]+)\}\s*from\s*['\"]lucide-react['\"]/g;
const missing = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = importRegex.exec(text)) !== null) {
    const names = match[1]
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => name.split(' as ')[0].trim());

    for (const name of names) {
      if (!exported.has(name)) {
        missing.push({
          file: path.relative(root, file).replace(/\\/g, '/'),
          name,
        });
      }
    }
  }
}

if (missing.length === 0) {
  console.log('OK: no missing lucide exports');
  process.exit(0);
}

console.log('Missing lucide exports:');
for (const item of missing) {
  console.log(`${item.file} -> ${item.name}`);
}
process.exit(1);
