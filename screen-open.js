import * as store from './store.js';
import { state, go } from './state.js';
import { decodeWav16 } from './wav.js';
import { progressScreen } from './screen-progress.js';

/** Abre uma música salva (com a gravação de karaokê, se houver) e vai para a tela `then`. */
export function openSong(ctx, id, { then = 'player', recordingId } = {}) {
  ctx.show(
    progressScreen({
      title: 'Abrindo a música…',
      start: ({ set }) => {
        set(null, 'Lendo as faixas salvas…');
        return (async () => {
          const r = await store.loadSong(id);
          const recs = (await store.listRecordings(id)).sort((a, b) => b.createdAt - a.createdAt);
          const pick = recordingId ? recs.find((x) => x.id === recordingId) : recs[0];
          let rec = null;
          if (pick) {
            const d = decodeWav16(pick.wav);
            rec = { left: d.left, right: d.right };
          }
          return { ...r, rec };
        })();
      },
      onDone: ({ meta, stems, rec }) => {
        state.song = { name: meta.name, stems, meta, recordingRaw: rec, recording: rec };
        go(then, {});
      },
      onCancel: () => go('library'),
    }),
  );
}
