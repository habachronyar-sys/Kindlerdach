import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Originals remain untouched. Run explicitly after adding/changing a photo.
const directory = 'public/images';
const report = [];
for (const name of (await fs.readdir(directory)).filter(name => name.endsWith('.jpg'))) {
  const input = path.join(directory, name);
  const metadata = await sharp(input).metadata();
  const widths = [...new Set([640, 960, 1280, metadata.width].filter(width => width <= metadata.width))].sort((a, b) => a - b);
  const variants = [];
  for (const width of widths) {
    const output = path.join(directory, `${path.parse(name).name}-${width}.webp`);
    const result = await sharp(input).resize({width, withoutEnlargement:true}).webp({quality:78, effort:6}).toFile(output);
    variants.push({width, height:result.height, bytes:result.size, file:output});
  }
  if (name === 'dach-detail.jpg') {
    // Mobile uses object-fit:cover and object-position:60% center. Remove only
    // the sides outside the widest mobile frame, with the same focal point.
    const cropWidth = Math.round(metadata.height * 1.1);
    const left = Math.round((metadata.width - cropWidth) * 0.6);
    for (const width of [640, 960, cropWidth]) {
      await sharp(input).extract({left, top:0, width:cropWidth, height:metadata.height})
        .resize({width, withoutEnlargement:true}).webp({quality:78, effort:6})
        .toFile(path.join(directory, `dach-detail-mobile-${width}.webp`));
    }
  }
  report.push({original:name, width:metadata.width, height:metadata.height, bytes:(await fs.stat(input)).size, variants});
}
await fs.mkdir('.qa', {recursive:true});
await fs.writeFile('.qa/image-sizes.json', JSON.stringify(report, null, 2));
console.table(report.map(image => ({image:image.original, original:image.bytes, webp:image.variants.at(-1).bytes, saving:`${Math.round((1-image.variants.at(-1).bytes/image.bytes)*100)}%`})));
