const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'Jeopardy bar league winner 1 v3.png');
const dst = path.join(__dirname, '..', 'assets', 'frame.png');

fs.copyFileSync(src, dst);
console.log('Copied template to assets/frame.png');
console.log('Size:', fs.statSync(dst).size, 'bytes');
