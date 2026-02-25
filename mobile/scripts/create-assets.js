const fs = require('fs');
const path = require('path');
const assetsDir = path.join(__dirname, '..', 'assets');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
['icon.png', 'splash.png', 'adaptive-icon.png'].forEach(f => {
  fs.writeFileSync(path.join(assetsDir, f), png);
  console.log('Created', f);
});
