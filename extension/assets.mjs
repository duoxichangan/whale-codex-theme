import { readFile, realpath, stat, readdir } from 'node:fs/promises';
import { join, sep } from 'node:path';
export async function createAssetStore(root) {
  const base = await realpath(join(root, 'assets/whale'));
  const pet = JSON.parse(await readFile(join(base, 'pet/manifest.json'), 'utf8'));
  const policy = JSON.parse(await readFile(join(base, 'pet/action-policy.json'), 'utf8'));
  const actionIcons = JSON.parse(await readFile(join(base, 'pet/action-icons.json'), 'utf8'));
  const efforts = ['low','medium','high','xhigh','ultra'];
  const files = new Map([
    ['boot:light', ['boot/whale-light.mp4', 'video/mp4']], ['boot:dark', ['boot/whale-dark.mp4', 'video/mp4']],
    ['loading', ['boot/loading/whale-dream-v1.png', 'image/png']]
  ]);
  for (const name of ['daily','resting']) files.set('menu:'+name, ['pet/menu/'+name+'.webp','image/webp']);
  for(const mode of ['light','dark'])for(const name of ['chat','studio','library'])files.set('home:'+name+'-'+mode,['home/'+name+'.webp','image/webp']);
  const scenes = {};
  for (const mode of ['light','dark']) for (const effort of efforts) {
    const slug = effort === 'xhigh' ? 'extra-high' : effort;
    files.set(`scene:${effort}-${mode}`, [`scenes/preset-whale-girl-${slug}-${mode}/background.webp`, 'image/webp']);
    scenes[effort+'-'+mode] = JSON.parse(await readFile(join(base, `scenes/preset-whale-girl-${slug}-${mode}/theme.json`),'utf8'));
  }
  for (const [id, clip] of Object.entries(pet.clips)) files.set(`pet:${id}`, ['pet/' + clip.file, 'video/webm']);
  const iconFiles=(await readdir(join(base,'icons'))).filter(name=>name.endsWith('.svg'));
  const icons = Object.fromEntries(await Promise.all(iconFiles.map(async name => [name.slice(0,-4), await readFile(join(base, 'icons', name), 'utf8')])));
  const uiContract=JSON.parse(await readFile(join(base,'ui-contract.json'),'utf8'));
  return { metadata: { pet, policy, actionIcons, icons, efforts, scenes, uiContract }, keys: [...files.keys()], async get(key) {
    const entry = files.get(key); if (!entry) throw Error('Unknown packaged asset');
    const file = await realpath(join(base, entry[0]));
    if (!file.startsWith(base + sep)) throw Error('Asset escaped package');
    const info = await stat(file);
    if (!info.isFile() || info.size > 50 * 1024 * 1024) throw Error('Invalid packaged asset size');
    return { mime: entry[1], data: (await readFile(file)).toString('base64') };
  } };
}
