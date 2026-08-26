const { useState, useEffect, useRef, useCallback, Fragment } = React;

// Cada pessoa acessa por um link próprio (?u=<codigo>) que identifica os
// dados dela sem precisar de login. Guardamos o código no localStorage na
// primeira visita e removemos da URL, pra não ficar exposto se a página for
// recarregada/compartilhada por engano.
const CHAVE_CODIGO_LOCAL = "despesas_codigo_usuario";
function resolverCodigoUsuario() {
  const params = new URLSearchParams(location.search);
  const daUrl = params.get("u");
  if (daUrl) {
    localStorage.setItem(CHAVE_CODIGO_LOCAL, daUrl);
    params.delete("u");
    const resto = params.toString();
    history.replaceState(null, "", location.pathname + (resto ? `?${resto}` : ""));
    return daUrl;
  }
  return localStorage.getItem(CHAVE_CODIGO_LOCAL) || null;
}
const CODIGO_USUARIO = resolverCodigoUsuario();
// O código sempre vai como query string (nunca header), porque também é
// usado em <img src> e links diretos (comprovantes, assinatura), que não
// conseguem levar header nenhum.
function functionUrl(nome, query = "") {
  const codigoParam = CODIGO_USUARIO ? `codigo=${encodeURIComponent(CODIGO_USUARIO)}` : "";
  const qs = [query, codigoParam].filter(Boolean).join("&");
  return `/.netlify/functions/${nome}${qs ? `?${qs}` : ""}`;
}

const TIPOS = ["Almoço", "Jantar", "Combustível", "Hospedagem", "Materiais e Serviços"];

// Política padrão por tipo, usada enquanto o solicitante não personaliza nada
// na aba Cadastros (mantém o comportamento antigo: Almoço/Jantar com teto de
// 35,00; os demais tipos sem limite até serem ativados).
const POLITICAS_PADRAO = {
  "Almoço": { ativo: true, limite: "35,00" },
  "Jantar": { ativo: true, limite: "35,00" },
  "Combustível": { ativo: false, limite: "" },
  "Hospedagem": { ativo: false, limite: "" },
  "Materiais e Serviços": { ativo: false, limite: "" },
};
// Tipos cujo aviso de valor acima da política pergunta "quantas pessoas" e,
// se houver mais de uma, multiplica o limite por esse número antes de decidir
// se ainda precisa corrigir o valor.
const TIPOS_COM_PESSOAS = ["Almoço", "Jantar", "Hospedagem"];

function politicaDoTipo(profile, tipo) {
  const p = profile && profile.politicas && profile.politicas[tipo];
  return p || POLITICAS_PADRAO[tipo] || { ativo: false, limite: "" };
}

// Paleta por tipo de despesa — cores validadas (contraste, daltonismo) nesta
// ordem fixa. A ordem é o que garante a segurança: nunca reordenar as barras
// por valor, senão pares nunca testados como vizinhos podem ficar lado a lado.
// Fonte única: as barras do gráfico e as etiquetas da tabela saem daqui, pra
// um tipo nunca aparecer com cores diferentes nos dois lugares.
const TIPO_COR = {
  "Almoço": "#2a78d6",
  "Jantar": "#eb6834",
  "Combustível": "#1baf7a",
  "Hospedagem": "#eda100",
  "Materiais e Serviços": "#e87ba4",
};

// Mistura a cor com branco (alvo 255) ou preto (alvo 0). Feito em JS, e não
// com color-mix() do CSS, porque o app precisa funcionar em webviews de
// celular mais simples — já tivemos incompatibilidade desse tipo aqui.
function misturar(hex, proporcao, alvo) {
  const n = parseInt(hex.slice(1), 16);
  const canais = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const m = canais.map((c) => Math.round(c * proporcao + alvo * (1 - proporcao)));
  return `rgb(${m[0]}, ${m[1]}, ${m[2]})`;
}

function canais(rgb) {
  return rgb.match(/\d+/g).slice(0, 3).map(Number);
}
// Contraste WCAG entre duas cores "rgb(...)".
function contraste(a, b) {
  const lum = (rgb) => {
    const l = canais(rgb).map((c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
  };
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Etiqueta do tipo na tabela: mesma cor da barra do gráfico, em versão clara
// no fundo e escura no texto. O texto da etiqueta é pequeno (12px), e a cor
// cheia não sustentaria contraste suficiente em todos os tipos — por isso a
// etiqueta usa tons da própria cor em vez do preenchimento sólido.
// O texto é escurecido até atingir 4.5:1 (mínimo do WCAG AA para texto
// pequeno); sem isso o amarelo da Hospedagem ficava em 4.15.
function estiloTipo(tipo) {
  const cor = TIPO_COR[tipo];
  if (!cor) return { backgroundColor: "#f1f5f9", color: "#334155", borderColor: "#cbd5e1" };
  const fundo = misturar(cor, 0.16, 255);
  let texto = misturar(cor, 0.66, 0);
  for (let p = 0.66; p >= 0.3 && contraste(texto, fundo) < 4.5; p -= 0.04) {
    texto = misturar(cor, p, 0);
  }
  return { backgroundColor: fundo, borderColor: misturar(cor, 0.45, 255), color: texto };
}

// Gráfico de barras horizontais com a somatória das despesas por tipo.
// Mostra sempre os 5 tipos, na mesma ordem — ver comentário de TIPO_COR.
function GraficoPorTipo({ records }) {
  const totais = TIPOS.map((tipo) => ({
    tipo,
    total: records.reduce((s, r) => (r.tipo === tipo ? s + (Number(r.valor) || 0) : s), 0),
  }));
  const maior = Math.max(1, ...totais.map((t) => t.total));
  return (
    <div className="space-y-2.5">
      {totais.map(({ tipo, total }) => (
        <div key={tipo} className="flex items-center gap-2.5">
          <span className="w-32 shrink-0 truncate text-xs text-slate-600" title={tipo}>{tipo}</span>
          <div className="h-3 min-w-0 flex-1 rounded-sm bg-slate-100">
            <div className="h-3" style={{ width: `${(total / maior) * 100}%`, backgroundColor: TIPO_COR[tipo], borderRadius: "0 3px 3px 0" }} />
          </div>
          <span className="w-20 shrink-0 text-right font-mono-num text-xs text-slate-700">{formatValor(total)}</span>
        </div>
      ))}
    </div>
  );
}

function Icon({ children, size = 16, className = "", ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      {children}
    </svg>
  );
}
const UploadIcon = (p) => <Icon {...p}><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" /></Icon>;
const TrashIcon = (p) => <Icon {...p}><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></Icon>;
const PencilIcon = (p) => <Icon {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Icon>;
const PlusIcon = (p) => <Icon {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Icon>;
const CheckIcon = (p) => <Icon {...p}><path d="M20 6 9 17l-5-5" /></Icon>;
const XIcon = (p) => <Icon {...p}><path d="M18 6 6 18" /><path d="M6 6l12 12" /></Icon>;
const PrinterIcon = (p) => <Icon {...p}><path d="M6 9V2h12v7" /><rect x="6" y="14" width="12" height="8" rx="1" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /></Icon>;
const LoaderIcon = (p) => <Icon {...p}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></Icon>;
const RefreshIcon = (p) => <Icon {...p}><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></Icon>;
const AlertIcon = (p) => <Icon {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></Icon>;
const ImageIcon = (p) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></Icon>;
const FileTextIcon = (p) => <Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></Icon>;
const ArrowLeftIcon = (p) => <Icon {...p}><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></Icon>;
const EyeIcon = (p) => <Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Icon>;
const SheetIcon = (p) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" /></Icon>;
const UserIcon = (p) => <Icon {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Icon>;
const DownloadIcon = (p) => <Icon {...p}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></Icon>;

function pad2(n) { return String(n).padStart(2, "0"); }
function formatDatePtBr(date) { return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`; }
function parseDatePtBr(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  return isNaN(dt.getTime()) ? null : dt;
}
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}
function formatValor(num) {
  return (Number(num) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseValorInput(raw) {
  if (typeof raw === "number") return raw;
  let s = String(raw || "").trim();
  if (!s) return 0;
  if (s.includes(",")) {
    // "1.234,56" -> ponto é milhar, vírgula é decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // Sem vírgula: só existe decimal se o ponto vier seguido de 1-2 dígitos
    // finais. "1.200" (3 dígitos) é milhar em pt-BR -> 1200, não 1.2.
    const partes = s.split(".");
    if (partes.length > 1 && partes[partes.length - 1].length === 3) s = partes.join("");
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
// Reduz fotos grandes (câmera de celular facilmente passa de 6 MB) antes do
// envio, pra não estourar o limite de payload do servidor. Se o navegador não
// conseguir decodificar o arquivo (ex.: formato não suportado), devolve null
// e o chamador segue com o arquivo original.
async function comprimirImagem(file, maxDim = 2000, quality = 0.85) {
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * escala);
    const h = Math.round(bitmap.height * escala);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return canvas.toDataURL("image/jpeg", quality).split(",")[1];
  } catch {
    return null;
  }
}
// Deixa o usuário escolher a pasta/nome do arquivo ao baixar, quando o
// navegador suporta (Chrome/Edge); em navegadores sem suporte (Firefox,
// Safari) ou se o diálogo falhar por outro motivo, cai no download comum
// (pasta de Downloads padrão). Cancelar o diálogo não é tratado como erro.
// O navegador só reconhece showSaveFilePicker como ação direta do usuário
// por uma janela curta após o clique. Se o arquivo demora pra ficar pronto
// (gera planilha, converte em PDF, baixa fotos — vários segundos), pedir o
// local DEPOIS de tudo pronto já chega tarde demais e cai sem avisar no
// download direto da pasta padrão. Por isso a escolha do local é separada
// da escrita: pedirLocalParaSalvar() deve ser chamada assim que o usuário
// clica, ANTES de qualquer trabalho demorado; escreverArquivo() só grava no
// que já foi escolhido (ou cai no download comum se não houver escolha).
async function pedirLocalParaSalvar(nomeSugerido, mimeType) {
  if (!window.showSaveFilePicker) return null;
  try {
    const ext = "." + (nomeSugerido.split(".").pop() || "bin");
    return await window.showSaveFilePicker({
      suggestedName: nomeSugerido,
      types: [{ description: "Arquivo", accept: { [mimeType || "application/octet-stream"]: [ext] } }],
    });
  } catch (e) {
    return null; // cancelado ou sem suporte: cai no download comum na hora de escrever
  }
}
async function escreverArquivo(handle, blob, nomeSugerido) {
  if (handle) {
    try {
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch { /* handle inválido por algum motivo: cai no download comum abaixo */ }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nomeSugerido;
  a.click();
  URL.revokeObjectURL(a.href);
}
// Atalho pra quando não há trabalho demorado entre o clique e o arquivo
// pronto (ex.: baixar um comprovante já carregado) — pede e escreve direto.
async function salvarArquivoComo(blob, nomeSugerido) {
  const handle = await pedirLocalParaSalvar(nomeSugerido, blob.type);
  await escreverArquivo(handle, blob, nomeSugerido);
}
// Prepara a imagem da assinatura: reduz o tamanho e converte para JPEG com
// fundo branco (assinaturas costumam ser PNG com fundo transparente, que sem
// isso ficariam com fundo preto ao virar JPEG). Devolve também as dimensões,
// necessárias pra posicionar a imagem na planilha sem distorcer.
async function comprimirAssinatura(file, maxDim = 500, quality = 0.92) {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const base64 = canvas.toDataURL("image/jpeg", quality).split(",")[1];
  return { base64, mediaType: "image/jpeg", width: w, height: h };
}
function makeId() { return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function fileUrl(id) { return functionUrl("files", `id=${encodeURIComponent(id)}`); }
function previewUrl(id, page) { return `${fileUrl(id)}&preview=${page}`; }

// Converte cada página de um PDF em JPEG (via pdf.js) e envia ao servidor,
// para que a pré-visualização e o relatório fotográfico consigam exibi-las.
// JPEG em vez de PNG e um teto de dimensão evitam páginas grandes (formulários
// digitalizados em A3, por ex.) de estourar o limite de payload do servidor.
async function converterPdfEmImagens(id, base64, onProgress) {
  if (!window.pdfjsLib) throw new Error("Biblioteca de PDF não carregou");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
  const total = pdf.numPages;
  const MAX_DIM = 2200;

  for (let n = 1; n <= total; n++) {
    if (onProgress) onProgress(n, total);
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const escala = Math.min(2, MAX_DIM / Math.max(base.width, base.height));  // escala 2 = boa leitura na impressão
    const viewport = page.getViewport({ scale: escala });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const jpeg = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
    const res = await fetch(functionUrl("upload-preview"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, page: n, base64: jpeg }),
    });
    await parseJsonResponse(res);
  }
  return total;
}

// Detecta uma versão nova do app publicada: compara o ETag do app.jsx que
// está no ar agora contra o que foi carregado nesta aba. `cache: "no-store"`
// + um parâmetro que muda a cada chamada evitam pegar uma resposta em cache
// (do navegador ou de algum proxy no meio do caminho) em vez do arquivo real.
async function buscarVersaoAtual() {
  try {
    const res = await fetch(`/app.jsx?_=${Date.now()}`, { method: "HEAD", cache: "no-store" });
    return res.headers.get("etag") || res.headers.get("last-modified") || null;
  } catch {
    return null;
  }
}

// --- chamadas às Netlify Functions ---

// O corpo da requisição (arquivo em base64 + JSON) passa pelo limite de ~6 MB
// do AWS Lambda; nesse caso o servidor devolve uma resposta vazia/não-JSON.
// Aqui isso vira uma mensagem clara em vez de um erro de "JSON inválido".
async function parseJsonResponse(res) {
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { /* resposta não era JSON */ }
  }
  if (data === null) {
    if (res.status === 413 || (!res.ok && !text)) {
      throw new Error("Arquivo muito grande para o servidor (limite de ~6 MB). Tente uma foto ou um PDF menor.");
    }
    throw new Error(`Resposta inesperada do servidor (HTTP ${res.status}).`);
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function apiGet(fn) {
  const res = await fetch(functionUrl(fn));
  return parseJsonResponse(res);
}
async function apiPost(fn, payload) {
  const res = await fetch(functionUrl(fn), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  return parseJsonResponse(res);
}
async function callExtract(id, base64, mediaType, isPdf, fileName) {
  const res = await fetch(functionUrl("extract"), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, base64, mediaType, isPdf, fileName }),
  });
  return parseJsonResponse(res);
}

// Uint8Array -> base64, em pedaços pra não estourar o limite de argumentos
// do String.fromCharCode com arquivos maiores.
function uint8ParaBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// Converte um PDF que já está no servidor (lançamento antigo ou conversão que falhou)
async function converterPdfExistente(id, onProgress) {
  const res = await fetch(fileUrl(id));
  if (!res.ok) throw new Error(`Não foi possível baixar o arquivo (HTTP ${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return converterPdfEmImagens(id, uint8ParaBase64(bytes), onProgress);
}

function Field({ label, value, onChange, placeholder, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" />
    </label>
  );
}

function EditRow({ draft, setDraft, onSave, onCancel }) {
  return (
    <tr className="bg-slate-50">
      <td className="no-print px-3 py-2 align-top"></td>
      <td className="px-3 py-2 align-top">
        <input value={draft.data} onChange={(e) => setDraft({ ...draft, data: e.target.value })}
          placeholder="DD/MM/AAAA" maxLength={10}
          className="w-28 rounded border border-slate-300 px-2 py-1 text-sm font-mono-num focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" />
      </td>
      <td className="px-3 py-2 align-top">
        <select value={draft.tipo} onChange={(e) => setDraft({ ...draft, tipo: e.target.value })}
          className="w-full min-w-[9rem] rounded border border-slate-300 px-2 py-1 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500">
          {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td className="px-3 py-2 align-top">
        <input value={draft.obs} onChange={(e) => setDraft({ ...draft, obs: e.target.value })} placeholder="Histórico / observações"
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" />
      </td>
      <td className="px-3 py-2 align-top">
        <input value={draft.valor} onChange={(e) => setDraft({ ...draft, valor: e.target.value })}
          onBlur={() => setDraft((d) => ({ ...d, valor: formatValor(parseValorInput(d.valor)) }))}
          placeholder="0,00" inputMode="decimal"
          className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-sm font-mono-num focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" />
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex items-center gap-1">
          <button onClick={onSave} title="Salvar" className="rounded p-1.5 text-emerald-700 hover:bg-emerald-100"><CheckIcon size={16} /></button>
          <button onClick={onCancel} title="Cancelar" className="rounded p-1.5 text-slate-500 hover:bg-slate-200"><XIcon size={16} /></button>
        </div>
      </td>
    </tr>
  );
}

// Um cartão do relatório fotográfico. Detecta quando a pré-visualização não
// carrega (arquivo removido/nunca convertido) e mostra um aviso em vez do
// ícone de imagem quebrada do navegador, escondendo também o botão de baixar
// nesse caso (evita o erro 404 ao clicar).
function ReportPageCard({ r, idx, total, onBaixar, fileUrl }) {
  const [imgFalhou, setImgFalhou] = useState(false);
  const disponivel = !!r.src && !imgFalhou;
  return (
    <div className="report-page rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3 border-b border-slate-100 pb-2">
        <div className="min-w-0">
          <p className="font-mono-num text-xs text-slate-500">{r.data} · {r.tipo} · {formatValor(r.valor)}</p>
          {r.obs && <p className="mt-1 text-sm text-slate-600">{r.obs}</p>}
        </div>
        {disponivel && (
          <button onClick={() => onBaixar(r, idx)} title="Baixar este comprovante" className="no-print shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <DownloadIcon size={14} />
          </button>
        )}
      </div>
      {disponivel ? (
        <img src={r.src} alt={r.fileName || "comprovante"} className="mx-auto max-h-[70vh] w-auto rounded" onError={() => setImgFalhou(true)} />
      ) : (
        <div className="rounded border border-slate-200 bg-stone-50 p-6 text-center text-sm text-slate-500">
          <FileTextIcon className="mx-auto mb-2 text-slate-400" size={24} />
          {imgFalhou ? (
            <>Comprovante indisponível (o arquivo pode ter sido removido) — <a href={fileUrl(r.id)} target="_blank" rel="noreferrer" className="text-amber-700 underline">tentar abrir o arquivo original</a></>
          ) : (
            <>Não foi possível converter este PDF — <a href={fileUrl(r.id)} target="_blank" rel="noreferrer" className="text-amber-700 underline">abrir arquivo</a></>
          )}
          <div className="mt-1 text-xs text-slate-400">{r.fileName}</div>
        </div>
      )}
      <div className="mt-3 border-t border-slate-100 pt-2 text-center text-xs text-slate-500">
        Página {idx + 1} de {total}
        {r.totalPages > 1 && <span className="ml-1 text-slate-400">(arquivo {r.page}/{r.totalPages})</span>}
      </div>
    </div>
  );
}

// Achata a estrutura agrupada (centro de custo -> projetos) numa lista plana
// de linhas, uma por projeto, repetindo os dados do centro de custo — é o
// formato que a planilha oficial espera (uma linha por combinação).
function flattenRateio(grupos) {
  const linhas = [];
  for (const g of grupos || []) {
    const projetos = g.projetos && g.projetos.length > 0 ? g.projetos : [{ projeto: "", nProjeto: "", fase: "17", percentual: "" }];
    for (const p of projetos) {
      linhas.push({
        centroCusto: g.centroCusto || "", nCentroCusto: g.nCentroCusto || "",
        projeto: p.projeto || "", nProjeto: p.nProjeto || "", fase: p.fase || "", percentual: p.percentual || "",
      });
    }
  }
  return linhas;
}

// Editor de rateio agrupado por centro de custo, com projetos aninhados e
// conferência de que a soma dos percentuais de cada centro de custo dá 100%.
function RateioEditor({ grupos, setGrupos }) {
  const addGrupo = () => setGrupos([...grupos, { centroCusto: "", nCentroCusto: "", projetos: [{ projeto: "", nProjeto: "", fase: "17", percentual: "" }] }]);
  const removeGrupo = (gi) => setGrupos(grupos.filter((_, i) => i !== gi));
  const updateGrupo = (gi, campo, valor) => setGrupos(grupos.map((g, i) => (i === gi ? { ...g, [campo]: valor } : g)));
  const addProjeto = (gi) => setGrupos(grupos.map((g, i) => (i === gi ? { ...g, projetos: [...g.projetos, { projeto: "", nProjeto: "", fase: "17", percentual: "" }] } : g)));
  const removeProjeto = (gi, pi) => setGrupos(grupos.map((g, i) => (i === gi ? { ...g, projetos: g.projetos.filter((_, j) => j !== pi) } : g)));
  const updateProjeto = (gi, pi, campo, valor) => setGrupos(grupos.map((g, i) => (i === gi ? { ...g, projetos: g.projetos.map((p, j) => (j === pi ? { ...p, [campo]: valor } : p)) } : g)));

  return (
    <div className="space-y-3">
      {grupos.length === 0 && <p className="text-xs text-slate-400">Nenhum centro de custo. Adicione abaixo.</p>}
      {grupos.map((g, gi) => {
        const projetos = g.projetos || [];
        const soma = projetos.reduce((s, p) => s + parseValorInput(p.percentual), 0);
        const somaOk = projetos.length === 0 || Math.abs(soma - 100) < 0.01;
        return (
          <div key={gi} className="rounded-md border border-slate-200 p-2.5">
            <div className="grid grid-cols-[3fr_1fr_auto] gap-1">
              <input value={g.centroCusto} onChange={(e) => updateGrupo(gi, "centroCusto", e.target.value)} placeholder="Centro de custo" className="min-w-0 rounded border border-slate-300 px-1.5 py-1 text-xs" />
              <input value={g.nCentroCusto} onChange={(e) => updateGrupo(gi, "nCentroCusto", e.target.value)} placeholder="Nº CC" className="min-w-0 rounded border border-slate-300 px-1.5 py-1 text-xs" />
              <button onClick={() => removeGrupo(gi)} title="Excluir centro de custo" className="flex shrink-0 items-center justify-center rounded p-1 text-red-600 hover:bg-red-100"><TrashIcon size={13} /></button>
            </div>
            <div className="mt-2 space-y-1.5 border-l-2 border-slate-100 pl-2">
              {projetos.map((p, pi) => (
                <div key={pi} className="grid grid-cols-[2fr_1fr_0.6fr_1fr] gap-1">
                  <input value={p.projeto} onChange={(e) => updateProjeto(gi, pi, "projeto", e.target.value)} placeholder="Projeto" className="min-w-0 rounded border border-slate-300 px-1.5 py-1 text-xs" />
                  <input value={p.nProjeto} onChange={(e) => updateProjeto(gi, pi, "nProjeto", e.target.value)} placeholder="Nº projeto" className="min-w-0 rounded border border-slate-300 px-1.5 py-1 text-xs" />
                  <input value={p.fase} onChange={(e) => updateProjeto(gi, pi, "fase", e.target.value)} placeholder="Fase" className="min-w-0 rounded border border-slate-300 px-1.5 py-1 text-xs" />
                  <div className="flex min-w-0 gap-1">
                    <input value={p.percentual} onChange={(e) => updateProjeto(gi, pi, "percentual", e.target.value)} placeholder="%" className="w-full min-w-0 rounded border border-slate-300 px-1.5 py-1 text-xs" />
                    <button onClick={() => removeProjeto(gi, pi)} title="Excluir projeto" className="shrink-0 rounded p-1 text-red-600 hover:bg-red-100"><TrashIcon size={13} /></button>
                  </div>
                </div>
              ))}
              <button onClick={() => addProjeto(gi)} className="text-xs font-medium text-amber-700 hover:text-amber-900">+ projeto</button>
            </div>
            {projetos.length > 0 && (
              <div className={`mt-1.5 text-right text-xs font-medium ${somaOk ? "text-emerald-600" : "text-red-600"}`}>
                Soma dos projetos: {soma.toFixed(2).replace(".", ",")}% {somaOk ? "✓" : "— deve somar 100%"}
              </div>
            )}
          </div>
        );
      })}
      <button onClick={addGrupo} className="text-xs font-medium text-amber-700 hover:text-amber-900">+ centro de custo</button>
    </div>
  );
}

function App() {
  const [view, setView] = useState("tabela"); // tabela | relatorio | perfil | gerar
  const [records, setRecords] = useState([]);
  const [recordsEtag, setRecordsEtag] = useState(null);
  const [profile, setProfile] = useState({});
  const [usuarioNome, setUsuarioNome] = useState("");
  const [presets, setPresets] = useState([]);
  const [assinaturaVersao, setAssinaturaVersao] = useState(0);
  const [temAssinatura, setTemAssinatura] = useState(null); // null = ainda não sabe
  const [enviandoAssinatura, setEnviandoAssinatura] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [versaoDesatualizada, setVersaoDesatualizada] = useState(false);
  const versaoCarregadaRef = useRef(null);
  const [queue, setQueue] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [filaAvisoLimite, setFilaAvisoLimite] = useState([]); // ids de records aguardando confirmação
  const [avisoLimite, setAvisoLimite] = useState(null); // { id, pessoas, nomes }
  const [previewId, setPreviewId] = useState(null);
  const [toast, setToast] = useState(null);
  const [selecionados, setSelecionados] = useState(() => new Set());
  const fileInputRef = useRef(null);
  const assinaturaInputRef = useRef(null);
  const dropRef = useRef(null);

  // login por nome (sem senha — saber o próprio nome cadastrado já é a barreira)
  const [loginNome, setLoginNome] = useState("");
  const [loginCarregando, setLoginCarregando] = useState(false);
  const [loginErro, setLoginErro] = useState(null);
  const fazerLogin = async (e) => {
    e.preventDefault();
    const nome = loginNome.trim();
    if (!nome) return;
    setLoginCarregando(true);
    setLoginErro(null);
    try {
      const res = await fetch(functionUrl("login"), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome }),
      });
      const data = await parseJsonResponse(res);
      localStorage.setItem(CHAVE_CODIGO_LOCAL, data.codigo);
      location.reload();
    } catch (err) {
      setLoginErro(String(err.message || err));
      setLoginCarregando(false);
    }
  };

  // formulário de geração
  const [fluxo, setFluxo] = useState("reembolso"); // "adiantamento" | "reembolso"
  const [motivo, setMotivo] = useState("");
  const [valorAdiantamento, setValorAdiantamento] = useState("");
  const [rateio, setRateio] = useState([]);
  const [previsoes, setPrevisoes] = useState([]);
  const [gerando, setGerando] = useState(false);
  const [gerandoPreview, setGerandoPreview] = useState(null); // tipo em geração
  const [previewPdf, setPreviewPdf] = useState(null); // { url, nome }

  useEffect(() => {
    if (!CODIGO_USUARIO) { setLoaded(true); return; }
    (async () => {
      try {
        const [r, p, rp, rc] = await Promise.all([apiGet("records"), apiGet("profile"), apiGet("rateio"), apiGet("rascunho")]);
        setRecords(r.records || []);
        setRecordsEtag(r.etag ?? null);
        setProfile(p.profile || {});
        setUsuarioNome(p.usuario || "");
        setPresets(rp.presets || []);
        const rascunho = rc.rascunho || {};
        setMotivo(rascunho.motivo || "");
        setValorAdiantamento(rascunho.valorAdiantamento || "");
        setRateio(Array.isArray(rascunho.rateio) && rascunho.rateio.length > 0 ? rascunho.rateio : (rp.presets || []));
        setPrevisoes(Array.isArray(rascunho.previsoes) ? rascunho.previsoes : []);
        if (rascunho.fluxo) setFluxo(rascunho.fluxo);
      } catch (e) {
        setLoadError(String(e.message || e));
      } finally { setLoaded(true); }
    })();
  }, []);

  // Avisa quando sai uma versão nova do app enquanto a aba já está aberta —
  // útil porque não há service worker nem recarregamento automático: sem
  // isso, quem deixa a aba aberta por horas continua numa versão antiga sem
  // perceber. Confere ao carregar, a cada alguns minutos e sempre que a aba
  // volta a ficar visível/em foco (cobre quem deixa em outra aba/minimizado).
  useEffect(() => {
    let cancelado = false;
    buscarVersaoAtual().then((v) => { if (!cancelado) versaoCarregadaRef.current = v; });
    const checar = async () => {
      if (!versaoCarregadaRef.current) return;
      const v = await buscarVersaoAtual();
      if (v && v !== versaoCarregadaRef.current) setVersaoDesatualizada(true);
    };
    const intervalo = setInterval(checar, 5 * 60 * 1000);
    const aoVisivel = () => { if (document.visibilityState === "visible") checar(); };
    window.addEventListener("focus", checar);
    document.addEventListener("visibilitychange", aoVisivel);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
      window.removeEventListener("focus", checar);
      document.removeEventListener("visibilitychange", aoVisivel);
    };
  }, []);

  // Salva o formulário de geração em preenchimento (rascunho), pra não se
  // perder se a página fechar antes de gerar. Não há histórico de
  // relatórios já gerados — a empresa controla isso em outra ferramenta.
  useEffect(() => {
    if (!loaded) return;
    const handle = setTimeout(() => {
      apiPost("rascunho", { rascunho: { motivo, valorAdiantamento, rateio, previsoes, fluxo } }).catch(() => {});
    }, 600);
    return () => clearTimeout(handle);
  }, [motivo, valorAdiantamento, rateio, previsoes, fluxo, loaded]);

  // Salva a tabela sempre que muda, mas nunca com duas gravações em voo ao
  // mesmo tempo: durante o envio em lote, cada arquivo processado dispara uma
  // mudança em "records", e se a gravação anterior ainda não tivesse voltado
  // do servidor, as duas usavam o mesmo etag antigo — a segunda era recusada
  // como "conflito" e o lançamento sumia da tabela (o comprovante ficava
  // salvo, mas nunca entrava na lista). Aqui, uma gravação em andamento só
  // marca a próxima como pendente; ela sempre usa o estado mais recente.
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const recordsEtagRef = useRef(recordsEtag);
  recordsEtagRef.current = recordsEtag;
  const salvandoRef = useRef(false);
  const pendenteRef = useRef(false);
  const conflitosSeguidosRef = useRef(0);

  const salvarRecords = useCallback(async () => {
    if (salvandoRef.current) { pendenteRef.current = true; return; }
    salvandoRef.current = true;
    try {
      do {
        pendenteRef.current = false;
        try {
          const res = await fetch(functionUrl("records"), {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ records: recordsRef.current, etag: recordsEtagRef.current }),
          });
          if (res.status === 409) {
            // Não busca nem mescla dados do servidor: o que está na tela
            // agora já é a intenção mais recente do usuário, incluindo
            // edições em lançamentos existentes (ex.: o ajuste do valor da
            // refeição pro limite). Trazer e mesclar dados "frescos" do
            // servidor já causou o oposto do que devia — descartava essa
            // edição e trazia de volta o valor antigo. Só busca o etag
            // atualizado e tenta gravar de novo com os dados locais.
            conflitosSeguidosRef.current += 1;
            if (conflitosSeguidosRef.current > 8) {
              showToast("Não foi possível sincronizar as despesas (muitas gravações ao mesmo tempo). Recarregue a página antes de continuar.", true);
              pendenteRef.current = false;
            } else {
              const fresh = await apiGet("records");
              recordsEtagRef.current = fresh.etag ?? null;
              setRecordsEtag(fresh.etag ?? null);
              pendenteRef.current = true; // tenta de novo com o etag atualizado
            }
          } else {
            conflitosSeguidosRef.current = 0;
            const data = await parseJsonResponse(res);
            recordsEtagRef.current = data.etag ?? null;
            setRecordsEtag(data.etag ?? null);
          }
        } catch (e) {
          showToast(`Falha ao salvar despesas: ${e.message}`, true);
        }
      } while (pendenteRef.current);
    } finally { salvandoRef.current = false; }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    pendenteRef.current = true;
    salvarRecords();
  }, [records, loaded, salvarRecords]);

  const showToast = (msg, isError) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4000);
  };

  // Mostra os avisos de refeição acima do limite um de cada vez (útil em
  // envios de vários comprovantes de uma vez).
  useEffect(() => {
    if (!avisoLimite && filaAvisoLimite.length > 0) {
      setAvisoLimite({ id: filaAvisoLimite[0], pessoas: "", nomes: "" });
      setFilaAvisoLimite((prev) => prev.slice(1));
    }
  }, [filaAvisoLimite, avisoLimite]);

  // Usado pelos tipos com a pergunta "quantas pessoas" (Almoço, Jantar,
  // Hospedagem): com mais de uma pessoa, o limite da política é multiplicado
  // por esse número antes de decidir se o valor ainda precisa ser corrigido.
  const confirmarAvisoLimite = (incluirPessoas) => {
    const rec = records.find((r) => r.id === avisoLimite.id);
    const limite = rec ? parseValorInput(politicaDoTipo(profile, rec.tipo).limite) : 0;
    if (incluirPessoas) {
      const pessoas = parseInt(avisoLimite.pessoas, 10) || 1;
      const efetivo = limite * pessoas;
      const info = avisoLimite.nomes.trim()
        ? (avisoLimite.pessoas ? `Refeição para ${avisoLimite.pessoas} pessoa(s): ${avisoLimite.nomes.trim()}` : `Também para: ${avisoLimite.nomes.trim()}`)
        : (avisoLimite.pessoas ? `Despesa para ${avisoLimite.pessoas} pessoa(s)` : "");
      setRecords((prev) => prev.map((r) => {
        if (r.id !== avisoLimite.id) return r;
        return {
          ...r,
          valor: r.valor > efetivo ? efetivo : r.valor,
          obs: info ? (r.obs ? `${r.obs} — ${info}` : info) : r.obs,
        };
      }));
    } else {
      // Sem outras pessoas: não se justifica o valor acima do limite —
      // ajusta para o teto permitido.
      setRecords((prev) => prev.map((r) =>
        r.id === avisoLimite.id ? { ...r, valor: limite } : r
      ));
    }
    setAvisoLimite(null);
  };

  // Usado pelos demais tipos (sem a pergunta de "quantas pessoas"): só
  // mantém o valor como está ou corrige para o valor da política.
  const manterAvisoLimite = () => setAvisoLimite(null);
  const corrigirAvisoLimite = () => {
    const rec = records.find((r) => r.id === avisoLimite.id);
    const limite = rec ? parseValorInput(politicaDoTipo(profile, rec.tipo).limite) : 0;
    setRecords((prev) => prev.map((r) => r.id === avisoLimite.id ? { ...r, valor: limite } : r));
    setAvisoLimite(null);
  };

  const processFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const items = files.map((f) => ({ qid: makeId(), name: f.name, status: "pendente" }));
    setQueue((prev) => [...prev, ...items]);
    setProcessing(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const qid = items[i].qid;
      setQueue((prev) => prev.map((q) => (q.qid === qid ? { ...q, status: "lendo" } : q)));
      try {
        const isPdf = file.type === "application/pdf";
        let base64 = await fileToBase64(file);
        let mediaType = isPdf ? "application/pdf" : (file.type || "image/jpeg");
        if (!isPdf) {
          const comprimido = await comprimirImagem(file);
          if (comprimido) { base64 = comprimido; mediaType = "image/jpeg"; }
        }
        const recId = makeId();
        const { parsed, fileStored } = await callExtract(recId, base64, mediaType, isPdf, file.name);

        let needsReview = false;
        let dateObj = parseDatePtBr(parsed && parsed.data);
        if (!dateObj) { dateObj = new Date(); needsReview = true; }
        let tipo = parsed && parsed.tipo;
        if (!TIPOS.includes(tipo)) { tipo = "Materiais e Serviços"; needsReview = true; }
        let valor = Number(parsed && parsed.valor);
        if (isNaN(valor)) { valor = 0; needsReview = true; }

        // PDFs viram imagens para poderem ser vistos e impressos no relatório
        let pages = isPdf ? 0 : 1;
        let convErro = null;
        if (isPdf && fileStored) {
          try {
            setQueue((prev) => prev.map((q) => (q.qid === qid ? { ...q, status: "convertendo" } : q)));
            pages = await converterPdfEmImagens(recId, base64, (n, total) => {
              setQueue((prev) => prev.map((q) => (q.qid === qid ? { ...q, status: "convertendo", progresso: `${n}/${total}` } : q)));
            });
          } catch (e) {
            pages = 0;
            convErro = String(e.message || e);
          }
        }

        setRecords((prev) => [...prev, {
          id: recId, data: formatDatePtBr(dateObj), tipo,
          obs: (parsed && parsed.observacoes) || (needsReview ? "Confira os dados extraídos" : ""),
          valor, fileName: file.name, mediaType, hasFile: !!fileStored, pages,
          status: needsReview ? "revisar" : "ok",
        }]);
        const politicaTipo = politicaDoTipo(profile, tipo);
        const limitePolitica = parseValorInput(politicaTipo.limite);
        if (politicaTipo.ativo && limitePolitica > 0 && valor > limitePolitica) {
          setFilaAvisoLimite((prev) => [...prev, recId]);
        }
        if (convErro) {
          setQueue((prev) => prev.map((q) => (q.qid === qid ? { ...q, status: "aviso", error: `lido, mas o PDF não converteu: ${convErro}` } : q)));
        } else {
          setQueue((prev) => prev.map((q) => (q.qid === qid ? { ...q, status: "ok" } : q)));
        }
        continue;
      } catch (err) {
        setQueue((prev) => prev.map((q) => (q.qid === qid ? { ...q, status: "erro", error: String(err.message || err) } : q)));
      }
    }
    setProcessing(false);
  }, [profile]);

  const onFileInputChange = (e) => { processFiles(e.target.files); e.target.value = ""; };
  const onDrop = (e) => { e.preventDefault(); dropRef.current?.classList.remove("border-amber-500", "bg-amber-50"); processFiles(e.dataTransfer.files); };
  const onDragOver = (e) => { e.preventDefault(); dropRef.current?.classList.add("border-amber-500", "bg-amber-50"); };
  const onDragLeave = () => dropRef.current?.classList.remove("border-amber-500", "bg-amber-50");

  const startEdit = (r) => { setEditingId(r.id); setEditDraft({ data: r.data, tipo: r.tipo, obs: r.obs, valor: formatValor(r.valor) }); };
  const saveEdit = (id) => {
    const d = parseDatePtBr(editDraft.data);
    setRecords((prev) => prev.map((r) => r.id !== id ? r : {
      ...r, data: d ? formatDatePtBr(d) : r.data,
      tipo: TIPOS.includes(editDraft.tipo) ? editDraft.tipo : r.tipo,
      obs: editDraft.obs, valor: parseValorInput(editDraft.valor), status: d ? "ok" : "revisar",
    }));
    setEditingId(null); setEditDraft(null);
  };
  const deleteRecord = async (r) => {
    if (!window.confirm("Excluir este lançamento e o arquivo do comprovante? Esta ação não pode ser desfeita.")) return;
    setRecords((prev) => prev.filter((x) => x.id !== r.id));
    if (r.hasFile) { try { await fetch(`${fileUrl(r.id)}&pages=${Number(r.pages) || 0}`, { method: "DELETE" }); } catch {} }
  };

  const toggleSelecionado = (id) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const excluirSelecionados = async () => {
    const alvos = records.filter((r) => selecionados.has(r.id));
    if (alvos.length === 0) return;
    if (!window.confirm(`Excluir ${alvos.length} lançamento(s) selecionado(s) e os comprovantes anexados? Esta ação não pode ser desfeita.`)) return;
    setRecords((prev) => prev.filter((r) => !selecionados.has(r.id)));
    setSelecionados(new Set());
    await Promise.all(alvos.filter((r) => r.hasFile).map((r) =>
      fetch(`${fileUrl(r.id)}&pages=${Number(r.pages) || 0}`, { method: "DELETE" }).catch(() => {})
    ));
  };

  const [convertendoId, setConvertendoId] = useState(null);

  const converterAgora = async (rec) => {
    setConvertendoId(rec.id);
    try {
      const total = await converterPdfExistente(rec.id, (n, t) => setConvertendoId(`${rec.id}|${n}/${t}`));
      setRecords((prev) => prev.map((r) => (r.id === rec.id ? { ...r, pages: total } : r)));
      showToast(`PDF convertido: ${total} página(s).`);
    } catch (e) {
      showToast(`Falha na conversão: ${e.message}`, true);
    } finally {
      setConvertendoId(null);
    }
  };

  const converterTodos = async () => {
    const pendentes = records.filter((r) => r.hasFile && r.mediaType === "application/pdf" && !(Number(r.pages) > 0));
    let ok = 0, falhas = 0;
    for (const rec of pendentes) {
      setConvertendoId(rec.id);
      try {
        const total = await converterPdfExistente(rec.id);
        setRecords((prev) => prev.map((r) => (r.id === rec.id ? { ...r, pages: total } : r)));
        ok++;
      } catch { falhas++; }
    }
    setConvertendoId(null);
    showToast(falhas ? `${ok} convertido(s), ${falhas} falharam.` : `${ok} PDF(s) convertido(s).`, !!falhas);
  };

  const saveProfile = async () => {
    try { await apiPost("profile", { profile }); showToast("Dados do solicitante salvos."); }
    catch (e) { showToast(`Erro ao salvar: ${e.message}`, true); }
  };
  const savePresets = async () => {
    try { await apiPost("rateio", { presets }); showToast("Presets de rateio salvos."); }
    catch (e) { showToast(`Erro ao salvar: ${e.message}`, true); }
  };

  const enviarAssinatura = async (file) => {
    setEnviandoAssinatura(true);
    try {
      const { base64, mediaType, width, height } = await comprimirAssinatura(file);
      await apiPost("assinatura", { base64, mediaType, width, height });
      setTemAssinatura(true);
      setAssinaturaVersao((v) => v + 1);
      showToast("Assinatura salva.");
    } catch (e) {
      showToast(`Não foi possível salvar a assinatura: ${e.message}`, true);
    } finally { setEnviandoAssinatura(false); }
  };

  const removerAssinatura = async () => {
    if (!window.confirm("Remover a assinatura salva?")) return;
    try {
      await fetch(functionUrl("assinatura"), { method: "DELETE" });
      setTemAssinatura(false);
      showToast("Assinatura removida.");
    } catch (e) {
      showToast(`Erro ao remover: ${e.message}`, true);
    }
  };

  const nomeArquivoComprovante = (r, idx) => {
    const ext = r.mediaType === "image/png" ? "png" : "jpg";
    const base = `${String(idx + 1).padStart(2, "0")}-${(r.data || "").replace(/\//g, "-")}-${r.tipo || ""}`.replace(/[^\w.-]+/g, "_");
    return `${base}.${ext}`;
  };

  const baixarComprovanteOriginal = async (rec) => {
    try {
      const res = await fetch(fileUrl(rec.id));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await salvarArquivoComo(await res.blob(), rec.fileName || "comprovante");
    } catch (e) {
      showToast(`Erro ao baixar comprovante: ${e.message}`, true);
    }
  };

  const baixarComprovante = async (r, idx) => {
    if (!r.src) return;
    try {
      const res = await fetch(r.src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await salvarArquivoComo(await res.blob(), nomeArquivoComprovante(r, idx));
    } catch (e) {
      showToast(`Erro ao baixar comprovante: ${e.message}`, true);
    }
  };

  // Monta um .zip com todos os comprovantes disponíveis (pula os que não têm
  // pré-visualização). Devolve null se não houver nenhum arquivo pra incluir.
  const construirZipComprovantes = async () => {
    const arquivos = {};
    for (let i = 0; i < reportPages.length; i++) {
      const r = reportPages[i];
      if (!r.src) continue;
      const res = await fetch(r.src);
      if (!res.ok) continue;
      arquivos[nomeArquivoComprovante(r, i)] = new Uint8Array(await res.arrayBuffer());
    }
    if (Object.keys(arquivos).length === 0) return null;
    const zipBytes = window.fflate.zipSync(arquivos, { level: 6 });
    return new Blob([zipBytes], { type: "application/zip" });
  };

  const baixarTodosComprovantes = async () => {
    if (reportPages.length === 0) return;
    try {
      const blob = await construirZipComprovantes();
      if (!blob) { showToast("Nenhum comprovante disponível para baixar.", true); return; }
      await salvarArquivoComo(blob, "comprovantes.zip");
    } catch (e) {
      showToast(`Erro ao baixar comprovantes: ${e.message}`, true);
    }
  };

  const XLSX_NOMES = {
    "solicitacao-adiantamento": "solicitacao-adiantamento.xlsx",
    "prestacao-contas": "prestacao-contas-adiantamento.xlsx",
    "reembolso": "solicitacao-reembolso.xlsx",
  };
  const ZIP_NOMES = {
    "solicitacao-adiantamento": "solicitacao-adiantamento.zip",
    "prestacao-contas": "prestacao-contas.zip",
    "reembolso": "solicitacao-reembolso.zip",
  };
  const ROTULO_FORM = {
    "solicitacao-adiantamento": "Solicitação de adiantamento",
    "prestacao-contas": "Prestação de contas + imagens",
    "reembolso": "Solicitação de reembolso + imagens",
  };

  // Monta o corpo enviado ao gerador da planilha. Usado tanto pela prévia
  // quanto pelo download final, pra os dois verem exatamente o mesmo
  // formulário — se divergirem, a prévia deixa de valer como conferência.
  const corpoDoFormulario = (tipo) => {
    const isAdiantamentoReq = tipo === "solicitacao-adiantamento";
    const registros = isAdiantamentoReq ? [] : sorted.map(({ dateObj, ...resto }) => resto);
    return {
      tipo, profile, motivo, rateio: flattenRateio(rateio),
      valorAdiantamento: parseValorInput(valorAdiantamento),
      records: registros.map((r) => ({ data: r.data, tipo: r.tipo, obs: r.obs, valor: r.valor })),
      previsoes: isAdiantamentoReq ? previsoes.map((p) => ({ obs: p.obs, valor: parseValorInput(p.valor) })) : [],
    };
  };

  // Prévia em PDF, só para conferir antes de finalizar: gera a planilha,
  // converte em PDF e (fora do adiantamento) anexa as imagens dos
  // comprovantes. Não pede local para salvar e NÃO apaga nada — é a
  // diferença para baixarPlanilha.
  const previewRelatorio = async (tipo) => {
    const isAdiantamentoReq = tipo === "solicitacao-adiantamento";
    setGerandoPreview(tipo);
    try {
      const res = await fetch(functionUrl("generate-report"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpoDoFormulario(tipo)),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const xlsxBytes = new Uint8Array(await res.arrayBuffer());

      const paginas = isAdiantamentoReq ? [] : reportPages.map((r) => ({
        id: r.id, page: r.page, mediaType: r.mediaType, data: r.data, tipo: r.tipo, valor: r.valor, obs: r.obs,
      }));
      const resPdf = await fetch(functionUrl("generate-photo-report"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xlsxBase64: uint8ParaBase64(xlsxBytes), pages: paginas }),
      });
      if (!resPdf.ok) {
        const err = await resPdf.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resPdf.status}`);
      }
      // Aviso não-fatal (ex.: a página da planilha não pôde ser convertida)
      // vem em header, porque o corpo da resposta é o PDF binário.
      const aviso = resPdf.headers.get("X-Aviso");
      const url = URL.createObjectURL(await resPdf.blob());
      setPreviewPdf({ url, nome: ROTULO_FORM[tipo] });
      if (aviso) showToast(decodeURIComponent(aviso), true);
    } catch (e) {
      showToast(`Não foi possível gerar a prévia: ${e.message}`, true);
    } finally {
      setGerandoPreview(null);
    }
  };

  const fecharPreviewPdf = () => {
    if (previewPdf) URL.revokeObjectURL(previewPdf.url);
    setPreviewPdf(null);
  };

  const BotaoPreview = ({ tipo }) => (
    <button onClick={() => previewRelatorio(tipo)} disabled={!!gerandoPreview || gerando}
      title={`Ver prévia em PDF de ${ROTULO_FORM[tipo]} — não apaga nada`}
      className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
      {gerandoPreview === tipo
        ? <><LoaderIcon size={16} className="animate-spin" /> Gerando prévia…</>
        : <><FileTextIcon size={16} /> Prévia</>}
    </button>
  );

  // Gera a planilha oficial, o relatório fotográfico em PDF (quando cabe) e
  // as fotos dos comprovantes, empacota tudo num único .zip e deixa o
  // usuário escolher onde salvar — um só diálogo, pedido ANTES de gerar
  // qualquer coisa (ver pedirLocalParaSalvar). Zera a tabela/formulário no
  // fim. Nada fica arquivado no servidor — a empresa já controla os
  // relatórios gerados em outra ferramenta.
  const baixarPlanilha = async (tipo) => {
    if (tipo === "prestacao-contas" && parseValorInput(valorAdiantamento) <= 0) {
      showToast("Informe o valor que foi adiantado — a prestação de contas é sempre referente a um adiantamento.", true);
      return;
    }
    const isAdiantamentoReq = tipo === "solicitacao-adiantamento";
    const alvoZerado = isAdiantamentoReq
      ? `${previsoes.length} despesa(s) prevista(s)`
      : `${sorted.length} lançamento(s) da tabela de despesas`;
    if (!window.confirm(
      `Isso vai gerar e baixar o formulário, o relatório fotográfico e as fotos num .zip. ` +
      `Assim que terminar, ${alvoZerado} serão apagados (junto com motivo e rateio), para começar o próximo ciclo. Continuar?`
    )) return;

    // Pede o local de salvamento JÁ, antes de gerar qualquer coisa: a
    // geração (planilha + conversão em PDF + fotos) demora vários segundos,
    // e depois desse tempo o navegador não deixa mais abrir o diálogo nativo
    // como ação do usuário — cairia direto na pasta de Downloads sem avisar.
    const handle = await pedirLocalParaSalvar(ZIP_NOMES[tipo], "application/zip");

    setGerando(true);
    const registrosCompletos = isAdiantamentoReq ? [] : sorted.map(({ dateObj, ...resto }) => resto);
    const itensParaPlanilha = registrosCompletos.map((r) => ({ data: r.data, tipo: r.tipo, obs: r.obs, valor: r.valor }));
    const itensPrevisoes = isAdiantamentoReq ? previsoes.map((p) => ({ obs: p.obs, valor: parseValorInput(p.valor) })) : [];

    try {
      const res = await fetch(functionUrl("generate-report"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo, profile, motivo, rateio: flattenRateio(rateio),
          valorAdiantamento: parseValorInput(valorAdiantamento),
          records: itensParaPlanilha, previsoes: itensPrevisoes,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const xlsxBytes = new Uint8Array(await res.arrayBuffer());
      const arquivosZip = { [XLSX_NOMES[tipo]]: xlsxBytes };

      let temPdf = false;
      let avisoConversao = null;
      if (!isAdiantamentoReq && reportPages.length > 0) {
        try {
          const resPdf = await fetch(functionUrl("generate-photo-report"), {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              xlsxBase64: uint8ParaBase64(xlsxBytes),
              pages: reportPages.map((r) => ({ id: r.id, page: r.page, mediaType: r.mediaType, data: r.data, tipo: r.tipo, valor: r.valor, obs: r.obs })),
            }),
          });
          if (resPdf.ok) {
            const aviso = resPdf.headers.get("X-Aviso");
            if (aviso) avisoConversao = decodeURIComponent(aviso);
            arquivosZip[`relatorio-fotografico-${tipo}.pdf`] = new Uint8Array(await resPdf.arrayBuffer());
            temPdf = true;
          }
        } catch { /* o Excel já foi montado; o relatório em PDF fica só pendente */ }

        for (let i = 0; i < reportPages.length; i++) {
          const r = reportPages[i];
          if (!r.src) continue;
          try {
            const resImg = await fetch(r.src);
            if (resImg.ok) arquivosZip[`fotos/${nomeArquivoComprovante(r, i)}`] = new Uint8Array(await resImg.arrayBuffer());
          } catch { /* essa foto fica de fora do zip */ }
        }
      }

      const zipBytes = window.fflate.zipSync(arquivosZip, { level: 6 });
      await escreverArquivo(handle, new Blob([zipBytes], { type: "application/zip" }), ZIP_NOMES[tipo]);

      if (isAdiantamentoReq) {
        setPrevisoes([]);
        // O valor pedido na solicitação de adiantamento passa a preencher
        // sozinho o campo "valor que foi adiantado" da prestação de contas
        // (passo 2) — não precisa digitar de novo. Continua editável, caso
        // o valor realmente depositado seja diferente do pedido.
        setValorAdiantamento(formatValor(totalPrevisto));
      } else {
        setRecords([]);
      }
      setMotivo(""); setRateio([]);
      if (tipo === "prestacao-contas") setValorAdiantamento("");

      const precisaPdf = !isAdiantamentoReq && reportPages.length > 0;
      showToast(
        precisaPdf && !temPdf
          ? "Zip salvo, mas o relatório em PDF falhou — tente de novo pela aba Imagens."
          : avisoConversao || "Zip salvo com a planilha, o relatório e as fotos. Despesas zeradas para o próximo ciclo.",
        (precisaPdf && !temPdf) || !!avisoConversao
      );
    } catch (e) {
      showToast(`Erro ao gerar planilha: ${e.message}`, true);
    } finally { setGerando(false); }
  };

  // --- dados derivados ---
  const enriched = records.map((r) => ({ ...r, dateObj: parseDatePtBr(r.data) || new Date() }));
  const sorted = [...enriched].sort((a, b) => a.dateObj - b.dateObj);
  const weeksMap = new Map();
  for (const r of sorted) {
    const key = getMonday(r.dateObj).getTime();
    if (!weeksMap.has(key)) weeksMap.set(key, { monday: getMonday(r.dateObj), rows: [] });
    weeksMap.get(key).rows.push(r);
  }
  let cumulative = 0;
  const weeks = [...weeksMap.values()].sort((a, b) => a.monday - b.monday).map((w) => {
    const subtotal = w.rows.reduce((s, r) => s + r.valor, 0);
    cumulative += subtotal;
    const sunday = new Date(w.monday); sunday.setDate(sunday.getDate() + 6);
    return { ...w, subtotal, cumulative, label: `${formatDatePtBr(w.monday)} a ${formatDatePtBr(sunday)}` };
  });
  const totalGeral = weeks.reduce((s, w) => s + w.subtotal, 0);
  const reviewCount = records.filter((r) => r.status === "revisar").length;
  const reportRecords = sorted.filter((r) => r.hasFile);
  const pdfsPendentes = records.filter((r) => r.hasFile && r.mediaType === "application/pdf" && !(Number(r.pages) > 0));
  // Uma página do relatório por página de arquivo (PDFs de várias páginas viram várias páginas)
  const reportPages = [];
  reportRecords.forEach((r) => {
    const isPdf = r.mediaType === "application/pdf";
    const n = Number(r.pages) || 0;
    if (isPdf && n > 0) {
      for (let p = 1; p <= n; p++) reportPages.push({ ...r, src: previewUrl(r.id, p), page: p, totalPages: n });
    } else if (isPdf) {
      reportPages.push({ ...r, src: null, page: 1, totalPages: 1 });  // conversão indisponível
    } else {
      reportPages.push({ ...r, src: fileUrl(r.id), page: 1, totalPages: 1 });
    }
  });
  const totalPrevisto = previsoes.reduce((s, p) => s + parseValorInput(p.valor), 0);

  if (!CODIGO_USUARIO) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4 text-center">
        <form onSubmit={fazerLogin} className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 text-left shadow-sm">
          <h1 className="text-center font-display text-lg font-bold text-slate-800">Despesas de Viagem</h1>
          <p className="mt-1 text-center text-xs text-slate-500">Digite seu nome de usuário para entrar.</p>
          <div className="mt-4">
            <Field label="Usuário" value={loginNome} onChange={setLoginNome} placeholder="Seu nome" />
          </div>
          {loginErro && <p className="mt-2 text-xs text-red-600">{loginErro}</p>}
          <button type="submit" disabled={loginCarregando || !loginNome.trim()}
            className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            {loginCarregando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    );
  }

  const NavBtn = ({ id, children }) => (
    <button onClick={() => setView(id)}
      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-sm ${view === id ? "bg-amber-400 text-slate-900" : "text-slate-300 hover:bg-slate-800"}`}>
      {children}
    </button>
  );

  return (
    <div className="min-h-screen bg-stone-100 text-slate-800">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;600&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .font-mono-num { font-family: 'JetBrains Mono', monospace; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .report-page { page-break-after: always; }
          .report-page:last-child { page-break-after: auto; }
        }
      `}</style>

      <header className="no-print bg-slate-900 text-white">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-5">
          <div className="mb-3 flex justify-end">
            <button onClick={() => { localStorage.removeItem(CHAVE_CODIGO_LOCAL); location.reload(); }}
              title="Sair / trocar de usuário"
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition-colors hover:border-slate-500 hover:text-white">
              <UserIcon size={13} className="shrink-0" />
              <span className="truncate">{usuarioNome || "—"}</span>
            </button>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-display text-xs uppercase tracking-[0.2em] text-amber-400">FORM 189 · Grupo Tangipar</p>
              <h1 className="font-display text-2xl font-bold sm:text-3xl">Despesas de Viagem</h1>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-400">Total acumulado</p>
              <p className="font-mono-num text-2xl font-semibold text-amber-400 sm:text-3xl">{formatValor(totalGeral)}</p>
            </div>
          </div>
          <nav className="mt-4 flex flex-nowrap gap-0.5 sm:gap-1">
            <NavBtn id="tabela">Despesas</NavBtn>
            <NavBtn id="gerar">Formulários</NavBtn>
            <NavBtn id="relatorio">Imagens</NavBtn>
            <NavBtn id="perfil">Cadastros</NavBtn>
          </nav>
        </div>
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />
      </header>

      {versaoDesatualizada && (
        <div className="no-print flex flex-wrap items-center justify-center gap-3 bg-amber-400 px-4 py-2 text-center text-sm font-medium text-slate-900">
          <span>Uma nova versão deste aplicativo está disponível.</span>
          <button onClick={() => location.reload()} className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800">
            <RefreshIcon size={13} /> Atualizar agora
          </button>
        </div>
      )}

      {loadError && (
        <div className="no-print mx-auto max-w-5xl px-4 pt-4 sm:px-6">
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Não foi possível carregar os dados salvos ({loadError}).
          </div>
        </div>
      )}

      {/* ===================== TABELA ===================== */}
      {view === "tabela" && (
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <div ref={dropRef} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
            className="no-print flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-8 text-center transition-colors">
            <UploadIcon className="text-slate-400" size={28} />
            <p className="text-sm text-slate-600">Arraste recibos, notas fiscais ou cupons fiscais aqui, ou envie em lote</p>
            <p className="text-xs text-slate-400">Imagens (JPG, PNG) e PDF — os arquivos ficam guardados para o relatório</p>
            <button onClick={() => fileInputRef.current?.click()}
              className="mt-2 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              <UploadIcon size={16} /> Selecionar arquivos
            </button>
            <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf" onChange={onFileInputChange} className="hidden" />
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-display text-lg font-bold">Despesas por tipo</h2>
            <p className="mt-1 text-xs text-slate-500">Somatória de tudo que está na tabela de despesas agora.</p>
            <div className="mt-3">
              <GraficoPorTipo records={records} />
            </div>
          </div>

          {queue.length > 0 && (
            <div className="no-print mt-4 rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Leitura em lote {processing && <span className="text-amber-600">(processando…)</span>}
                </p>
                {!processing && <button onClick={() => setQueue([])} className="text-xs text-slate-400 hover:text-slate-600">Limpar lista</button>}
              </div>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {queue.map((q) => (
                  <li key={q.qid} className="flex items-center gap-2">
                    {q.status === "lendo" && <LoaderIcon className="animate-spin text-amber-500" size={14} />}
                    {q.status === "convertendo" && <LoaderIcon className="animate-spin text-sky-500" size={14} />}
                    {q.status === "pendente" && <LoaderIcon className="text-slate-300" size={14} />}
                    {q.status === "ok" && <CheckIcon className="text-emerald-600" size={14} />}
                    {q.status === "erro" && <AlertIcon className="text-red-600" size={14} />}
                    {q.status === "aviso" && <AlertIcon className="text-amber-500" size={14} />}
                    <span className="truncate text-slate-700">{q.name}</span>
                    {q.status === "convertendo" && <span className="text-xs text-sky-600">convertendo PDF {q.progresso || ""}</span>}
                    {q.status === "erro" && <span className="text-xs text-red-500">— {q.error}</span>}
                    {q.status === "aviso" && <span className="text-xs text-amber-600">— {q.error}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-3">
            {sorted.length > 0 && (
              <button
                onClick={() => setSelecionados(sorted.every((r) => selecionados.has(r.id)) ? new Set() : new Set(sorted.map((r) => r.id)))}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <CheckIcon size={15} /> {sorted.every((r) => selecionados.has(r.id)) ? "Desmarcar todas" : "Selecionar todas"}
              </button>
            )}
            {reviewCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                <AlertIcon size={13} /> {reviewCount} lançamento(s) a revisar
              </span>
            )}
          </div>

          {selecionados.size > 0 && (
            <div className="no-print mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
              <span className="text-sm text-red-900">{selecionados.size} lançamento(s) selecionado(s)</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setSelecionados(new Set())} className="text-xs font-medium text-slate-500 hover:text-slate-700">Limpar seleção</button>
                <button onClick={excluirSelecionados}
                  className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
                  <TrashIcon size={15} /> Excluir selecionados
                </button>
              </div>
            </div>
          )}

          {pdfsPendentes.length > 0 && (
            <div className="no-print mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2">
              <span className="text-sm text-sky-900">
                {pdfsPendentes.length} PDF(s) ainda sem imagem — necessário para a visualização e o relatório fotográfico.
              </span>
              <button onClick={converterTodos} disabled={!!convertendoId}
                className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50">
                {convertendoId ? "Convertendo…" : "Converter todos"}
              </button>
            </div>
          )}

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="no-print px-3 py-2">
                    <input type="checkbox" aria-label="Selecionar todos"
                      checked={sorted.length > 0 && sorted.every((r) => selecionados.has(r.id))}
                      onChange={() => setSelecionados((prev) =>
                        sorted.every((r) => prev.has(r.id)) ? new Set() : new Set(sorted.map((r) => r.id))
                      )} />
                  </th>
                  <th className="px-3 py-2">Data</th><th className="px-3 py-2">Tipo</th>
                  {/* No celular em retrato a coluna ficava com ~104px e
                      quebrava demais o histórico; min-w dobra a largura só
                      aí (a tabela já rola lateralmente nessa largura). */}
                  <th className="min-w-[208px] px-3 py-2 sm:min-w-0">Histórico</th><th className="px-3 py-2 text-right">Valor</th>
                  <th className="no-print px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {weeks.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-400">
                    Nenhum lançamento ainda. Envie comprovantes acima ou adicione manualmente.
                  </td></tr>
                )}
                {weeks.map((w) => (
                  <Fragment key={w.monday.getTime()}>
                    <tr><td colSpan={6} className="bg-slate-800 px-3 py-1.5 font-display text-xs uppercase tracking-wide text-amber-300">Semana de {w.label}</td></tr>
                    {w.rows.map((r) => {
                      const politicaLinha = politicaDoTipo(profile, r.tipo);
                      const limitePoliticaLinha = parseValorInput(politicaLinha.limite);
                      const overLimit = politicaLinha.ativo && limitePoliticaLinha > 0 && r.valor > limitePoliticaLinha;
                      if (editingId === r.id && editDraft) {
                        return <EditRow key={r.id} draft={editDraft} setDraft={setEditDraft} onSave={() => saveEdit(r.id)} onCancel={() => { setEditingId(null); setEditDraft(null); }} />;
                      }
                      return (
                        <tr key={r.id} className={`hover:bg-stone-50 ${selecionados.has(r.id) ? "bg-red-50" : ""}`}>
                          <td className="no-print px-3 py-2">
                            <input type="checkbox" checked={selecionados.has(r.id)} onChange={() => toggleSelecionado(r.id)} />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 font-mono-num">
                            <div className="flex items-center gap-1.5">
                              {r.status === "revisar" && <AlertIcon size={13} className="shrink-0 text-amber-500" />}
                              {r.data}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-block rounded border px-2 py-0.5 text-xs font-medium" style={estiloTipo(r.tipo)}>{r.tipo}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {r.obs || <span className="text-slate-300">—</span>}
                            {overLimit && <div className="mt-0.5 text-xs text-red-600">Acima do limite de {formatValor(limitePoliticaLinha)}</div>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-mono-num">{formatValor(r.valor)}</td>
                          <td className="no-print whitespace-nowrap px-3 py-2">
                            <div className="flex items-center gap-1">
                              {r.hasFile && <button onClick={() => setPreviewId(r.id)} title="Ver comprovante" className="rounded p-1.5 text-slate-500 hover:bg-slate-200"><EyeIcon size={15} /></button>}
                              <button onClick={() => startEdit(r)} title="Editar" className="rounded p-1.5 text-slate-500 hover:bg-slate-200"><PencilIcon size={15} /></button>
                              <button onClick={() => deleteRecord(r)} title="Excluir" className="rounded p-1.5 text-red-600 hover:bg-red-100"><TrashIcon size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-amber-400 bg-amber-50">
                      <td colSpan={4} className="px-3 py-1.5 text-xs font-semibold text-slate-700">Subtotal da semana</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono-num font-semibold">{formatValor(w.subtotal)}</td>
                      <td className="no-print"></td>
                    </tr>
                    <tr className="bg-stone-50 text-xs text-slate-500">
                      <td colSpan={4} className="px-3 py-1 text-right">Acumulado até {formatDatePtBr(new Date(w.monday.getTime() + 6 * 86400000))}</td>
                      <td className="whitespace-nowrap px-3 py-1 text-right font-mono-num">{formatValor(w.cumulative)}</td>
                      <td className="no-print"></td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
              {weeks.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 text-white">
                    <td colSpan={4} className="px-3 py-2.5 font-display text-sm font-semibold uppercase tracking-wide">Total acumulado</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono-num text-base font-bold text-amber-400">{formatValor(totalGeral)}</td>
                    <td className="no-print"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </main>
      )}

      {/* ===================== GERAR FORMULÁRIOS ===================== */}
      {view === "gerar" && (
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-display text-lg font-bold">Qual é o fluxo?</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button onClick={() => setFluxo("adiantamento")}
                className={`rounded-lg border-2 p-4 text-left transition-colors ${fluxo === "adiantamento" ? "border-amber-500 bg-amber-50" : "border-slate-200 hover:border-slate-300"}`}>
                <p className="font-display font-semibold">Com adiantamento</p>
                <p className="mt-1 text-xs text-slate-600">1. Solicitação de adiantamento (antes da viagem)<br />2. Prestação de contas + relatório em PDF</p>
              </button>
              <button onClick={() => setFluxo("reembolso")}
                className={`rounded-lg border-2 p-4 text-left transition-colors ${fluxo === "reembolso" ? "border-amber-500 bg-amber-50" : "border-slate-200 hover:border-slate-300"}`}>
                <p className="font-display font-semibold">Sem adiantamento</p>
                <p className="mt-1 text-xs text-slate-600">Solicitação de reembolso + relatório em PDF</p>
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <label className="block flex-1">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Motivo da solicitação</span>
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2}
                  placeholder="Ex.: CUSTOS DE REFEIÇÃO, ABASTECIMENTO DO VEÍCULO, GERADOR E RETROESCAVADEIRA DA OBRA, MATERIAIS NECESSÁRIOS PARA OBRA"
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" />
              </label>
            </div>

            <div className="mt-4">
              <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Rateio</span>
              <RateioEditor grupos={rateio} setGrupos={setRateio} />
            </div>
          </div>

          {fluxo === "adiantamento" ? (
            <>
              <div className="mt-4 rounded-lg border-2 border-slate-300 bg-white p-4">
                <p className="font-display text-sm font-bold uppercase tracking-wide text-slate-500">Passo 1 — Antes da viagem</p>
                <h3 className="font-display text-lg font-bold">Solicitação de adiantamento</h3>
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Despesas previstas (até 9)</span>
                    <button onClick={() => setPrevisoes([...previsoes, { obs: "", valor: "" }])} className="text-xs font-medium text-amber-700 hover:text-amber-900">+ item</button>
                  </div>
                  {previsoes.map((p, i) => (
                    <div key={i} className="mb-1.5 flex gap-1.5">
                      <input value={p.obs} onChange={(e) => setPrevisoes(previsoes.map((x, j) => j === i ? { ...x, obs: e.target.value } : x))} placeholder="Histórico da despesa prevista" className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm" />
                      <input value={p.valor} onChange={(e) => setPrevisoes(previsoes.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))}
                        onBlur={() => setPrevisoes((prev) => prev.map((x, j) => j === i ? { ...x, valor: formatValor(parseValorInput(x.valor)) } : x))}
                        placeholder="0,00" inputMode="decimal" className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-sm font-mono-num" />
                      <button onClick={() => setPrevisoes(previsoes.filter((_, j) => j !== i))} className="rounded p-1.5 text-red-600 hover:bg-red-100"><TrashIcon size={14} /></button>
                    </div>
                  ))}
                  <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm">
                    <span className="font-medium text-slate-600">Total do adiantamento</span>
                    <span className="font-mono-num font-semibold">{formatValor(totalPrevisto)}</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => baixarPlanilha("solicitacao-adiantamento")} disabled={gerando}
                    className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
                    <DownloadIcon size={16} /> Baixar solicitação de adiantamento
                  </button>
                  <BotaoPreview tipo="solicitacao-adiantamento" />
                </div>
              </div>

              <div className="mt-4 rounded-lg border-2 border-amber-400 bg-white p-4">
                <p className="font-display text-sm font-bold uppercase tracking-wide text-amber-600">Passo 2 — Depois da viagem</p>
                <h3 className="font-display text-lg font-bold">Prestação de contas</h3>
                <p className="mt-1 text-sm text-slate-600">Usa os {sorted.length} lançamento(s) da tabela de despesas (total {formatValor(totalGeral)}).</p>
                <div className="mt-3 max-w-xs rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Valor adiantado (pedido no passo 1)</span>
                    <span className="font-mono-num">{formatValor(parseValorInput(valorAdiantamento))}</span>
                  </div>
                  <div className={`mt-1.5 flex items-center justify-between border-t border-slate-200 pt-1.5 text-sm font-semibold ${(parseValorInput(valorAdiantamento) - totalGeral) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    <span>{(parseValorInput(valorAdiantamento) - totalGeral) >= 0 ? "Saldo a devolver" : "Saldo a reembolsar"}</span>
                    <span className="font-mono-num">{formatValor(Math.abs(parseValorInput(valorAdiantamento) - totalGeral))}</span>
                  </div>
                </div>
                {parseValorInput(valorAdiantamento) <= 0 && (
                  <p className="mt-1 text-xs text-amber-700">Nenhum valor de adiantamento encontrado — gere a solicitação de adiantamento (passo 1) primeiro.</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => baixarPlanilha("prestacao-contas")} disabled={gerando || parseValorInput(valorAdiantamento) <= 0}
                    className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
                    <DownloadIcon size={16} /> Baixar prestação de contas
                  </button>
                  <BotaoPreview tipo="prestacao-contas" />
                </div>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-lg border-2 border-amber-400 bg-white p-4">
              <p className="font-display text-sm font-bold uppercase tracking-wide text-amber-600">Sem adiantamento</p>
              <h3 className="font-display text-lg font-bold">Solicitação de reembolso</h3>
              <p className="mt-1 text-sm text-slate-600">Usa os {sorted.length} lançamento(s) da tabela de despesas (total {formatValor(totalGeral)}).</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => baixarPlanilha("reembolso")} disabled={gerando}
                  className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
                  <DownloadIcon size={16} /> Baixar solicitação de reembolso
                </button>
                <BotaoPreview tipo="reembolso" />
              </div>
            </div>
          )}

          {sorted.length > 90 && (
            <p className="mt-3 text-xs text-amber-700">
              Atenção: são {sorted.length} lançamentos e o maior modelo do formulário comporta 90. Divida em mais de uma solicitação.
            </p>
          )}

        </main>
      )}

      {/* ===================== CADASTROS ===================== */}
      {view === "perfil" && (
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-display text-lg font-bold">Dados do solicitante</h2>
            <p className="mt-1 text-xs text-slate-500">Preenchidos automaticamente em todos os formulários. Salve uma vez.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Empresa / Unidade" value={profile.empresaUnidade} onChange={(v) => setProfile({ ...profile, empresaUnidade: v })} className="sm:col-span-2" />
              <Field label="Departamento" value={profile.departamento} onChange={(v) => setProfile({ ...profile, departamento: v })} className="sm:col-span-2" />
              <Field label="Nome" value={profile.nome} onChange={(v) => setProfile({ ...profile, nome: v })} />
              <Field label="Cargo" value={profile.cargo} onChange={(v) => setProfile({ ...profile, cargo: v })} />
              <Field label="CPF / CNPJ" value={profile.cpf} onChange={(v) => setProfile({ ...profile, cpf: v })} />
              <Field label="Telefone" value={profile.telefone} onChange={(v) => setProfile({ ...profile, telefone: v })} />
              <Field label="Banco" value={profile.banco} onChange={(v) => setProfile({ ...profile, banco: v })} />
              <Field label="Agência" value={profile.agencia} onChange={(v) => setProfile({ ...profile, agencia: v })} />
              <Field label="Conta" value={profile.conta} onChange={(v) => setProfile({ ...profile, conta: v })} />
              <Field label="PIX" value={profile.pix} onChange={(v) => setProfile({ ...profile, pix: v })} />
            </div>
            <button onClick={saveProfile} className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              <CheckIcon size={16} /> Salvar dados do solicitante
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-display text-lg font-bold">Políticas</h2>
            <p className="mt-1 text-xs text-slate-500">Valor limite por lançamento, por tipo de despesa. Acima do limite, o app pede confirmação (ou correção) na hora de lançar.</p>
            <div className="mt-3 space-y-2">
              {TIPOS.map((tipo) => {
                const politica = politicaDoTipo(profile, tipo);
                return (
                  <div key={tipo} className="flex items-center gap-3 rounded border border-slate-200 px-3 py-2">
                    <button
                      type="button" role="switch" aria-checked={politica.ativo}
                      onClick={() => setProfile({ ...profile, politicas: { ...profile.politicas, [tipo]: { ...politica, ativo: !politica.ativo } } })}
                      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${politica.ativo ? "bg-amber-500" : "bg-slate-300"}`}>
                      {/* left-0.5 é obrigatório: sem ancorar à esquerda, o
                          navegador usa a posição estática, que num <button>
                          (text-align: center por padrão) cai no meio do
                          trilho e joga a bolinha para fora dele. */}
                      <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${politica.ativo ? "translate-x-4" : "translate-x-0"}`} />
                    </button>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-700" title={tipo}>{tipo}</span>
                    {politica.ativo ? (
                      <input
                        value={politica.limite}
                        onChange={(e) => setProfile({ ...profile, politicas: { ...profile.politicas, [tipo]: { ...politica, limite: e.target.value } } })}
                        onBlur={() => setProfile((prev) => {
                          const atual = politicaDoTipo(prev, tipo);
                          return { ...prev, politicas: { ...prev.politicas, [tipo]: { ...atual, limite: formatValor(parseValorInput(atual.limite)) } } };
                        })}
                        placeholder="0,00" inputMode="decimal"
                        className="w-24 shrink-0 rounded border border-slate-300 px-2 py-1 text-right text-sm font-mono-num sm:w-28" />
                    ) : (
                      <span className="shrink-0 text-xs text-slate-400">Sem limite</span>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={saveProfile} className="mt-4 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              <CheckIcon size={16} /> Salvar políticas
            </button>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-display text-lg font-bold">Assinatura</h2>
            <p className="mt-1 text-xs text-slate-500">Usada para preencher automaticamente o campo de assinatura nas planilhas oficiais.</p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-48 items-center justify-center rounded border border-dashed border-slate-300 bg-stone-50 p-2">
                {temAssinatura === false ? (
                  <span className="text-center text-xs text-slate-400">Nenhuma assinatura cadastrada</span>
                ) : (
                  <img
                    src={functionUrl("assinatura", `v=${assinaturaVersao}`)}
                    alt="Assinatura"
                    className="max-h-full max-w-full object-contain"
                    onLoad={() => setTemAssinatura(true)}
                    onError={() => setTemAssinatura(false)}
                  />
                )}
              </div>
              <div className="flex flex-col items-start gap-1.5">
                <button onClick={() => assinaturaInputRef.current?.click()} disabled={enviandoAssinatura}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  <UploadIcon size={15} /> {enviandoAssinatura ? "Enviando…" : (temAssinatura ? "Trocar assinatura" : "Selecionar assinatura")}
                </button>
                {temAssinatura && (
                  <button onClick={removerAssinatura} className="text-xs font-medium text-red-600 hover:text-red-800">Remover assinatura</button>
                )}
                <input ref={assinaturaInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarAssinatura(f); e.target.value = ""; }} />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-display text-lg font-bold">Presets de rateio</h2>
            <p className="mt-1 text-xs text-slate-500">Usinas, centros de custo e projetos usados com frequência. A soma dos percentuais dos projetos de cada centro de custo deve dar 100%.</p>
            <div className="mt-3">
              <RateioEditor grupos={presets} setGrupos={setPresets} />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={savePresets} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                <CheckIcon size={16} /> Salvar presets
              </button>
              <button onClick={() => { setRateio(presets); setView("gerar"); }} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Usar no formulário
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ===================== RELATÓRIO FOTOGRÁFICO ===================== */}
      {view === "relatorio" && (
        <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <div className="no-print mb-4 flex items-center justify-between">
            <button onClick={() => setView("tabela")} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <ArrowLeftIcon size={15} /> Voltar
            </button>
            {reportPages.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={baixarTodosComprovantes} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <DownloadIcon size={15} /> Baixar todos (.zip)
                </button>
                <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
                  <PrinterIcon size={15} /> Imprimir / salvar em PDF
                </button>
              </div>
            )}
          </div>

          {reportPages.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
              <FileTextIcon className="mx-auto mb-2 text-slate-300" size={28} />
              Nenhum comprovante arquivado ainda. Envie os arquivos na aba Despesas.
            </div>
          ) : (
            <div className="space-y-6">
              {reportPages.map((r, idx) => (
                <ReportPageCard key={`${r.id}-${r.page}`} r={r} idx={idx} total={reportPages.length} onBaixar={baixarComprovante} fileUrl={fileUrl} />
              ))}
            </div>
          )}
        </main>
      )}

      {previewId && (() => {
        const rec = records.find((r) => r.id === previewId);
        if (!rec) return null;
        const isPdf = rec.mediaType === "application/pdf";
        const total = isPdf ? (Number(rec.pages) || 0) : 1;
        return (
          <div className="no-print fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 p-4" onClick={() => setPreviewId(null)}>
            <div className="max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {isPdf && total === 0 ? (
                <div className="rounded-lg bg-white p-8 text-center text-sm text-slate-600">
                  <FileTextIcon className="mx-auto mb-2 text-slate-400" size={28} />
                  Este PDF ainda não foi convertido em imagem.
                  <div className="mt-3">
                    <button
                      onClick={() => converterAgora(rec)}
                      disabled={!!convertendoId}
                      className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
                      {convertendoId && String(convertendoId).startsWith(rec.id)
                        ? `Convertendo… ${String(convertendoId).split("|")[1] || ""}`
                        : "Converter agora"}
                    </button>
                  </div>
                  <div className="mt-3">
                    <a href={fileUrl(rec.id)} target="_blank" rel="noreferrer" className="text-amber-700 underline">Abrir o arquivo original</a>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">{rec.fileName}</div>
                </div>
              ) : isPdf ? (
                <div className="space-y-3">
                  {Array.from({ length: total }, (_, i) => (
                    <img key={i} src={previewUrl(rec.id, i + 1)} alt={`Página ${i + 1}`} className="max-w-full rounded bg-white shadow-lg" />
                  ))}
                </div>
              ) : (
                <img src={fileUrl(rec.id)} alt="Comprovante" className="max-h-[85vh] max-w-full rounded shadow-lg" />
              )}
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-white/80">
              <span>{rec.fileName}{isPdf && total > 1 ? ` · ${total} páginas` : ""}</span>
              <button onClick={() => baixarComprovanteOriginal(rec)} className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-1 hover:bg-white/20">
                <DownloadIcon size={13} /> Baixar
              </button>
            </div>
            <button onClick={() => setPreviewId(null)} className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-slate-700 hover:bg-white"><XIcon size={18} /></button>
          </div>
        );
      })()}

      {previewPdf && (
        <div className="no-print fixed inset-0 z-50 flex flex-col bg-black/70 p-3 sm:p-6" onClick={fecharPreviewPdf}>
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">Prévia — {previewPdf.nome}</p>
                <p className="text-xs text-slate-500">Só para conferir. Nada foi salvo nem apagado.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a href={previewPdf.url} target="_blank" rel="noreferrer"
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Abrir em nova aba
                </a>
                <button onClick={fecharPreviewPdf} title="Fechar" className="rounded p-1.5 text-slate-500 hover:bg-slate-100">
                  <XIcon size={18} />
                </button>
              </div>
            </div>
            {/* Alguns navegadores de celular não exibem PDF dentro de iframe;
                por isso o botão "Abrir em nova aba" fica sempre visível. */}
            <iframe src={previewPdf.url} title="Prévia do relatório" className="min-h-0 flex-1 bg-stone-100" />
          </div>
        </div>
      )}

      {avisoLimite && (() => {
        const rec = records.find((r) => r.id === avisoLimite.id);
        if (!rec) return null;
        const limite = parseValorInput(politicaDoTipo(profile, rec.tipo).limite);
        const comPessoas = TIPOS_COM_PESSOAS.includes(rec.tipo);
        return (
          <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertIcon size={20} />
                <h3 className="font-display text-base font-bold">Valor acima da política</h3>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {rec.tipo} de {rec.data} no valor de <span className="font-mono-num font-semibold">{formatValor(rec.valor)}</span> está
                acima da política de {formatValor(limite)} para {rec.tipo}.
                {comPessoas ? " Essa despesa inclui mais de uma pessoa?" : " Deseja manter o valor ou alterar para o valor da política?"}
              </p>
              {comPessoas ? (
                <>
                  <div className="mt-3 space-y-2">
                    <Field label="Quantas pessoas" value={avisoLimite.pessoas} onChange={(v) => setAvisoLimite({ ...avisoLimite, pessoas: v })} placeholder="Ex.: 3" />
                    <Field label="Nomes das pessoas" value={avisoLimite.nomes} onChange={(v) => setAvisoLimite({ ...avisoLimite, nomes: v })} placeholder="Ex.: João, Maria" />
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button onClick={() => confirmarAvisoLimite(false)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Não — ajustar para {formatValor(limite)}</button>
                    <button onClick={() => confirmarAvisoLimite(true)} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">Registrar pessoas</button>
                  </div>
                </>
              ) : (
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={manterAvisoLimite} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Manter valor</button>
                  <button onClick={corrigirAvisoLimite} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">Alterar para {formatValor(limite)}</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {toast && (
        <div className={`no-print fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md px-4 py-2 text-sm text-white shadow-lg ${toast.isError ? "bg-red-600" : "bg-slate-900"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
