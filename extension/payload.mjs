import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { installRenderer } from './renderer.mjs';
import { createBootState } from '../runtime/boot-state.mjs';
import { inspectReadiness } from '../runtime/readiness.mjs';
import { installBoot } from '../runtime/boot.mjs';
import { installTheme } from '../runtime/theme.mjs';
import { installCompanion } from '../runtime/companion.mjs';
import { installSettings } from '../runtime/settings.mjs';
import { readAppearance } from '../runtime/appearance.mjs';
import { installIcons } from '../runtime/icons.mjs';
export async function buildInjection(root, { metadata, binding, openSettings = false, loadingOnly = false, preview = false } = {}) {
  const [skin, bootCss, companionCss, petState, settingsCss] = await Promise.all(['runtime/theme.css','runtime/boot.css','runtime/companion.css','runtime/pet-state.js','runtime/settings.css'].map(file => readFile(join(root, file), 'utf8')));
  const payload = { metadata, binding, openSettings, loadingOnly, preview, skin, bootCss, companionCss, settingsCss };
  return `(${installRenderer.toString()})(${JSON.stringify(payload)},{createBootState:${createBootState},inspectReadiness:${inspectReadiness},installBoot:${installBoot},installTheme:${installTheme},installCompanion:${installCompanion},installSettings:${installSettings},readAppearance:${readAppearance},installIcons:${installIcons},createPetState:${petState.trim()}})`;
}
