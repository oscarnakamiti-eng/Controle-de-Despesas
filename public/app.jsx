const { useState, useEffect, useRef, useCallback, Fragment } = React;

const TIPOS = ["Almoço", "Jantar", "Combustível", "Hospedagem", "Materiais e Serviços"];

const TIPO_STYLE = {
  "Almoço": "bg-amber-100 text-amber-800 border-amber-300",
  "Jantar": "bg-indigo-100 text-indigo-800 border-indigo-300",
  "Combustível": "bg-orange-100 text-orange-800 border-orange-300",
  "Hospedagem": "bg-teal-100 text-teal-800 border-teal-300",
  "Materiais e Serviços": "bg-slate-200 text-slate-800 border-slate-400",
};

const TIPO_LABEL = {
  "solicitacao-adiantamento": "Solicitação de adiantamento",
  "prestacao-contas": "Prestação de contas",
  "reembolso": "Solicitação de reembolso",
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
  const [addingNew, setAddingNew] = useState(false);
  const [newDraft, setNewDraft] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [toast, setToast] = useState(null);
  const [historico, setHistorico] = useState([]);
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

  const carregarHistorico = useCallback(async () => {
    try {
      const h = await apiGet("historico");
      setHistorico(h.items || []);
    } catch { /* histórico é auxiliar — falha aqui não bloqueia o app */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [r, p, rp] = await Promise.all([apiGet("records"), apiGet("profile"), apiGet("rateio")]);
        setRecords(r.records || []);
        setRecordsEtag(r.etag ?? null);
        setProfile(p.profile || {});
        setPresets(rp.presets || []);
        setRateio(rp.presets || []);
      } catch (e) {
        setLoadError(String(e.message || e));
      } finally { setLoaded(true); }
      carregarHistorico();
    })();
  }, [carregarHistorico]);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        const res = await fetch("/.netlify/functions/records", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records, etag: recordsEtag }),
        });
        if (res.status === 409) {
          showToast("Outra pessoa salvou alterações nesta tabela ao mesmo tempo. Recarregando os dados mais recentes — refaça sua última edição se precisar.", true);
          const fresh = await apiGet("records");
          setRecords(fresh.records || []);
          setRecordsEtag(fresh.etag ?? null);
          return;
        }
        const data = await parseJsonResponse(res);
        setRecordsEtag(data.etag ?? null);
      } catch (e) {
        showToast(`Falha ao salvar despesas: ${e.message}`, true);
      }
    })();
  }, [records, loaded]);

  const showToast = (msg, isError) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4000);
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
  const saveAddNew = () => {
    const d = parseDatePtBr(newDraft.data);
    setRecords((prev) => [...prev, {
      id: makeId(), data: d ? formatDatePtBr(d) : formatDatePtBr(new Date()),
      tipo: TIPOS.includes(newDraft.tipo) ? newDraft.tipo : TIPOS[0], obs: newDraft.obs,
      valor: parseValorInput(newDraft.valor), fileName: null, mediaType: null, hasFile: false,
      status: d ? "ok" : "revisar",
    }]);
    setAddingNew(false); setNewDraft(null);
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

  const baixarBlob = (blob, nome) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const XLSX_NOMES = {
    "solicitacao-adiantamento": "solicitacao-adiantamento.xlsx",
    "prestacao-contas": "prestacao-contas-adiantamento.xlsx",
    "reembolso": "solicitacao-reembolso.xlsx",
  };

  // Gera a planilha oficial (e o relatório fotográfico em PDF, quando cabe),
  // baixa os dois, arquiva ambos no histórico e zera a tabela/formulário
  // pra deixar pronto pro próximo ciclo.
  const baixarPlanilha = async (tipo) => {
    setGerando(true);
    const historyId = `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const isAdiantamentoReq = tipo === "solicitacao-adiantamento";
    const registrosCompletos = isAdiantamentoReq ? [] : sorted.map(({ dateObj, ...resto }) => resto);
    const itensParaPlanilha = registrosCompletos.map((r) => ({ data: r.data, tipo: r.tipo, obs: r.obs, valor: r.valor }));
    const itensPrevisoes = isAdiantamentoReq ? previsoes.map((p) => ({ obs: p.obs, valor: parseValorInput(p.valor) })) : [];

    try {
      const res = await fetch("/.netlify/functions/generate-report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo, profile, motivo, rateio,
          valorAdiantamento: parseValorInput(valorAdiantamento),
          records: itensParaPlanilha, previsoes: itensPrevisoes, historyId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      baixarBlob(await res.blob(), XLSX_NOMES[tipo]);

      let temPdf = false;
      if (!isAdiantamentoReq && reportPages.length > 0) {
        try {
          const resPdf = await fetch("/.netlify/functions/generate-photo-report", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              historyId,
              pages: reportPages.map((r) => ({ id: r.id, page: r.page, mediaType: r.mediaType, data: r.data, tipo: r.tipo, valor: r.valor, obs: r.obs })),
            }),
          });
          if (resPdf.ok) { baixarBlob(await resPdf.blob(), `relatorio-fotografico-${tipo}.pdf`); temPdf = true; }
        } catch { /* o Excel já foi gerado; o relatório em PDF fica só pendente */ }
      }

      const entradaHistorico = {
        id: historyId, criadoEm: new Date().toISOString(), tipo, motivo,
        valorAdiantamento: parseValorInput(valorAdiantamento), rateio,
        records: registrosCompletos, previsoes: itensPrevisoes, totalGeral,
        xlsxNome: XLSX_NOMES[tipo], temPdf,
      };
      await apiPost("historico", { ...entradaHistorico, historyId }).catch(() => {});
      // Atualiza a lista na hora (o índice nos Blobs pode levar alguns
      // segundos pra refletir a gravação numa releitura).
      setHistorico((prev) => [entradaHistorico, ...prev]);

      if (isAdiantamentoReq) setPrevisoes([]); else setRecords([]);
      setMotivo(""); setRateio([]);
      if (tipo === "prestacao-contas") setValorAdiantamento("");

      const precisaPdf = !isAdiantamentoReq && reportPages.length > 0;
      showToast(
        precisaPdf && !temPdf
          ? "Planilha gerada, mas o relatório em PDF falhou — tente de novo pela aba Histórico."
          : "Gerado e salvo no histórico. Despesas zeradas para o próximo ciclo.",
        precisaPdf && !temPdf
      );
    } catch (e) {
      showToast(`Erro ao gerar planilha: ${e.message}`, true);
    } finally { setGerando(false); }
  };

  const usarValoresDoHistorico = () => {
    if (historico.length === 0) { showToast("Nenhum histórico salvo ainda.", true); return; }
    const ultimo = historico[0];
    setMotivo(ultimo.motivo || "");
    setRateio(ultimo.rateio || []);
    setValorAdiantamento(ultimo.valorAdiantamento ? formatValor(ultimo.valorAdiantamento) : "");
    showToast("Motivo, valor e rateio da última geração recuperados.");
  };

  const reabrirHistorico = (item) => {
    if (!window.confirm("Isso substitui os dados atuais (tabela de despesas ou previsões, motivo e rateio) pelos deste histórico. Continuar?")) return;
    setMotivo(item.motivo || "");
    setRateio(item.rateio || []);
    setValorAdiantamento(item.valorAdiantamento ? formatValor(item.valorAdiantamento) : "");
    if (item.tipo === "solicitacao-adiantamento") {
      setPrevisoes((item.previsoes || []).map((p) => ({ obs: p.obs, valor: formatValor(p.valor) })));
    } else {
      setRecords(item.records || []);
    }
    setView("gerar");
    showToast("Dados do histórico carregados para edição.");
  };

  const excluirHistorico = async (item) => {
    if (!window.confirm("Excluir este item do histórico e os arquivos arquivados? Esta ação não pode ser desfeita.")) return;
    try {
      await fetch(`/.netlify/functions/historico?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      setHistorico((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e) {
      showToast(`Erro ao excluir: ${e.message}`, true);
    }
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

          <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => { setAddingNew(true); setNewDraft({ data: formatDatePtBr(new Date()), tipo: TIPOS[0], obs: "", valor: "0,00" }); }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <PlusIcon size={15} /> Adicionar lançamento
            </button>
            {reviewCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                <AlertIcon size={13} /> {reviewCount} lançamento(s) a revisar
              </span>
            )}
          </div>

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
                  <th className="px-3 py-2">Data</th><th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Histórico</th><th className="px-3 py-2 text-right">Valor</th>
                  <th className="no-print px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {addingNew && newDraft && <EditRow draft={newDraft} setDraft={setNewDraft} onSave={saveAddNew} onCancel={() => { setAddingNew(false); setNewDraft(null); }} />}
                {weeks.length === 0 && !addingNew && (
                  <tr><td colSpan={5} className="px-3 py-10 text-center text-sm text-slate-400">
                    Nenhum lançamento ainda. Envie comprovantes acima ou adicione manualmente.
                  </td></tr>
                )}
                {weeks.map((w) => (
                  <Fragment key={w.monday.getTime()}>
                    <tr><td colSpan={5} className="bg-slate-800 px-3 py-1.5 font-display text-xs uppercase tracking-wide text-amber-300">Semana de {w.label}</td></tr>
                    {w.rows.map((r) => {
                      const overLimit = (r.tipo === "Almoço" || r.tipo === "Jantar") && r.valor > 35;
                      if (editingId === r.id && editDraft) {
                        return <EditRow key={r.id} draft={editDraft} setDraft={setEditDraft} onSave={() => saveEdit(r.id)} onCancel={() => { setEditingId(null); setEditDraft(null); }} />;
                      }
                      return (
                        <tr key={r.id} className="hover:bg-stone-50">
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
                      <td colSpan={3} className="px-3 py-1.5 text-xs font-semibold text-slate-700">Subtotal da semana</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono-num font-semibold">{formatValor(w.subtotal)}</td>
                      <td className="no-print"></td>
                    </tr>
                    <tr className="bg-stone-50 text-xs text-slate-500">
                      <td colSpan={3} className="px-3 py-1 text-right">Acumulado até {formatDatePtBr(new Date(w.monday.getTime() + 6 * 86400000))}</td>
                      <td className="whitespace-nowrap px-3 py-1 text-right font-mono-num">{formatValor(w.cumulative)}</td>
                      <td className="no-print"></td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
              {weeks.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 text-white">
                    <td colSpan={3} className="px-3 py-2.5 font-display text-sm font-semibold uppercase tracking-wide">Total acumulado</td>
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
            {historico.length > 0 && (
              <button onClick={usarValoresDoHistorico} type="button"
                className="mt-1.5 text-xs font-medium text-amber-700 hover:text-amber-900">
                Usar motivo, valor e rateio da última geração
              </button>
            )}

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Rateio</span>
                <button onClick={() => setRateio([...rateio, { centroCusto: "", nCentroCusto: "", projeto: "", nProjeto: "", fase: "17", percentual: "" }])}
                  className="text-xs font-medium text-amber-700 hover:text-amber-900">+ linha</button>
              </div>
              {rateio.length === 0 && <p className="text-xs text-slate-400">Nenhuma linha. Cadastre presets em "Cadastros" ou adicione aqui.</p>}
              {rateio.map((r, i) => (
                <div key={i} className="mb-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-7">
                  <input value={r.centroCusto} onChange={(e) => setRateio(rateio.map((x, j) => j === i ? { ...x, centroCusto: e.target.value } : x))} placeholder="Centro de custo" className="col-span-2 rounded border border-slate-300 px-2 py-1 text-xs" />
                  <input value={r.nCentroCusto} onChange={(e) => setRateio(rateio.map((x, j) => j === i ? { ...x, nCentroCusto: e.target.value } : x))} placeholder="Nº CC" className="rounded border border-slate-300 px-2 py-1 text-xs" />
                  <input value={r.projeto} onChange={(e) => setRateio(rateio.map((x, j) => j === i ? { ...x, projeto: e.target.value } : x))} placeholder="Projeto" className="rounded border border-slate-300 px-2 py-1 text-xs" />
                  <input value={r.nProjeto} onChange={(e) => setRateio(rateio.map((x, j) => j === i ? { ...x, nProjeto: e.target.value } : x))} placeholder="Nº projeto" className="rounded border border-slate-300 px-2 py-1 text-xs" />
                  <input value={r.fase} onChange={(e) => setRateio(rateio.map((x, j) => j === i ? { ...x, fase: e.target.value } : x))} placeholder="Fase" className="rounded border border-slate-300 px-2 py-1 text-xs" />
                  <div className="flex gap-1">
                    <input value={r.percentual} onChange={(e) => setRateio(rateio.map((x, j) => j === i ? { ...x, percentual: e.target.value } : x))} placeholder="%" className="w-full rounded border border-slate-300 px-2 py-1 text-xs" />
                    <button onClick={() => setRateio(rateio.filter((_, j) => j !== i))} className="rounded p-1 text-red-600 hover:bg-red-100"><TrashIcon size={13} /></button>
                  </div>
                </div>
              ))}
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
                  <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Valor que foi adiantado</span>
                  <input value={valorAdiantamento} onChange={(e) => setValorAdiantamento(e.target.value)} placeholder="0,00" inputMode="decimal"
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-right text-sm font-mono-num" />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => baixarPlanilha("prestacao-contas")} disabled={gerando}
                    className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
                    <DownloadIcon size={16} /> Baixar prestação de contas
                  </button>
                  <button onClick={() => setView("relatorio")}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <ImageIcon size={16} /> Gerar relatório em PDF
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
                <button onClick={() => setView("relatorio")}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <ImageIcon size={16} /> Gerar relatório em PDF
                </button>
              </div>
            </div>
          )}

          {sorted.length > 90 && (
            <p className="mt-3 text-xs text-amber-700">
              Atenção: são {sorted.length} lançamentos e o maior modelo do formulário comporta 90. Divida em mais de uma solicitação.
            </p>
          )}

          {historico.length > 0 && (
            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="font-display text-lg font-bold">Histórico de gerações</h2>
              <p className="mt-1 text-xs text-slate-500">Planilhas e relatórios já gerados ficam arquivados aqui.</p>
              <ul className="mt-3 divide-y divide-slate-100">
                {historico.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{TIPO_LABEL[item.tipo] || item.tipo}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(item.criadoEm).toLocaleString("pt-BR")} · {formatValor(item.totalGeral)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <a href={`/.netlify/functions/historico?id=${encodeURIComponent(item.id)}&file=xlsx`}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Excel</a>
                      {item.temPdf && (
                        <a href={`/.netlify/functions/historico?id=${encodeURIComponent(item.id)}&file=pdf`}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">PDF</a>
                      )}
                      <button onClick={() => reabrirHistorico(item)}
                        className="rounded-md border border-amber-400 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100">Reabrir</button>
                      <button onClick={() => excluirHistorico(item)} title="Excluir"
                        className="rounded p-1.5 text-red-600 hover:bg-red-100"><TrashIcon size={14} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
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
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold">Presets de rateio</h2>
                <p className="mt-1 text-xs text-slate-500">Usinas, centros de custo e projetos usados com frequência.</p>
              </div>
              <button onClick={() => setPresets([...presets, { centroCusto: "", nCentroCusto: "", projeto: "", nProjeto: "", fase: "17", percentual: "" }])}
                className="text-xs font-medium text-amber-700 hover:text-amber-900">+ linha</button>
            </div>
            <div className="mt-3">
              {presets.map((r, i) => (
                <div key={i} className="mb-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-7">
                  <input value={r.centroCusto} onChange={(e) => setPresets(presets.map((x, j) => j === i ? { ...x, centroCusto: e.target.value } : x))} placeholder="Centro de custo" className="col-span-2 rounded border border-slate-300 px-2 py-1 text-xs" />
                  <input value={r.nCentroCusto} onChange={(e) => setPresets(presets.map((x, j) => j === i ? { ...x, nCentroCusto: e.target.value } : x))} placeholder="Nº CC" className="rounded border border-slate-300 px-2 py-1 text-xs" />
                  <input value={r.projeto} onChange={(e) => setPresets(presets.map((x, j) => j === i ? { ...x, projeto: e.target.value } : x))} placeholder="Projeto" className="rounded border border-slate-300 px-2 py-1 text-xs" />
                  <input value={r.nProjeto} onChange={(e) => setPresets(presets.map((x, j) => j === i ? { ...x, nProjeto: e.target.value } : x))} placeholder="Nº projeto" className="rounded border border-slate-300 px-2 py-1 text-xs" />
                  <input value={r.fase} onChange={(e) => setPresets(presets.map((x, j) => j === i ? { ...x, fase: e.target.value } : x))} placeholder="Fase" className="rounded border border-slate-300 px-2 py-1 text-xs" />
                  <div className="flex gap-1">
                    <input value={r.percentual} onChange={(e) => setPresets(presets.map((x, j) => j === i ? { ...x, percentual: e.target.value } : x))} placeholder="%" className="w-full rounded border border-slate-300 px-2 py-1 text-xs" />
                    <button onClick={() => setPresets(presets.filter((_, j) => j !== i))} className="rounded p-1 text-red-600 hover:bg-red-100"><TrashIcon size={13} /></button>
                  </div>
                </div>
              ))}
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
              <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
                <PrinterIcon size={15} /> Imprimir / salvar em PDF
              </button>
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
                <div key={`${r.id}-${r.page}`} className="report-page rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2 text-xs text-slate-500">
                    <span>
                      Página {idx + 1} de {reportPages.length}
                      {r.totalPages > 1 && <span className="ml-1 text-slate-400">(arquivo {r.page}/{r.totalPages})</span>}
                    </span>
                    <span className="font-mono-num">{r.data} · {r.tipo} · {formatValor(r.valor)}</span>
                  </div>
                  {r.src ? (
                    <img src={r.src} alt={r.fileName || "comprovante"} className="mx-auto max-h-[70vh] w-auto rounded" />
                  ) : (
                    <div className="rounded border border-slate-200 bg-stone-50 p-6 text-center text-sm text-slate-500">
                      <FileTextIcon className="mx-auto mb-2 text-slate-400" size={24} />
                      Não foi possível converter este PDF — <a href={fileUrl(r.id)} target="_blank" rel="noreferrer" className="text-amber-700 underline">abrir arquivo</a>
                      <div className="mt-1 text-xs text-slate-400">{r.fileName}</div>
                    </div>
                  )}
                  {r.obs && <p className="mt-3 text-sm text-slate-600">{r.obs}</p>}
                </div>
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
            <div className="mt-2 text-xs text-white/80">
              {rec.fileName}{isPdf && total > 1 ? ` · ${total} páginas` : ""}
            </div>
            <button onClick={() => setPreviewId(null)} className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-slate-700 hover:bg-white"><XIcon size={18} /></button>
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
