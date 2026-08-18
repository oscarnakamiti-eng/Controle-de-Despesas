// Netlify Function (v2) — diagnóstico da geração de planilhas.
// Acesse: /.netlify/functions/gen-diag
// Verifica, em etapas, o que está falhando: carga do ExcelJS, presença dos
// modelos .xlsx no pacote da função, leitura e escrita de um arquivo.

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// não declarar __dirname: o runtime da Netlify já o define e a redeclaração quebra a função
const BASE_DIR = path.dirname(fileURLToPath(import.meta.url));

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json" } });
}

export default async () => {
  const d = { etapas: [] };
  const passo = (nome, ok, detalhe) => d.etapas.push({ nome, ok, detalhe });

  // 1) Node e diretório
  d.nodeVersion = process.version;
  d.dirname = BASE_DIR;

  // 2) Pasta de modelos
  const dir = path.join(BASE_DIR, "templates");
  try {
    const arquivos = fs.readdirSync(dir);
    passo("Pasta templates encontrada", true, `${arquivos.length} arquivo(s)`);
    d.modelos = arquivos.map((f) => {
      try { return { arquivo: f, bytes: fs.statSync(path.join(dir, f)).size }; }
      catch { return { arquivo: f, bytes: null }; }
    });
  } catch (err) {
    passo("Pasta templates encontrada", false, String(err.message || err));
    d.diagnostico = "Os modelos .xlsx não foram empacotados com a função. Confirme que netlify.toml tem included_files = [\"netlify/functions/templates/**\"] e que a pasta existe no repositório.";
    return json(d);
  }

  // 3) Carga do ExcelJS
  let ExcelJS;
  try {
    ExcelJS = (await import("exceljs")).default;
    passo("ExcelJS carregado", true, typeof ExcelJS);
  } catch (err) {
    passo("ExcelJS carregado", false, String(err.message || err));
    d.diagnostico = "O pacote exceljs não foi instalado/empacotado. Confirme que ele está em dependencies no package.json da raiz do repositório e refaça o deploy.";
    return json(d);
  }

  // 4) Leitura de um modelo
  const alvo = "tpl_reembolso_30.xlsx";
  const caminho = path.join(dir, alvo);
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(caminho);
    const ws = wb.getWorksheet("FORM 189") || wb.worksheets[0];
    passo("Modelo lido", true, `aba "${ws && ws.name}", ${ws ? ws.rowCount : 0} linhas`);

    // 5) Logomarca
    try {
      const imageId = wb.addImage({ filename: path.join(dir, "logo.jpg"), extension: "jpeg" });
      ws.addImage(imageId, { tl: { col: 0.09, row: 1.09 }, ext: { width: 199, height: 41 }, editAs: "oneCell" });
      passo("Logomarca inserida", true, "logo.jpg");
    } catch (e) {
      passo("Logomarca inserida", false, String(e.message || e));
    }

    // 6) Escrita
    ws.getCell("C8").value = "TESTE";
    const buf = await wb.xlsx.writeBuffer();
    passo("Planilha gerada", true, `${buf.byteLength} bytes`);
    d.diagnostico = "Tudo funcionando. Se o app ainda der 502, veja Deploys → Function logs → generate-report para a mensagem real.";
  } catch (err) {
    passo("Leitura/escrita do modelo", false, String(err.message || err));
    d.stack = String(err.stack || "").split("\n").slice(0, 6);
    d.diagnostico = `Falha ao manipular ${alvo}. Veja o campo stack acima.`;
  }

  return json(d);
};
