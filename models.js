// Modelos de separação disponíveis. Ordem das faixas do modelo: 0 bateria, 1 baixo, 2 outros, 3 voz
// (no de 6 faixas: 4 guitarra, 5 piano).
export const MODELS = {
  quatro: {
    label: '4 faixas (mais leve)',
    stems: 4,
    url: 'https://huggingface.co/StemSplitio/htdemucs-onnx/resolve/main/htdemucs_fp16weights.onnx',
  },
  seis: {
    label: '6 faixas (guitarra e piano)',
    stems: 6,
    url: 'https://huggingface.co/adowu/htdemucs-6s-onnx/resolve/main/htdemucs_6s_fp16weights.onnx',
  },
};
export const modelOf = (key) => MODELS[key] ?? MODELS.quatro;
