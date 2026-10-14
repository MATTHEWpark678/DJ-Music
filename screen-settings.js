import { h, button, toast, fmtBytes, tabBar, segmented, sheet } from './dom.js';
import { state, go, saveModelPref } from './state.js';
import * as store from './store.js';
import { storageLevel } from './mix.js';
import { runBenchmark, giveModelFile } from './client.js';
import { MODELS } from './models.js';
import { rememberSpeed, fmtMinutes, savedSpeed } from './job.js';
import { progressScreen } from './screen-progress.js';

export function settingsScreen(ctx) {
  const meter = h('section', { class: 'meter', 'aria-label': 'Espaço usado' });

  async function refresh() {
    const [songs, u] = await Promise.all([store.listSongs(), store.usage()]);
    const lvl = storageLevel(u.usage, u.quota);
    meter.replaceChildren(...[
      h('p', {}, `O app usa ${fmtBytes(u.usage)}${u.quota ? ` de ${fmtBytes(u.quota)} possíveis` : ''}`),
      h('div', { class: `progress level-${lvl.level}`, role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(lvl.fraction * 100)) }, h('div', { class: 'fill', style: `width:${lvl.fraction * 100}%` })),
      lvl.level !== 'normal' ? h('p', { class: 'warn' }, lvl.level === 'cheio' ? 'Espaço quase cheio. Apague músicas antigas.' : 'Espaço ficando curto.') : null,
      songs.length ? button('Apagar a música mais antiga', { variant: 'ghost', icon: 'trash', onClick: async () => {
        const old = songs[songs.length - 1];
        if (!confirm(`Apagar "${old.name}" do aparelho? Isso não dá para desfazer.`)) return;
        await store.deleteSong(old.id);
        toast('Música apagada.');
        refresh();
      } }) : null,
    ].filter(Boolean));
  }

  function testPhone() {
    ctx.show(
      progressScreen({
        title: 'Testando o seu celular',
        start: ({ status }) => runBenchmark(state.options.model, status),
        onDone: (seconds) => {
          rememberSpeed(seconds);
          go('settings');
          const sh = sheet({
            title: 'Resultado do teste',
            children: [
              h('p', {}, `Uma parte de 7,8 s da música levou ${seconds.toFixed(1)} s.`),
              h('p', {}, `Uma música de 3 min e 30 s deve levar cerca de ${fmtMinutes((210 / 7.8) * 1.2 * seconds)} no modo Rápida e ${fmtMinutes((210 / 7.8) * 2 * seconds)} no Máxima (estimativa).`),
              h('div', { class: 'row' }, button('Fechar', { variant: 'primary', onClick: () => sh.close() })),
            ],
          });
        },
        onCancel: () => go('settings'),
      }),
    );
  }

  function chooseFile() {
    const f = h('input', { type: 'file', accept: '.onnx', hidden: true });
    f.addEventListener('change', async () => {
      const m = f.files?.[0];
      if (!m) return;
      toast('Guardando o modelo…', 30000);
      try {
        await giveModelFile(await m.arrayBuffer(), state.options.model);
        toast('Modelo guardado. Pode separar.');
      } catch (err) {
        toast(err.message, 6000);
      }
    });
    document.body.append(f);
    f.click();
    setTimeout(() => f.remove(), 60000);
  }

  const per = savedSpeed();
  const modelHelp = h('p', { class: 'help' });
  const updHelp = () => { modelHelp.textContent = state.options.model === 'seis' ? 'Separa também guitarra e piano. Usa bastante memória; se travar, volte para 4 faixas.' : 'Separa bateria, baixo, outros e voz. Mais leve para o celular.'; };
  updHelp();

  refresh().catch(() => {});
  return {
    el: h('main', { class: 'screen with-tabs' },
      h('header', { class: 'bar' }, h('h1', { tabindex: '-1' }, 'Ajustes')),
      h('section', {}, h('h2', {}, 'Modelo de separação'),
        segmented({ label: 'Modelo de separação', value: state.options.model, options: Object.entries(MODELS).map(([k, m]) => ({ value: k, label: m.label })), onChange: (v) => { state.options.model = v; saveModelPref(v); updHelp(); } }),
        modelHelp,
        h('p', { class: 'help' }, 'Na primeira vez que você separa uma música, o modelo é baixado (50 a 170 MB) e fica guardado no aparelho.')),
      h('section', { class: 'stack' }, h('h2', {}, 'Meu celular'),
        h('p', { class: 'help' }, per ? `Última medida: ${per.toFixed(1)} s para cada 7,8 s de música.` : 'Ainda não medi a velocidade do seu celular.'),
        button('Testar meu celular', { variant: 'secondary', onClick: testPhone }),
        button('Escolher arquivo do modelo (.onnx)', { variant: 'ghost', onClick: chooseFile })),
      h('section', {}, h('h2', {}, 'Espaço'), meter),
      h('section', {}, h('h2', {}, 'Sobre'), h('p', { class: 'help' }, 'Separador de Vozes: app pessoal e gratuito. Tudo roda no seu celular; suas músicas não saem dele.')),
      tabBar('settings', (id) => go(id))),
  };
}
