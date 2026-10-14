import { h, button, icon, toast, fmtTime, sheet, actionSheet } from './dom.js';
import { state, go, player, STEM_LABEL, STEM_COLOR, STEM_ICON } from './state.js';
import * as store from './store.js';
import { effectiveGains } from './mix.js';
import { loadPlayer } from './mixer-items.js';

export function playerScreen() {
  const song = state.song;
  if (!song) {
    go('library');
    return { el: h('div') };
  }
  const items = loadPlayer(song, true);
  player.onEnded = () => syncPlay();
  const dur = player.duration;

  const badge = h('span', { class: 'badge' }, song.meta.saved ? 'Salva' : 'Temporária');
  const timeNow = h('span', { class: 'time' }, '0:00');
  const timeEnd = h('span', { class: 'time' }, fmtTime(dur));
  const seek = h('input', { type: 'range', min: '0', max: '1000', value: '0', 'aria-label': 'Posição da música' });
  let dragging = false;
  seek.addEventListener('input', () => {
    dragging = true;
    player.seek((Number(seek.value) / 1000) * dur);
    updateTime();
  });
  seek.addEventListener('change', () => { dragging = false; });
  const playBtn = h('button', { class: 'play', type: 'button', 'aria-label': 'Tocar', onclick: async () => { if (player.playing) player.pause(); else await player.play(); syncPlay(); } }, icon('play', 30));

  function syncPlay() {
    playBtn.replaceChildren(icon(player.playing ? 'pause' : 'play', 30));
    playBtn.setAttribute('aria-label', player.playing ? 'Pausar' : 'Tocar');
  }
  function updateTime() {
    const pos = player.position;
    timeNow.textContent = fmtTime(pos);
    seek.setAttribute('aria-valuetext', `${fmtTime(pos)} de ${fmtTime(dur)}`);
    if (!dragging && dur) seek.value = String(Math.round((pos / dur) * 1000));
  }
  const timer = setInterval(() => { updateTime(); if (!player.playing) syncPlay(); }, 250);

  // ---- faixas
  const rows = new Map();
  const activeText = h('strong', {}, 'Todas as faixas');
  function refreshRows() {
    const stems = player.mix.stems;
    const gains = effectiveGains(stems);
    stems.forEach((s, i) => {
      const r = rows.get(s.id);
      if (!r) return;
      r.el.classList.toggle('silenced', gains[i] === 0);
      r.tag.textContent = s.solo ? 'solo' : s.muted ? 'mudo' : '';
    });
    const on = stems.filter((_, i) => gains[i] > 0);
    activeText.textContent = on.length === stems.length ? 'Todas as faixas' : on.length === 0 ? 'Nenhuma' : on.map((s) => STEM_LABEL[s.id] ?? s.id).join(', ');
  }
  function stemMenu(id, label) {
    const st = player.mix.get(id);
    actionSheet(label, [
      { label: st.muted ? `Ativar o som de ${label}` : `Silenciar ${label}`, onClick: () => { player.setMuted(id, !st.muted); refreshRows(); } },
      { label: st.solo ? `Tirar o solo de ${label}` : `Só ${label} (solo)`, onClick: () => { player.setSolo(id, !st.solo); refreshRows(); } },
    ]);
  }
  const mixer = h('section', { class: 'stems', 'aria-label': 'Faixas' });
  for (const it of items) {
    const label = STEM_LABEL[it.id] ?? it.id;
    const st = player.mix.get(it.id);
    const vol = h('input', { type: 'range', class: 'stem-vol', min: '0', max: '100', value: String(Math.round(st.volume * 100)), id: `vol-${it.id}`, 'aria-label': `Volume de ${label}`, oninput: (e) => player.setVolume(it.id, Number(e.target.value) / 100) });
    const tag = h('span', { class: 'tag' }, '');
    const el = h('div', { class: 'stem', style: `--c:${STEM_COLOR[it.id] ?? 'var(--color-text-muted)'}` },
      h('span', { class: 'stem-ic' }, icon(STEM_ICON[it.id] ?? 'note', 24)),
      h('div', { class: 'stem-main' }, h('label', { for: `vol-${it.id}` }, label, tag), vol),
      button('', { variant: 'ghost', icon: 'dots', ariaLabel: `Opções de ${label}`, onClick: () => stemMenu(it.id, label) }));
    rows.set(it.id, { el, tag, vol });
    mixer.append(el);
  }
  refreshRows();
  function resetStems() {
    for (const s of player.mix.stems) {
      player.setVolume(s.id, 1);
      player.setMuted(s.id, false);
      player.setSolo(s.id, false);
      const r = rows.get(s.id);
      if (r) r.vol.value = '100';
    }
    refreshRows();
    toast('Faixas restauradas.', 2000);
  }

  // ---- tom e velocidade
  const speedBtn = h('button', { class: 'tbtn', type: 'button', 'aria-label': 'Velocidade e tom', onclick: tuneSheet });
  const tuneBtn = h('button', { class: 'tbtn', type: 'button', 'aria-label': 'Tom e velocidade', onclick: tuneSheet });
  function updateTune() {
    speedBtn.replaceChildren(icon('speed', 22), h('span', {}, `${Math.round(player.speed * 100)}%`));
    tuneBtn.replaceChildren(icon('tune', 22), h('span', {}, `Tom ${player.semitones > 0 ? '+' : ''}${player.semitones}`));
    speedBtn.classList.toggle('changed', Math.abs(player.speed - 1) > 0.001);
    tuneBtn.classList.toggle('changed', player.semitones !== 0);
  }
  updateTune();
  function stepper({ title, text, onMinus, onPlus, minusOk, plusOk, changed }) {
    const val = h('output', { class: changed() ? 'changed' : '' }, text());
    const upd = () => { val.textContent = text(); val.classList.toggle('changed', changed()); minus.disabled = !minusOk(); plus.disabled = !plusOk(); updateTune(); };
    const minus = h('button', { type: 'button', class: 'step', 'aria-label': `Diminuir ${title.toLowerCase()}`, onclick: () => { onMinus(); upd(); } }, icon('minus', 20));
    const plus = h('button', { type: 'button', class: 'step', 'aria-label': `Aumentar ${title.toLowerCase()}`, onclick: () => { onPlus(); upd(); } }, icon('plus', 20));
    upd();
    return h('div', { class: 'stepper' }, h('span', { class: 'step-title' }, title), minus, val, plus);
  }
  function tuneSheet() {
    const s = sheet({
      title: 'Tom e velocidade',
      children: [
        stepper({ title: 'Tom', text: () => `${player.semitones > 0 ? '+' : ''}${player.semitones}`, onMinus: () => player.setSemitones(player.semitones - 1), onPlus: () => player.setSemitones(player.semitones + 1), minusOk: () => player.semitones > -6, plusOk: () => player.semitones < 6, changed: () => player.semitones !== 0 }),
        stepper({ title: 'Velocidade', text: () => `${Math.round(player.speed * 100)}%`, onMinus: () => player.setSpeed(Math.round((player.speed - 0.05) * 100) / 100), onPlus: () => player.setSpeed(Math.round((player.speed + 0.05) * 100) / 100), minusOk: () => player.speed > 0.5001, plusOk: () => player.speed < 1.4999, changed: () => Math.abs(player.speed - 1) > 0.001 }),
        h('p', { class: 'help' }, 'O tom muda sem alterar a velocidade, e a velocidade muda sem alterar o tom.'),
        h('div', { class: 'row' }, button('Fechar', { variant: 'primary', onClick: () => s.close() })),
      ],
    });
  }

  // ---- salvar
  async function doSave(names, close) {
    const chosen = {};
    for (const n of names) chosen[n] = song.stems[n];
    try {
      const meta = await store.saveSong({ id: song.meta.id ?? store.newId(), name: song.name, createdAt: song.meta.createdAt, duration: song.meta.duration, focus: song.meta.focus, quality: song.meta.quality, model: song.meta.model, segments: song.meta.segments }, chosen);
      song.meta = meta;
      badge.textContent = 'Salva';
      saveBtn.querySelector('span').textContent = 'Música salva';
      saveBtn.disabled = true;
      close?.();
      toast('Música salva no aparelho.');
    } catch (err) {
      toast(`Não consegui salvar: ${err.message ?? err}`, 7000);
    }
  }
  function chooseSheet(parent) {
    const names = Object.keys(song.stems);
    const boxes = names.map((n) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: true, 'data-n': n }), h('span', {}, STEM_LABEL[n] ?? n)));
    const s = sheet({
      title: 'Quais faixas salvar?',
      children: [
        h('p', { class: 'help' }, 'Salvar menos faixas gasta menos espaço.'),
        ...boxes,
        h('div', { class: 'stack' },
          button('Salvar as escolhidas', { variant: 'primary', onClick: () => {
            const picked = boxes.map((b) => b.querySelector('input')).filter((i) => i.checked).map((i) => i.dataset.n);
            if (!picked.length) return toast('Escolha pelo menos uma faixa.');
            parent?.close();
            doSave(picked, () => s.close());
          } }),
          button('Voltar', { variant: 'ghost', onClick: () => s.close() })),
      ],
    });
  }
  function discard() {
    player.pause();
    state.song = null;
    go('library');
  }
  function saveSheet() {
    const s = sheet({
      title: 'Gostou do resultado?',
      children: [
        h('p', { class: 'help' }, 'A música só fica no aparelho se você salvar. Se descartar, ela some quando você sair.'),
        h('div', { class: 'stack' },
          button('Salvar esta música', { variant: 'primary', onClick: () => doSave(Object.keys(song.stems), () => s.close()) }),
          button('Escolher faixas para salvar', { variant: 'secondary', onClick: () => chooseSheet(s) }),
          button('Descartar', { variant: 'danger', onClick: () => { s.close(); discard(); } }),
          button('Continuar ouvindo', { variant: 'ghost', onClick: () => s.close() })),
      ],
    });
  }
  const saveBtn = button(song.meta.saved ? 'Música salva' : 'Salvar…', { variant: 'secondary', icon: 'save', disabled: song.meta.saved, onClick: saveSheet });

  function back() {
    if (song.meta.saved) { player.pause(); state.song = null; return go('library'); }
    const s = sheet({
      title: 'Sair sem salvar?',
      children: [
        h('div', { class: 'stack' },
          button('Salvar esta música', { variant: 'primary', onClick: () => { s.close(); saveSheet(); } }),
          button('Descartar e sair', { variant: 'danger', onClick: () => { s.close(); discard(); } }),
          button('Continuar aqui', { variant: 'ghost', onClick: () => s.close() })),
      ],
    });
  }

  const hasVoice = !!song.stems.voz && song.meta.focus === 'voz';
  const el = h(
    'main',
    { class: 'screen' },
    h('header', { class: 'bar' }, button('', { variant: 'ghost', icon: 'back', ariaLabel: 'Voltar', onClick: back }), h('h1', { tabindex: '-1', class: 'ellipsis' }, song.name), badge),
    mixer,
    h('div', { class: 'pills' }, button('Karaokê', { variant: 'secondary', icon: 'mic', onClick: () => go('karaoke') }), hasVoice ? button('Vozes A e B', { variant: 'secondary', icon: 'users', onClick: () => go('voices') }) : null),
    h('div', { class: 'active-row' }, h('div', {}, h('span', { class: 'help' }, 'Faixas ativas'), h('div', {}, activeText)),
      h('div', { class: 'row-tight' }, button('', { variant: 'ghost', icon: 'reset', ariaLabel: 'Restaurar volumes das faixas', onClick: resetStems }), button('', { variant: 'ghost', icon: 'download', ariaLabel: 'Exportar', onClick: () => go('export') }))),
    h('section', { class: 'transport', 'aria-label': 'Reprodução' }, seek, h('div', { class: 'times' }, timeNow, timeEnd),
      h('div', { class: 'transport-row' }, speedBtn,
        button('', { variant: 'ghost', icon: 'rew', ariaLabel: 'Voltar 10 segundos', onClick: () => player.seek(player.position - 10) }),
        playBtn,
        button('', { variant: 'ghost', icon: 'ff', ariaLabel: 'Avançar 10 segundos', onClick: () => player.seek(player.position + 10) }),
        tuneBtn)),
    saveBtn,
  );
  if (state.params.justSeparated) setTimeout(saveSheet, 300);
  return { el, leave: () => { clearInterval(timer); player.pause(); player.onEnded = null; } };
}
