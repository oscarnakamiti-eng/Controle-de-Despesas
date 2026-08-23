const { useState, useEffect, useRef, useCallback, Fragment } = React;

const TIPOS = ["Almoço", "Jantar", "Combustível", "Hospedagem", "Materiais e Serviços"];

const TIPO_STYLE = {
  "Almoço": "bg-amber-100 text-amber-800 border-amber-300",
  "Jantar": "bg-indigo-100 text-indigo-800 border-indigo-300",
  "Combustível": "bg-orange-100 text-orange-800 border-orange-300",
  "Hospedagem": "bg-teal-100 text-teal-800 border-teal-300",
  "Materiais e Serviços": "bg-slate-200 text-slate-800 border-slate-400",
};

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
async function salvarArquivoComo(blob, nomeSugerido) {
  if (window.showSaveFilePicker) {
    try {
      const ext = "." + (nomeSugerido.split(".").pop() || "bin");
      const handle = await window.showSaveFilePicker({
        suggestedName: nomeSugerido,
        types: [{ description: "Arquivo", accept: { [blob.type || "application/octet-stream"]: [ext] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return; // usuário cancelou o diálogo
      // qualquer outro erro: segue para o download comum abaixo
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nomeSugerido;
  a.click();
  URL.revokeObjectURL(a.href);
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
function fileUrl(id) { return `/.netlify/functions/files?id=${encodeURIComponent(id)}`; }
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
    const res = await fetch("/.netlify/functions/upload-preview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, page: n, base64: jpeg }),
    });
    await parseJsonResponse(res);
  }
  return total;
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
  const res = await fetch(`/.netlify/functions/${fn}`);
  return parseJsonResponse(res);
}
async function apiPost(fn, payload) {
  const res = await fetch(`/.netlify/functions/${fn}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  return parseJsonResponse(res);
}
async function callExtract(id, base64, mediaType, isPdf, fileName) {
  const res = await fetch("/.netlify/functions/extract", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, base64, mediaType, isPdf, fileName }),
  });
  return parseJsonResponse(res);
}

// Converte um PDF que já está no servidor (lançamento antigo ou conversão que falhou)
async function converterPdfExistente(id, onProgress) {
  const res = await fetch(fileUrl(id));
  if (!res.ok) throw new Error(`Não foi possível baixar o arquivo (HTTP ${res.status})`);
  const buf = await res.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return converterPdfEmImagens(id, btoa(bin), onProgress);
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
        <input value={draft.valor} onChange={(e) => setDraft({ ...draft, valor: e.target.value })} placeholder="0,00" inputMode="decimal"
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
      {r.obs && <p className="mb-3 border-b border-slate-100 pb-2 text-sm text-slate-600">{r.obs}</p>}
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
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-500">
        <span>
          Página {idx + 1} de {total}
          {r.totalPages > 1 && <span className="ml-1 text-slate-400">(arquivo {r.page}/{r.totalPages})</span>}
        </span>
        <span className="flex items-center gap-2">
          <span className="font-mono-num">{r.data} · {r.tipo} · {formatValor(r.valor)}</span>
          {disponivel && (
            <button onClick={() => onBaixar(r, idx)} title="Baixar este comprovante" className="no-print rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <DownloadIcon size={14} />
            </button>
          )}
        </span>
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
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-6">
              <input value={g.centroCusto} onChange={(e) => updateGrupo(gi, "centroCusto", e.target.value)} placeholder="Centro de custo" className="col-span-2 rounded border border-slate-300 px-2 py-1 text-xs sm:col-span-4" />
              <input value={g.nCentroCusto} onChange={(e) => updateGrupo(gi, "nCentroCusto", e.target.value)} placeholder="Nº CC" className="rounded border border-slate-300 px-2 py-1 text-xs" />
              <button onClick={() => removeGrupo(gi)} title="Excluir centro de custo" className="flex items-center justify-center rounded p-1 text-red-600 hover:bg-red-100"><TrashIcon size={13} /></button>
            </div>
            <div className="mt-2 space-y-1.5 border-l-2 border-slate-100 pl-2">
              {projetos.map((p, pi) => (
                <div key={pi} className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                  <input value={p.projeto} onChange={(e) => updateProjeto(gi, pi, "projeto", e.target.value)} placeholder="Projeto" className="col-span-2 rounded border border-slate-300 px-2 py-1 text-xs" />
                  <input value={p.nProjeto} onChange={(e) => updateProjeto(gi, pi, "nProjeto", e.target.value)} placeholder="Nº projeto" className="rounded border border-slate-300 px-2 py-1 text-xs" />
                  <input value={p.fase} onChange={(e) => updateProjeto(gi, pi, "fase", e.target.value)} placeholder="Fase" className="rounded border border-slate-300 px-2 py-1 text-xs" />
                  <div className="flex gap-1">
                    <input value={p.percentual} onChange={(e) => updateProjeto(gi, pi, "percentual", e.target.value)} placeholder="%" className="w-full rounded border border-slate-300 px-2 py-1 text-xs" />
                    <button onClick={() => removeProjeto(gi, pi)} title="Excluir projeto" className="rounded p-1 text-red-600 hover:bg-red-100"><TrashIcon size={13} /></button>
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
  const [presets, setPresets] = useState([]);
  const [assinaturaVersao, setAssinaturaVersao] = useState(0);
  const [temAssinatura, setTemAssinatura] = useState(null); // null = ainda não sabe
  const [enviandoAssinatura, setEnviandoAssinatura] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
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

  // formulário de geração
  const [fluxo, setFluxo] = useState("reembolso"); // "adiantamento" | "reembolso"
  const [motivo, setMotivo] = useState("");
  const [valorAdiantamento, setValorAdiantamento] = useState("");
  const [rateio, setRateio] = useState([]);
  const [previsoes, setPrevisoes] = useState([]);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [r, p, rp, rc] = await Promise.all([apiGet("records"), apiGet("profile"), apiGet("rateio"), apiGet("rascunho")]);
        setRecords(r.records || []);
        setRecordsEtag(r.etag ?? null);
        setProfile(p.profile || {});
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

  const salvarRecords = useCallback(async () => {
    if (salvandoRef.current) { pendenteRef.current = true; return; }
    salvandoRef.current = true;
    try {
      do {
        pendenteRef.current = false;
        try {
          const res = await fetch("/.netlify/functions/records", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ records: recordsRef.current, etag: recordsEtagRef.current }),
          });
          if (res.status === 409) {
            // Não descarta a edição local: mescla por id em cima dos dados
            // mais recentes do servidor, preservando lançamentos que só
            // existem aqui (ex.: um comprovante que acabou de ser
            // processado) em vez de apagá-los por causa do conflito.
            const fresh = await apiGet("records");
            const idsFrescos = new Set((fresh.records || []).map((r) => r.id));
            const somenteLocais = recordsRef.current.filter((r) => !idsFrescos.has(r.id));
            const mesclado = somenteLocais.length > 0 ? [...(fresh.records || []), ...somenteLocais] : (fresh.records || []);
            recordsEtagRef.current = fresh.etag ?? null;
            setRecords(mesclado);
            setRecordsEtag(fresh.etag ?? null);
            if (somenteLocais.length > 0) {
              showToast(`Outra gravação aconteceu ao mesmo tempo — ${somenteLocais.length} lançamento(s) local(is) preservado(s) e mesclado(s).`);
              pendenteRef.current = true; // persiste a mesclagem
            } else {
              showToast("Outra pessoa salvou alterações nesta tabela ao mesmo tempo. Dados atualizados.", true);
              pendenteRef.current = false;
            }
          } else {
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

  const confirmarAvisoLimite = (incluirPessoas) => {
    if (incluirPessoas && avisoLimite.nomes.trim()) {
      const info = avisoLimite.pessoas
        ? `Refeição para ${avisoLimite.pessoas} pessoa(s): ${avisoLimite.nomes.trim()}`
        : `Também para: ${avisoLimite.nomes.trim()}`;
      setRecords((prev) => prev.map((r) =>
        r.id === avisoLimite.id ? { ...r, obs: r.obs ? `${r.obs} — ${info}` : info } : r
      ));
    }
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
        if ((tipo === "Almoço" || tipo === "Jantar") && valor > 35) {
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
  }, []);

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
      await fetch("/.netlify/functions/assinatura", { method: "DELETE" });
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

  // Gera a planilha oficial, o relatório fotográfico em PDF (quando cabe) e
  // as fotos dos comprovantes, empacota tudo num único .zip e deixa o
  // usuário escolher onde salvar — um só diálogo. Chamar salvarArquivoComo
  // várias vezes seguidas no mesmo clique não funciona de forma confiável:
  // o navegador só reconhece a primeira chamada como ação direta do
  // usuário e bloqueia silenciosamente as seguintes. Zera a tabela/
  // formulário no fim. Nada fica arquivado no servidor — a empresa já
  // controla os relatórios gerados em outra ferramenta.
  const baixarPlanilha = async (tipo) => {
    if (tipo === "prestacao-contas" && parseValorInput(valorAdiantamento) <= 0) {
      showToast("Informe o valor que foi adiantado — a prestação de contas é sempre referente a um adiantamento.", true);
      return;
    }
    setGerando(true);
    const isAdiantamentoReq = tipo === "solicitacao-adiantamento";
    const registrosCompletos = isAdiantamentoReq ? [] : sorted.map(({ dateObj, ...resto }) => resto);
    const itensParaPlanilha = registrosCompletos.map((r) => ({ data: r.data, tipo: r.tipo, obs: r.obs, valor: r.valor }));
    const itensPrevisoes = isAdiantamentoReq ? previsoes.map((p) => ({ obs: p.obs, valor: parseValorInput(p.valor) })) : [];

    try {
      const res = await fetch("/.netlify/functions/generate-report", {
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
      const arquivosZip = { [XLSX_NOMES[tipo]]: new Uint8Array(await res.arrayBuffer()) };

      let temPdf = false;
      if (!isAdiantamentoReq && reportPages.length > 0) {
        try {
          const resPdf = await fetch("/.netlify/functions/generate-photo-report", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pages: reportPages.map((r) => ({ id: r.id, page: r.page, mediaType: r.mediaType, data: r.data, tipo: r.tipo, valor: r.valor, obs: r.obs })),
            }),
          });
          if (resPdf.ok) {
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
      await salvarArquivoComo(new Blob([zipBytes], { type: "application/zip" }), ZIP_NOMES[tipo]);

      if (isAdiantamentoReq) setPrevisoes([]); else setRecords([]);
      setMotivo(""); setRateio([]);
      if (tipo === "prestacao-contas") setValorAdiantamento("");

      const precisaPdf = !isAdiantamentoReq && reportPages.length > 0;
      showToast(
        precisaPdf && !temPdf
          ? "Zip salvo, mas o relatório em PDF falhou — tente de novo pela aba Relatório fotográfico."
          : "Zip salvo com a planilha, o relatório e as fotos. Despesas zeradas para o próximo ciclo.",
        precisaPdf && !temPdf
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

  const NavBtn = ({ id, children }) => (
    <button onClick={() => setView(id)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === id ? "bg-amber-400 text-slate-900" : "text-slate-300 hover:bg-slate-800"}`}>
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
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
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
          <nav className="mt-4 flex flex-wrap gap-1">
            <NavBtn id="tabela">Despesas</NavBtn>
            <NavBtn id="gerar">Gerar formulários</NavBtn>
            <NavBtn id="relatorio">Relatório fotográfico</NavBtn>
            <NavBtn id="perfil">Cadastros</NavBtn>
          </nav>
        </div>
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />
      </header>

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

          <div className="no-print mt-4 flex flex-wrap items-center justify-end gap-3">
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
                  <th className="px-3 py-2">Histórico</th><th className="px-3 py-2 text-right">Valor</th>
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
                      const overLimit = (r.tipo === "Almoço" || r.tipo === "Jantar") && r.valor > 35;
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
                            <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${TIPO_STYLE[r.tipo] || "bg-slate-100 text-slate-700 border-slate-300"}`}>{r.tipo}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {r.obs || <span className="text-slate-300">—</span>}
                            {overLimit && <div className="mt-0.5 text-xs text-red-600">Acima do limite de 35,00</div>}
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
                      <input value={p.valor} onChange={(e) => setPrevisoes(previsoes.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))} placeholder="0,00" inputMode="decimal" className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-sm font-mono-num" />
                      <button onClick={() => setPrevisoes(previsoes.filter((_, j) => j !== i))} className="rounded p-1.5 text-red-600 hover:bg-red-100"><TrashIcon size={14} /></button>
                    </div>
                  ))}
                  <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm">
                    <span className="font-medium text-slate-600">Total do adiantamento</span>
                    <span className="font-mono-num font-semibold">{formatValor(totalPrevisto)}</span>
                  </div>
                </div>
                <button onClick={() => baixarPlanilha("solicitacao-adiantamento")} disabled={gerando}
                  className="mt-3 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
                  <DownloadIcon size={16} /> Baixar solicitação de adiantamento
                </button>
              </div>

              <div className="mt-4 rounded-lg border-2 border-amber-400 bg-white p-4">
                <p className="font-display text-sm font-bold uppercase tracking-wide text-amber-600">Passo 2 — Depois da viagem</p>
                <h3 className="font-display text-lg font-bold">Prestação de contas</h3>
                <p className="mt-1 text-sm text-slate-600">Usa os {sorted.length} lançamento(s) da tabela de despesas (total {formatValor(totalGeral)}).</p>
                <label className="mt-3 block max-w-xs">
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Valor que foi adiantado *</span>
                  <input value={valorAdiantamento} onChange={(e) => setValorAdiantamento(e.target.value)} placeholder="0,00" inputMode="decimal"
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-right text-sm font-mono-num" />
                </label>
                {parseValorInput(valorAdiantamento) <= 0 && (
                  <p className="mt-1 text-xs text-amber-700">Obrigatório — a prestação de contas é sempre referente a um adiantamento.</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => baixarPlanilha("prestacao-contas")} disabled={gerando || parseValorInput(valorAdiantamento) <= 0}
                    className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
                    <DownloadIcon size={16} /> Baixar prestação de contas
                  </button>
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
            <h2 className="font-display text-lg font-bold">Assinatura</h2>
            <p className="mt-1 text-xs text-slate-500">Usada para preencher automaticamente o campo de assinatura nas planilhas oficiais.</p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-48 items-center justify-center rounded border border-dashed border-slate-300 bg-stone-50 p-2">
                {temAssinatura === false ? (
                  <span className="text-center text-xs text-slate-400">Nenhuma assinatura cadastrada</span>
                ) : (
                  <img
                    src={`/.netlify/functions/assinatura?v=${assinaturaVersao}`}
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

      {avisoLimite && (() => {
        const rec = records.find((r) => r.id === avisoLimite.id);
        if (!rec) return null;
        return (
          <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertIcon size={20} />
                <h3 className="font-display text-base font-bold">Valor acima do limite</h3>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {rec.tipo} de {rec.data} no valor de <span className="font-mono-num font-semibold">{formatValor(rec.valor)}</span> está
                acima do limite de R$ 35,00. Essa despesa inclui mais de uma pessoa?
              </p>
              <div className="mt-3 space-y-2">
                <Field label="Quantas pessoas" value={avisoLimite.pessoas} onChange={(v) => setAvisoLimite({ ...avisoLimite, pessoas: v })} placeholder="Ex.: 3" />
                <Field label="Nomes das pessoas" value={avisoLimite.nomes} onChange={(v) => setAvisoLimite({ ...avisoLimite, nomes: v })} placeholder="Ex.: João, Maria" />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => confirmarAvisoLimite(false)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Não, é só isso</button>
                <button onClick={() => confirmarAvisoLimite(true)} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">Registrar pessoas</button>
              </div>
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
