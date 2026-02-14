import { readFileSync, writeFileSync } from 'fs';

const html = readFileSync('web/index.html', 'utf8');
const js = readFileSync('web/bundle.js', 'utf8');
const standalone = html.replace(
  '<script src="bundle.js"></script>',
  '<script>' + js + '</script>'
);
writeFileSync('web/standalone.html', standalone);
console.log('Built web/standalone.html');
