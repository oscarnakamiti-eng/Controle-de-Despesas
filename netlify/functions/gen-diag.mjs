// Netlify Function (v2) — diagnóstico da geração de planilhas.
// Acesse: /.netlify/functions/gen-diag

import { unzipSync, zipSync } from "fflate";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const BASE_DIR = path.dirname(fileURLToPath(import.meta.url));

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json" } });
}

export default async () => {
  const d = { etapas: [], nodeVersion: process.version };
  const passo = (nome, ok, detalhe) => d.etapas.push({ nome, ok, detalhe });

  const dir = path.join(BASE_DIR, "templates");
  try {
    const arquivos = fs.readdirSync(dir);
    passo("Pasta templates encontrada", true, `${arquivos.length} arquivo(s)`);
    d.modelos = arquivos.length;
  } catch (err) {
    passo("Pasta templates encontrada", false, String(err.message || err));
    d.diagnostico = "Os modelos .xlsx não foram empacotados. Confira included_files no netlify.toml.";
    return json(d);
  }

  try {
    const alvo = "tpl_reembolso_30.xlsx";
    const bytes = fs.readFileSync(path.join(dir, alvo));
    const zip = unzipSync(new Uint8Array(bytes));
    passo("Modelo descompactado", true, `${Object.keys(zip).length} entradas`);

    const nomeSheet = Object.keys(zip).find((n) => n.startsWith("xl/worksheets/sheet") && n.endsWith(".xml"));
    let xml = new TextDecoder("utf-8").decode(zip[nomeSheet]);
    const marcadores = (xml.match(/@@/g) || []).length;
    passo("Marcadores encontrados", marcadores > 0, `${marcadores} ocorrência(s) em ${nomeSheet}`);

    xml = xml.replace(/<v>@@([A-Z]+\d+)@@<\/v>/g, "").replace(/@@([A-Z]+\d+)@@/g, "");
    zip[nomeSheet] = new TextEncoder().encode(xml);
    const saida = zipSync(zip, { level: 6 });
    passo("Planilha gerada", true, `${saida.length} bytes`);

    d.diagnostico = "Tudo funcionando.";
  } catch (err) {
    passo("Geração", false, String(err.message || err));
    d.stack = String(err.stack || "").split("\n").slice(0, 6);
    d.diagnostico = "Veja o campo stack acima.";
  }

  return json(d);
};
