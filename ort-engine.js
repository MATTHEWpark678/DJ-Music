// Motor de separação no aparelho: HT-Demucs (4 faixas) em ONNX, rodando com onnxruntime-web (wasm).
// Roda dentro de um Web Worker (ver worker.js). Não foi possível testar o modelo de verdade fora do celular.
import { SEGMENT } from './chunker.js';
import { modelOf } from './models.js';
export { MODELS } from './models.js';

export const ORT_VERSION = '1.20.1';
export const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const CACHE = 'modelo-demucs-v1';

let ort = null;
let session = null;
let sessionKey = null;

async function loadOrt() {
  if (!ort) {
    ort = await import(`${ORT_BASE}ort.wasm.min.mjs`);
    ort.env.wasm.wasmPaths = ORT_BASE;
    // Várias linhas de execução só funcionam quando a página está "isolada" (ver sw.js).
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, self.navigator?.hardwareConcurrency || 2) : 1;
    ort.env.wasm.proxy = false;
  }
  return ort;
}

export async function cacheModelFile(buffer, key = 'quatro') {
  const cache = await caches.open(CACHE);
  await cache.put(modelOf(key).url, new Response(buffer));
}

async function readWithProgress(res, onStatus) {
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  let buf = total ? new Uint8Array(total) : null;
  const parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (buf && got + value.length <= buf.length) buf.set(value, got);
    else {
      if (buf) {
        parts.push(buf.subarray(0, got));
        buf = null;
      }
      parts.push(value);
    }
    got += value.length;
    onStatus?.(`Baixando o modelo (uma vez só): ${Math.round(got / 1048576)} de ${total ? Math.round(total / 1048576) : '~166'} MB`);
  }
  if (buf) return buf.subarray(0, got);
  const out = new Uint8Array(got);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function getModelBytes(url, onStatus) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(url);
  if (hit) return new Uint8Array(await hit.arrayBuffer());
  onStatus?.('Baixando o modelo (uma vez só)…');
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('Não consegui baixar o modelo. Verifique a internet ou escolha o arquivo do modelo nas configurações.');
  }
  if (!res.ok) throw new Error(`O download do modelo falhou (código ${res.status}).`);
  const bytes = await readWithProgress(res, onStatus);
  try {
    await cache.put(url, new Response(bytes));
  } catch {
    // sem espaço para guardar: segue sem guardar, vai baixar de novo na próxima vez
  }
  return bytes;
}

export async function getSession(key = 'quatro', onStatus) {
  if (session && sessionKey === key) return session;
  if (session) {
    try {
      await session.release();
    } catch {
      // sem problema
    }
    session = null;
    sessionKey = null;
  }
  onStatus?.('Carregando o motor…');
  const o = await loadOrt();
  const bytes = await getModelBytes(modelOf(key).url, onStatus);
  onStatus?.('Preparando o modelo na memória…');
  try {
    // Opções que gastam menos memória ao carregar (a otimização total e a "arena" de memória fazem cópias).
    session = await o.InferenceSession.create(bytes, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'basic',
      enableCpuMemArena: false,
      enableMemPattern: false,
    });
  } catch (err) {
    throw new Error(`Não consegui carregar o modelo: provavelmente falta memória neste aparelho. Feche as outras abas do Chrome e os outros apps e tente de novo. (detalhe técnico: ${String(err.message ?? err).slice(0, 80)})`);
  }
  sessionKey = key;
  return session;
}

/** Devolve uma função no formato que o chunker espera: ([esq, dir]) => faixas[4][2]. */
export function makeModel(sess, nStems = 4) {
  const input = new Float32Array(2 * SEGMENT);
  let last = null;
  return async ([l, r]) => {
    input.set(l, 0);
    input.set(r, SEGMENT);
    last?.dispose?.();
    const out = await sess.run({ mix: new ort.Tensor('float32', input, [1, 2, SEGMENT]) });
    last = out.stems;
    const d = out.stems.data;
    const stems = [];
    for (let s = 0; s < nStems; s++) {
      stems.push([
        d.subarray(s * 2 * SEGMENT, (s * 2 + 1) * SEGMENT),
        d.subarray((s * 2 + 1) * SEGMENT, (s * 2 + 2) * SEGMENT),
      ]);
    }
    // deixa o worker respirar entre uma janela e outra (para o botão Cancelar funcionar)
    await new Promise((res) => setTimeout(res, 0));
    return stems;
  };
}

/** Mede quanto tempo o aparelho leva para uma janela de 7,8 s. */
export async function benchmark(sess, nStems = 4) {
  const model = makeModel(sess, nStems);
  const a = new Float32Array(SEGMENT);
  const b = new Float32Array(SEGMENT);
  for (let i = 0; i < SEGMENT; i++) {
    a[i] = 0.2 * Math.sin(i * 0.05) + 0.05 * (Math.random() * 2 - 1);
    b[i] = a[i];
  }
  const t0 = performance.now();
  await model([a, b]);
  return (performance.now() - t0) / 1000;
}
