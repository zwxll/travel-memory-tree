const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..'), site = path.join(root, '.pages');
const files = new Map([
  ['index.html', 'index.html'],
  ['assets/start.js', 'assets/start.js'],
  ['assets/tree-runtime.js', 'assets/tree-runtime.js'],
  ['data/photos.js', 'assets/demo-records.js'],
  ['data/user-records.js', 'data/user-records.example.js']
]);
// Refuse unexpected files so a stale or manually edited output cannot be published.
function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name), relative = path.relative(site, target).replace(/\\/g, '/');
    if (entry.isSymbolicLink()) throw new Error('Unexpected link in deployment output: ' + relative);
    if (entry.isDirectory()) inspect(target);
    else if (!files.has(relative) && relative !== '.nojekyll') throw new Error('Unexpected deployment file: ' + relative);
  }
}
if (fs.existsSync(site)) inspect(site);
for (const [destination, source] of files) {
  const target = path.join(site, destination);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, source), target);
}
fs.appendFileSync(path.join(site, 'data/user-records.js'), '\nwindow.travelTreeAdditions.demo = true;\n');
fs.writeFileSync(path.join(site, '.nojekyll'), '');
console.log('Built .pages/: generated demo cards and empty settings; no local album data copied');
