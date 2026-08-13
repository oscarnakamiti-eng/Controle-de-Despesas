const { useState, useEffect, useRef, useCallback, Fragment } = React;

const TIPOS = ["Almoço", "Jantar", "Combustível", "Hospedagem", "Materiais e Serviços"];

const TIPO_STYLE = {
  "Almoço": "bg-amber-100 text-amber-800 border-amber-300",
  "Jantar": "bg-indigo-100 text-indigo-800 border-indigo-300",
  "Combustível": "bg-orange-100 text-orange-800 border-orange-300",
  "Hospedagem": "bg-teal-100 text-teal-800 border-teal-300",
  "Materiais e Serviços": "bg-slate-200 text-slate-800 border-slate-400",
};

// --- ícones (SVG simples, sem dependências externas) ---
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
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function formatValor(num) {
  const n = Number(num) || 0;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseValorInput(raw) {
  if (typeof raw === "number") return raw;
  let s = String(raw || "").trim();
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
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
function makeId() { return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

// --- chamadas às Netlify Functions ---
async function loadRecordsFromServer() {
  const res = await fetch("/.netlify/functions/records");
  if (!res.ok) throw new Error(`Falha ao carregar lançamentos (HTTP ${res.status})`);
  const data = await res.json();
  return data.records || [];
}
async function saveRecordsToServer(records) {
  await fetch("/.netlify/functions/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records }),
  });
}
async function callExtract(base64, mediaType, isPdf) {
  const res = await fetch("/.netlify/functions/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, mediaType, isPdf }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Falha na leitura (HTTP ${res.status})`);
  return data.parsed;
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
        <input value={draft.obs} onChange={(e) => setDraft({ ...draft, obs: e.target.value })}
          placeholder="Observações"
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" />
      </td>
      <td className="px-3 py-2 align-top">
        <input value={draft.valor} onChange={(e) => setDraft({ ...draft, valor: e.target.value })}
          placeholder="0,00" inputMode="decimal"
          className="w-28 rounded border border-slate-300 px-2 py-1 text-right text-sm font-mono-num focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" />
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex items-center gap-1">
          <button onClick={onSave} title="Salvar" className="rounded p-1.5 text-emerald-700 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"><CheckIcon size={16} /></button>
          <button onClick={onCancel} title="Cancelar" className="rounded p-1.5 text-slate-500 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"><XIcon size={16} /></button>
        </div>
      </td>
    </tr>
  );
}

function App() {
  const [records, setRecords] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [queue, setQueue] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newDraft, setNewDraft] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const recs = await loadRecordsFromServer();
        setRecords(recs);
      } catch (e) {
        setLoadError(String(e.message || e));
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const toStore = records.map(({ imageDataUrl, ...rest }) => rest);
    saveRecordsToServer(toStore).catch(() => {});
  }, [records, loaded]);

  const addRecordFromExtraction = useCallback((parsed, fileName, imageDataUrl) => {
    let needsReview = false;
    let dateObj = parseDatePtBr(parsed && parsed.data);
    if (!dateObj) { dateObj = new Date(); needsReview = true; }
    let tipo = parsed && parsed.tipo;
    if (!TIPOS.includes(tipo)) { tipo = "Materiais e Serviços"; needsReview = true; }
    let valor = Number(parsed && parsed.valor);
    if (isNaN(valor)) { valor = 0; needsReview = true; }
    const obs = (parsed && parsed.observacoes) || (needsReview ? "Confira os dados extraídos" : "");
    const record = {
      id: makeId(), data: formatDatePtBr(dateObj), tipo, obs, valor, fileName,
      imageDataUrl: imageDataUrl || null, status: needsReview ? "revisar" : "ok",
    };
    setRecords((prev) => [...prev, record]);
  }, []);

  const processFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const items = files.map((f) => ({ id: makeId(), name: f.name, status: "pendente" }));
    setQueue((prev) => [...prev, ...items]);
    setProcessing(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const qid = items[i].id;
      setQueue((prev) => prev.map((q) => (q.id === qid ? { ...q, status: "lendo" } : q)));
      try {
        const base64 = await fileToBase64(file);
        const isPdf = file.type === "application/pdf";
        const mediaType = file.type || "image/jpeg";
        const parsed = await callExtract(base64, mediaType, isPdf);
        const imageDataUrl = isPdf ? null : `data:${mediaType};base64,${base64}`;
        addRecordFromExtraction(parsed, file.name, imageDataUrl);
        setQueue((prev) => prev.map((q) => (q.id === qid ? { ...q, status: "ok" } : q)));
      } catch (err) {
        setQueue((prev) => prev.map((q) => (q.id === qid ? { ...q, status: "erro", error: String(err.message || err) } : q)));
      }
    }
    setProcessing(false);
  }, [addRecordFromExtraction]);

  const onFileInputChange = (e) => { processFiles(e.target.files); e.target.value = ""; };
  const onDrop = (e) => {
    e.preventDefault();
    dropRef.current && dropRef.current.classList.remove("border-amber-500", "bg-amber-50");
    processFiles(e.dataTransfer.files);
  };
  const onDragOver = (e) => { e.preventDefault(); dropRef.current && dropRef.current.classList.add("border-amber-500", "bg-amber-50"); };
  const onDragLeave = () => { dropRef.current && dropRef.current.classList.remove("border-amber-500", "bg-amber-50"); };

  const startEdit = (record) => {
    setEditingId(record.id);
    setEditDraft({ data: record.data, tipo: record.tipo, obs: record.obs, valor: formatValor(record.valor) });
  };
  const cancelEdit = () => { setEditingId(null); setEditDraft(null); };
  const saveEdit = (id) => {
    const dateObj = parseDatePtBr(editDraft.data);
    setRecords((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      return {
        ...r,
        data: dateObj ? formatDatePtBr(dateObj) : r.data,
        tipo: TIPOS.includes(editDraft.tipo) ? editDraft.tipo : r.tipo,
        obs: editDraft.obs,
        valor: parseValorInput(editDraft.valor),
        status: dateObj ? "ok" : "revisar",
      };
    }));
    setEditingId(null); setEditDraft(null);
  };
  const deleteRecord = (id) => {
    if (window.confirm("Excluir este lançamento? Esta ação não pode ser desfeita.")) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
    }
  };
  const startAddNew = () => { setAddingNew(true); setNewDraft({ data: formatDatePtBr(new Date()), tipo: TIPOS[0], obs: "", valor: "0,00" }); };
  const cancelAddNew = () => { setAddingNew(false); setNewDraft(null); };
  const saveAddNew = () => {
    const dateObj = parseDatePtBr(newDraft.data);
    const record = {
      id: makeId(), data: dateObj ? formatDatePtBr(dateObj) : formatDatePtBr(new Date()),
      tipo: TIPOS.includes(newDraft.tipo) ? newDraft.tipo : TIPOS[0], obs: newDraft.obs,
      valor: parseValorInput(newDraft.valor), fileName: null, imageDataUrl: null,
      status: dateObj ? "ok" : "revisar",
    };
    setRecords((prev) => [...prev, record]);
    setAddingNew(false); setNewDraft(null);
  };
  const clearQueue = () => setQueue([]);

  const enriched = records.map((r) => ({ ...r, dateObj: parseDatePtBr(r.data) || new Date() }));
  const sorted = [...enriched].sort((a, b) => a.dateObj - b.dateObj);
  const weeksMap = new Map();
  for (const r of sorted) {
    const monday = getMonday(r.dateObj);
    const key = monday.getTime();
    if (!weeksMap.has(key)) weeksMap.set(key, { monday, rows: [] });
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
  const reportRecords = enriched.filter((r) => r.imageDataUrl).sort((a, b) => a.dateObj - b.dateObj);

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
              <p className="font-display text-xs uppercase tracking-[0.2em] text-amber-400">Controle de campo</p>
              <h1 className="font-display text-2xl font-bold sm:text-3xl">Despesas de Comissionamento</h1>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-slate-400">Total acumulado</p>
              <p className="font-mono-num text-2xl font-semibold text-amber-400 sm:text-3xl">{formatValor(totalGeral)}</p>
            </div>
          </div>
        </div>
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />
      </header>

      {loadError && (
        <div className="no-print mx-auto max-w-5xl px-4 pt-4 sm:px-6">
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Não foi possível carregar os lançamentos salvos ({loadError}). Verifique se a função "records" e o Netlify Blobs estão funcionando.
          </div>
        </div>
      )}

      {!showReport ? (
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <div ref={dropRef} onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
            className="no-print flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 py-8 text-center transition-colors">
            <UploadIcon className="text-slate-400" size={28} />
            <p className="text-sm text-slate-600">Arraste recibos, notas fiscais ou cupons fiscais aqui, ou envie em lote</p>
            <p className="text-xs text-slate-400">Imagens (JPG, PNG) e PDF são aceitos</p>
            <button onClick={() => fileInputRef.current && fileInputRef.current.click()}
              className="mt-2 inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500">
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
                {!processing && <button onClick={clearQueue} className="text-xs text-slate-400 hover:text-slate-600">Limpar lista</button>}
              </div>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {queue.map((q) => (
                  <li key={q.id} className="flex items-center gap-2">
                    {q.status === "lendo" && <LoaderIcon className="animate-spin text-amber-500" size={14} />}
                    {q.status === "pendente" && <LoaderIcon className="text-slate-300" size={14} />}
                    {q.status === "ok" && <CheckIcon className="text-emerald-600" size={14} />}
                    {q.status === "erro" && <AlertIcon className="text-red-600" size={14} />}
                    <span className="truncate text-slate-700">{q.name}</span>
                    {q.status === "erro" && <span className="text-xs text-red-500">— {q.error}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={startAddNew} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500">
                <PlusIcon size={15} /> Adicionar lançamento
              </button>
              <button onClick={() => setShowReport(true)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500">
                <ImageIcon size={15} /> Relatório fotográfico
              </button>
            </div>
            {reviewCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                <AlertIcon size={13} /> {reviewCount} lançamento(s) a revisar
              </span>
            )}
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Observações</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="no-print px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {addingNew && newDraft && <EditRow draft={newDraft} setDraft={setNewDraft} onSave={saveAddNew} onCancel={cancelAddNew} />}
                {weeks.length === 0 && !addingNew && (
                  <tr><td colSpan={5} className="px-3 py-10 text-center text-sm text-slate-400">
                    Nenhum lançamento ainda. Envie comprovantes acima ou adicione manualmente.
                  </td></tr>
                )}
                {weeks.map((w) => (
                  <Fragment key={w.monday.getTime()}>
                    <tr><td colSpan={5} className="bg-slate-800 px-3 py-1.5 font-display text-xs uppercase tracking-wide text-amber-300">
                      Semana de {w.label}
                    </td></tr>
                    {w.rows.map((r) => {
                      const overLimit = (r.tipo === "Almoço" || r.tipo === "Jantar") && r.valor > 35;
                      if (editingId === r.id && editDraft) {
                        return <EditRow key={r.id} draft={editDraft} setDraft={setEditDraft} onSave={() => saveEdit(r.id)} onCancel={cancelEdit} />;
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
                              {r.imageDataUrl && (
                                <button onClick={() => setPreviewImage(r.imageDataUrl)} title="Ver comprovante" className="rounded p-1.5 text-slate-500 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"><EyeIcon size={15} /></button>
                              )}
                              <button onClick={() => startEdit(r)} title="Editar" className="rounded p-1.5 text-slate-500 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"><PencilIcon size={15} /></button>
                              <button onClick={() => deleteRecord(r.id)} title="Excluir" className="rounded p-1.5 text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"><TrashIcon size={15} /></button>
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

          <p className="no-print mt-3 text-xs text-slate-400">
            Os lançamentos ficam salvos no Netlify Blobs (compartilhado por quem acessar este site). O relatório
            fotográfico usa os arquivos enviados nesta sessão do navegador — se recarregar a página, reenvie os
            comprovantes para gerar o relatório novamente.
          </p>
        </main>
      ) : (
        <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <div className="no-print mb-4 flex items-center justify-between">
            <button onClick={() => setShowReport(false)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <ArrowLeftIcon size={15} /> Voltar à tabela
            </button>
            {reportRecords.length > 0 && (
              <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
                <PrinterIcon size={15} /> Imprimir / salvar em PDF
              </button>
            )}
          </div>

          {reportRecords.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
              <FileTextIcon className="mx-auto mb-2 text-slate-300" size={28} />
              Nenhuma imagem disponível nesta sessão. Envie os comprovantes na tela anterior para gerar o relatório fotográfico (um arquivo por página).
            </div>
          ) : (
            <div className="space-y-6">
              {reportRecords.map((r, idx) => (
                <div key={r.id} className="report-page rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2 text-xs text-slate-500">
                    <span>Página {idx + 1} de {reportRecords.length}</span>
                    <span className="font-mono-num">{r.data} · {r.tipo} · {formatValor(r.valor)}</span>
                  </div>
                  <img src={r.imageDataUrl} alt={r.fileName || "comprovante"} className="mx-auto max-h-[70vh] w-auto rounded" />
                  {r.obs && <p className="mt-3 text-sm text-slate-600">{r.obs}</p>}
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {previewImage && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Comprovante" className="max-h-[90vh] max-w-full rounded shadow-lg" />
          <button onClick={() => setPreviewImage(null)} className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-slate-700 hover:bg-white"><XIcon size={18} /></button>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
