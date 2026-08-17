// Netlify Function (v2) — a tabela de despesas fica salva como .xlsx real
// no Netlify Blobs (store "expense-tracker", chave "despesas.xlsx").
// GET  -> lê o .xlsx salvo e devolve { records: [...] }
// POST -> recebe { records: [...] }, monta a planilha e substitui o arquivo salvo

import { getStore } from "@netlify/blobs";
import * as XLSX from "xlsx";

const FILE_KEY = "despesas.xlsx";
const HEADERS = ["ID", "Data", "Tipo", "Observações", "Valor", "Status", "Arquivo", "MediaType", "TemArquivo"];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function workbookBufferToRecords(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows
    .map((row) => ({
      id: String(row.ID || ""),
      data: String(row.Data || ""),
      tipo: String(row.Tipo || ""),
      obs: String(row["Observações"] || ""),
      valor: Number(row.Valor) || 0,
      status: String(row.Status || "ok"),
      fileName: row.Arquivo || null,
      mediaType: row.MediaType || null,
      hasFile: String(row.TemArquivo) === "1" || row.TemArquivo === true,
    }))
    .filter((r) => r.id);
}

function recordsToWorkbookBuffer(records) {
  const rows = records.map((r) => ({
    ID: r.id,
    Data: r.data,
    Tipo: r.tipo,
    "Observações": r.obs || "",
    Valor: Number(r.valor) || 0,
    Status: r.status || "ok",
    Arquivo: r.fileName || "",
    MediaType: r.mediaType || "",
    TemArquivo: r.hasFile ? 1 : 0,
  }));
  const sheet = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
  if (sheet["!ref"]) {
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const valorCol = HEADERS.indexOf("Valor");
    for (let r = 1; r <= range.e.r; r++) {
      const cellRef = XLSX.utils.encode_cell({ r, c: valorCol });
      if (sheet[cellRef]) sheet[cellRef].z = "#.##0,00";
    }
  }
  sheet["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 20 }, { wch: 42 }, { wch: 14 }, { wch: 10 }, { wch: 26 }, { wch: 16 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Despesas");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

export default async (req) => {
  const store = getStore("expense-tracker");

  if (req.method === "GET") {
    try {
      const buffer = await store.get(FILE_KEY, { type: "arrayBuffer" });
      if (!buffer) return json({ records: [] });
      const records = workbookBufferToRecords(Buffer.from(buffer));
      return json({ records });
    } catch (err) {
      return json({ error: `Falha ao ler a planilha: ${String(err.message || err)}` }, 500);
    }
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Corpo da requisição inválido" }, 400); }
    const records = Array.isArray(body.records) ? body.records : [];
    try {
      const buffer = recordsToWorkbookBuffer(records);
      await store.set(FILE_KEY, buffer);
      return json({ ok: true, count: records.length });
    } catch (err) {
      return json({ error: `Falha ao gravar a planilha: ${String(err.message || err)}` }, 500);
    }
  }

  return json({ error: "Método não permitido" }, 405);
};
