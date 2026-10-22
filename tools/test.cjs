const { execFileSync } = require('node:child_process');
const path = require('node:path');

for (const name of ['album-files', 'envelope-store', 'story-store', 'heart-layout', 'carousel-layout', 'year-route', 'site-build']) {
  execFileSync(process.execPath, [path.join(__dirname, name + '-test.cjs')], { stdio: 'inherit' });
}
