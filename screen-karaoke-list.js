import { h, button, toast, fmtTime, tabBar, fab, actionSheet, sheet } from './dom.js';
import { go } from './state.js';
import * as store from './store.js';
import { openSong } from './screen-open.js';

export function karaokeListScreen(ctx) {
  const list = h('ul', { class: 'songs', 'aria-label': 'Sessões de karaokê' });
  const empty = h('div', { class: 'empty' }, h('p', {}, 'Nenhuma sessão de karaokê ainda. Toque no + e escolha uma música salva.'));
  let songs = [];

  async function refresh() {
    const [s, recs] = await Promise.all([store.listSongs(), store.listAllRecordings()]);
    songs = s;
    const byId = new Map(s.map((x) => [x.id, x]));
    const rows = recs.filter((r) => byId.has(r.songId)).sort((a, b) => b.createdAt - a.createdAt);
    list.replaceChildren(
      ...rows.map((r) => {
        const song = byId.get(r.songId);
        const secs = Math.max(0, (r.wav.byteLength - 44) / 4 / 44100);
        return h('li', { class: 'song-row' },
          h('button', { class: 'song', type: 'button', 'aria-label': `Sessão de ${song.name}, ${fmtTime(secs)}`, onclick: () => openSong(ctx, song.id, { then: 'karaoke', recordingId: r.id }) },
            h('span', { class: 'song-info' }, h('span', { class: 'song-meta' }, `${new Date(r.createdAt).toLocaleDateString('pt-BR')} · ${fmtTime(secs)}`), h('span', { class: 'song-name' }, song.name))),
          button('', { variant: 'ghost', icon: 'dots', ariaLabel: `Mais opções da sessão de ${song.name}`, onClick: () => actionSheet(song.name, [
            { label: 'Abrir', onClick: () => openSong(ctx, song.id, { then: 'karaoke', recordingId: r.id }) },
            { label: 'Apagar gravação', danger: true, onClick: async () => { if (!confirm('Apagar esta gravação?')) return; await store.deleteRecording(r.id); refresh(); } },
          ]) }));
      }),
    );
    empty.hidden = rows.length > 0;
  }

  function pickSong() {
    if (!songs.length) return toast('Salve uma música primeiro, na aba Separar.', 5000);
    const s = sheet({
      title: 'Escolha a música',
      children: [h('div', { class: 'stack' }, songs.map((x) => button(x.name, { variant: 'secondary', onClick: () => { s.close(); openSong(ctx, x.id, { then: 'karaoke' }); } })), button('Cancelar', { variant: 'ghost', onClick: () => s.close() }))],
    });
  }

  refresh().catch((e) => toast(`Não consegui ler as sessões: ${e.message}`));
  return { el: h('main', { class: 'screen with-tabs' }, h('header', { class: 'bar' }, h('h1', { tabindex: '-1' }, 'Karaokê')), empty, list, fab('Nova sessão de karaokê', pickSong), tabBar('karaokeList', (id) => go(id))) };
}
