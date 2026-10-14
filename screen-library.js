import { h, button, icon, toast, fmtTime, fmtBytes, tabBar, fab, actionSheet } from './dom.js';
import { state, go } from './state.js';
import * as store from './store.js';
import { decodeToStereo } from './decode.js';
import { openSong } from './screen-open.js';

const SORTS = { padrao: 'Padrão', titulo: 'Título', duracao: 'Duração' };

export function libraryScreen(ctx) {
  let songs = [];
  let query = '';
  let sort = 'padrao';
  const list = h('ul', { class: 'songs', 'aria-label': 'Músicas salvas' });
  const empty = h('div', { class: 'empty' }, h('p', {}, 'Nenhuma música ainda. Toque no + para importar uma e separar.'));
  const file = h('input', { type: 'file', accept: 'audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac', hidden: true });

  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    toast('Lendo a música…', 30000);
    try {
      const d = await decodeToStereo(await f.arrayBuffer());
      state.pending = { file: f, name: f.name.replace(/\.[^.]+$/, ''), duration: d.duration, left: d.left, right: d.right };
      toast('Pronto.', 1000);
      go('mode');
    } catch (err) {
      toast(err.message, 6000);
    }
    file.value = '';
  });

  const searchInput = h('input', { type: 'search', class: 'search', placeholder: 'Pesquisar na sua biblioteca', 'aria-label': 'Pesquisar na biblioteca', oninput: (e) => { query = e.target.value; draw(); } });
  const searchRow = h('div', { class: 'search-row', hidden: true }, searchInput, button('Cancelar', { variant: 'ghost', onClick: () => { query = ''; searchInput.value = ''; searchRow.hidden = true; titleRow.hidden = false; draw(); } }));
  const titleRow = h('header', { class: 'bar' }, h('h1', { tabindex: '-1' }, 'Separar'), button('', { variant: 'ghost', icon: 'search', ariaLabel: 'Pesquisar', onClick: () => { searchRow.hidden = false; titleRow.hidden = true; searchInput.focus(); } }));
  const sortBtn = button(`Ordenar: ${SORTS[sort]}`, { variant: 'ghost', icon: 'sort', onClick: () => actionSheet('Ordenar por', Object.entries(SORTS).map(([k, v]) => ({ label: v, onClick: () => { sort = k; sortBtn.querySelector('span').textContent = `Ordenar: ${v}`; draw(); } }))) });

  function ribbon(s) {
    if (s.quality === 'maxima') return ['Máxima', 'gold'];
    return [s.focus === 'voz' ? 'Voz' : `${s.stemNames.length} faixas`, 'pink'];
  }

  function draw() {
    const q = query.trim().toLowerCase();
    let rows = songs.filter((s) => !q || s.name.toLowerCase().includes(q));
    if (sort === 'titulo') rows = rows.slice().sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    else if (sort === 'duracao') rows = rows.slice().sort((a, b) => b.duration - a.duration);
    list.replaceChildren(
      ...rows.map((s) => {
        const [rText, rKind] = ribbon(s);
        return h('li', { class: 'song-row' },
          h('button', { class: 'song', type: 'button', 'aria-label': `${s.name}, ${fmtTime(s.duration)}, separado`, onclick: () => openSong(ctx, s.id) },
            h('span', { class: 'thumb' }, icon('note', 28), h('span', { class: `ribbon ${rKind}` }, rText)),
            h('span', { class: 'song-info' }, h('span', { class: 'song-meta' }, `${fmtTime(s.duration)} · ${fmtBytes(s.bytes ?? 0)}`), h('span', { class: 'song-name' }, s.name)),
            h('span', { class: 'pill' }, 'Separado')),
          button('', { variant: 'ghost', icon: 'dots', ariaLabel: `Mais opções de ${s.name}`, onClick: () => menu(s) }));
      }),
    );
    empty.hidden = songs.length > 0;
    if (songs.length && !rows.length) list.replaceChildren(h('li', { class: 'help' }, 'Nenhuma música com esse nome.'));
  }

  function menu(s) {
    actionSheet(s.name, [
      { label: 'Abrir', onClick: () => openSong(ctx, s.id) },
      { label: 'Renomear', onClick: async () => {
        const n = prompt('Novo nome da música:', s.name)?.trim();
        if (!n) return;
        await store.updateSong({ ...s, name: n });
        s.name = n;
        draw();
      } },
      { label: 'Apagar do aparelho', danger: true, onClick: async () => {
        if (!confirm(`Apagar "${s.name}" do aparelho? Isso não dá para desfazer.`)) return;
        await store.deleteSong(s.id);
        songs = songs.filter((x) => x.id !== s.id);
        draw();
        toast('Música apagada.');
      } },
    ]);
  }

  store.listSongs().then((r) => { songs = r; draw(); }).catch((e) => toast(`Não consegui ler a biblioteca: ${e.message}`));

  const el = h('main', { class: 'screen with-tabs' }, titleRow, searchRow, h('div', { class: 'sortbar' }, sortBtn), empty, list, file, fab('Importar música', () => file.click()), tabBar('library', (id) => go(id)));
  draw();
  return { el };
}
