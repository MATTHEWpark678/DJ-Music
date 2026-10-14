// Estado compartilhado entre as telas.
import { Player } from './player.js';
import { MODELS } from './models.js';

function loadModelPref() {
  try {
    const v = localStorage.getItem('modelo');
    return MODELS[v] ? v : 'quatro';
  } catch {
    return 'quatro';
  }
}
export function saveModelPref(key) {
  try {
    localStorage.setItem('modelo', key);
  } catch {
    // sem problema
  }
}

export const player = new Player();

export const state = {
  pending: null, // música escolhida e ainda não separada: { file, name, duration, left, right }
  options: { focus: 'voz', quality: 'rapida', restore: false, fill: false, strength: 0.6, model: loadModelPref() },
  song: null, // música aberta: { name, stems: {nome:{left,right}}, meta: {id?, saved, focus, segments} }
  preview: null,
  screen: 'library',
  params: {},
};

let renderer = () => {};
export function setRenderer(fn) {
  renderer = fn;
}
export function go(screen, params = {}) {
  state.screen = screen;
  state.params = params;
  renderer();
}

export const STEM_LABEL = {
  voz: 'Voz',
  instrumental: 'Instrumental',
  bateria: 'Bateria',
  baixo: 'Baixo',
  guitarra: 'Guitarra',
  piano: 'Piano',
  outros: 'Outros instrumentos',
  voz_a: 'Voz A',
  voz_b: 'Voz B',
  voz_sem: 'Voz (sem marcação)',
  gravacao: 'Minha voz',
};
export const STEM_COLOR = {
  voz: 'var(--color-stem-voz)',
  instrumental: 'var(--color-stem-instrumental)',
  bateria: 'var(--color-stem-bateria)',
  baixo: 'var(--color-stem-baixo)',
  guitarra: 'var(--color-stem-guitarra)',
  piano: 'var(--color-stem-piano)',
  outros: 'var(--color-stem-outros)',
  voz_a: 'var(--color-stem-voz)',
  voz_b: 'var(--color-stem-coros)',
  voz_sem: 'var(--color-stem-outros)',
  gravacao: 'var(--color-warning)',
};

export const STEM_ICON = {
  voz: 'mic', voz_a: 'mic', voz_b: 'mic', voz_sem: 'mic', gravacao: 'mic', instrumental: 'wave',
  bateria: 'drum', baixo: 'guitar', guitarra: 'guitar', piano: 'piano', outros: 'note',
};

/** Alvos do modelo (ordem: 0 bateria, 1 baixo, 2 outros, 3 voz; no de 6 faixas, 4 guitarra e 5 piano). */
export function targetsFor(focus, nStems = 4) {
  if (focus === 'voz') return { voz: [3], instrumental: nStems === 6 ? [0, 1, 2, 4, 5] : [0, 1, 2] };
  return nStems === 6
    ? { voz: [3], bateria: [0], baixo: [1], guitarra: [4], piano: [5], outros: [2] }
    : { voz: [3], bateria: [0], baixo: [1], outros: [2] };
}
export const overlapFor = (quality) => (quality === 'maxima' ? 0.5 : 0.15);
