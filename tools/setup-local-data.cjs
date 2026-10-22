const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

for (const name of ['photos', 'user-records']) {
  const target = path.join(root, 'data', name + '.js');
  if (fs.existsSync(target)) {
    console.log('Kept existing data/' + name + '.js');
    continue;
  }
  fs.copyFileSync(path.join(root, 'data', name + '.example.js'), target, fs.constants.COPYFILE_EXCL);
  console.log('Created data/' + name + '.js');
}
