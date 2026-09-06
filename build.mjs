import { mkdir, cp, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await cp('index.html', 'dist/index.html');
await cp('src', 'dist/src', { recursive: true });
await writeFile('dist/.nojekyll', '');
console.log('Built static game in dist/');
