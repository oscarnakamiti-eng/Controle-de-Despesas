// Netlify Function (v2) — chama a API da Anthropic server-side (chave secreta em
// ANTHROPIC_API_KEY) para extrair os dados do comprovante e, em caso de sucesso,
// guarda o arquivo original (imagem/PDF) no Netlify Blobs para uso posterior
// (preview, relatório fotográfico, reimpressão), mesmo depois de recarregar a página.

import { getStore } from "@netlify/blobs";
import { PDFDocument } from "pdf-lib";
import { resolverUsuario } from "./lib/usuarios.mjs";
import { chaveArquivo, chaveArquivoMeta } from "./files.mjs";

const EXTRACTION_PROMPT = `Analise o arquivo anexado (comprovante, recibo, nota fiscal ou cupom fiscal) e extraia as informações de cada gasto.

Este arquivo normalmente contém UM único comprovante. Mas às vezes alguém digitaliza várias notas fiscais DIFERENTES (números, CNPJs do emissor ou valores diferentes) juntas em um único PDF de várias páginas — nesse caso, identifique cada nota fiscal separadamente.

Responda APENAS com um array JSON puro, sem markdown, sem texto antes ou depois. Cada elemento do array representa UM lançamento, no formato exato:
{"data": "DD/MM/AAAA", "tipo": "Almoço" | "Jantar" | "Combustível" | "Hospedagem" | "Materiais e Serviços" | "Transporte", "valor": 0.00, "observacoes": "texto curto", "paginaInicio": 1, "paginaFim": 1}

Regras:
- Na grande maioria dos casos o arquivo tem só UM comprovante: responda um array com um único elemento, "paginaInicio": 1 e "paginaFim" igual ao total de páginas do arquivo.
- "paginaInicio" e "paginaFim" (1-based, inclusivos) indicam em que páginas do arquivo aquele comprovante específico aparece. Se o comprovante ocupar só uma página, os dois valores são iguais. Se o arquivo não for um PDF (uma única imagem), sempre use "paginaInicio": 1, "paginaFim": 1.
- Só crie elementos separados quando tiver certeza de que são notas fiscais/comprovantes DIFERENTES (número, CNPJ do emissor ou valor diferentes). Nunca separe as páginas de UM MESMO comprovante que só ocupa mais de uma página — nesse caso é um único elemento, com "paginaInicio"/"paginaFim" cobrindo todas as páginas dele.
- Os intervalos de página de todos os elementos, somados em ordem, devem cobrir o arquivo inteiro sem pular nem repetir nenhuma página.
- "tipo" deve ser exatamente um dos seis valores acima.
- Para Almoço ou Jantar: se houver horário no comprovante, até 16:00 é Almoço e após 16:00 é Jantar. Sem horário visível, use o contexto (nome do estabelecimento, itens consumidos).
- "Transporte" cobre passagem aérea, rodoviária, táxi e aplicativos de transporte (Uber, 99 etc.).
- Para "Materiais e Serviços" ou "Transporte", a "observacoes" deve descrever brevemente o que foi comprado ou contratado (ex.: trajeto, companhia, destino).
- "valor" é o valor TOTAL pago, como número decimal usando ponto (ex.: 1234.56), sem separador de milhares.
- "data" é a data da compra/consumo (não a data de emissão do relatório).
- Se algum campo não puder ser identificado com certeza, use null nesse campo.
- Não escreva nada além do array JSON.`;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Grava no Blob e confirma lendo de volta antes de devolver sucesso. Já
// aconteceu de store.set() não lançar erro mesmo assim o arquivo não ficar
// salvo de verdade (comprovante "perdido" em envios em lote) — em vez de só
// confiar que não deu erro, confere o tamanho gravado e tenta de novo antes
// de desistir.
async function gravarComConfirmacao(store, key, bytes, tentativas = 2) {
  for (let i = 0; i <= tentativas; i++) {
    await store.set(key, bytes);
    const conferido = await store.get(key, { type: "arrayBuffer" });
    if (conferido && conferido.byteLength === bytes.byteLength) return;
  }
  throw new Error("Não foi possível confirmar a gravação do arquivo nos Blobs após múltiplas tentativas.");
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  let userId;
  try { userId = await resolverUsuario(req); } catch (err) { return json({ error: err.message }, err.status || 403); }

  let payload;
  try { payload = await req.json(); } catch { return json({ error: "Corpo da requisição inválido" }, 400); }

  const { id, base64, mediaType, isPdf, fileName } = payload || {};
  if (!base64) return json({ error: "Arquivo (base64) ausente" }, 400);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: "ANTHROPIC_API_KEY não configurada nas variáveis de ambiente do site na Netlify." }, 500);
  }

  const contentBlock = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: base64 } };

  let anthropicRes;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        messages: [{ role: "user", content: [contentBlock, { type: "text", text: EXTRACTION_PROMPT }] }],
      }),
    });
  } catch (err) {
    return json({ error: `Falha ao contatar a API da Anthropic: ${String(err.message || err)}` }, 502);
  }

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text().catch(() => "");
    return json({ error: `Erro da API Anthropic (${anthropicRes.status}): ${errText}` }, 502);
  }

  const data = await anthropicRes.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  if (!textBlock) return json({ error: "Resposta vazia do modelo" }, 502);

  let clean = textBlock.text.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  let parsedBruto;
  try { parsedBruto = JSON.parse(clean); } catch { return json({ error: "Não foi possível interpretar a resposta do modelo como JSON" }, 502); }

  // Descobre o total de páginas do PDF (pdf-lib, já usado em
  // generate-photo-report.mjs) pra validar os intervalos que o modelo
  // devolveu — nunca confia cegamente neles, porque um intervalo errado
  // apagaria ou duplicaria uma página do comprovante de alguém.
  let totalPaginas = 1;
  if (isPdf) {
    try {
      const doc = await PDFDocument.load(Buffer.from(base64, "base64"), { ignoreEncryption: true });
      totalPaginas = doc.getPageCount() || 1;
    } catch { totalPaginas = 1; }
  }

  // Um arquivo normal (a grande maioria) tem só um comprovante — o modelo
  // devolve um array de 1 elemento. Um array com mais de um elemento só é
  // aceito como "arquivo consolidado com várias notas fiscais" (ver
  // EXTRACTION_PROMPT) se os intervalos de página cobrirem o arquivo inteiro,
  // em ordem, sem sobrepor nem pular página; qualquer inconsistência cai no
  // comportamento de sempre — um único lançamento cobrindo o arquivo todo,
  // usando os dados do primeiro elemento reconhecido.
  let itens = Array.isArray(parsedBruto) ? parsedBruto : [parsedBruto];
  if (!isPdf) itens = itens.slice(0, 1); // separar por página só faz sentido em PDF
  if (itens.length === 0) itens = [{}];

  itens = itens
    .map((it) => {
      const ini = Math.min(Math.max(1, Number(it && it.paginaInicio) || 1), totalPaginas);
      const fim = Math.min(Math.max(ini, Number(it && it.paginaFim) || ini), totalPaginas);
      return { ...it, paginaInicio: ini, paginaFim: fim };
    })
    .sort((a, b) => a.paginaInicio - b.paginaInicio);

  const intervalosValidos = itens[0].paginaInicio === 1
    && itens[itens.length - 1].paginaFim === totalPaginas
    && itens.every((it, i) => i === 0 || it.paginaInicio === itens[i - 1].paginaFim + 1);
  if (!intervalosValidos) {
    itens = [{ ...itens[0], paginaInicio: 1, paginaFim: totalPaginas }];
  }

  const dividido = itens.length > 1;

  // Guarda o arquivo original nos Blobs (preview / relatório fotográfico) só
  // quando NÃO houve separação — quando o arquivo vira vários lançamentos,
  // cada um guarda só as próprias páginas (o navegador converte em imagem,
  // como qualquer PDF); manter o arquivo consolidado inteiro anexado a um
  // dos lançamentos ia confundir o comprovante e o relatório fotográfico
  // de todos os outros.
  let fileStored = false;
  if (id && !dividido) {
    try {
      const store = getStore("expense-tracker", { consistency: "strong" });
      const bytes = Buffer.from(base64, "base64");
      await gravarComConfirmacao(store, chaveArquivo(userId, id), bytes);
      await store.setJSON(chaveArquivoMeta(userId, id), { mediaType: isPdf ? "application/pdf" : (mediaType || "image/jpeg"), fileName: fileName || null });
      fileStored = true;
    } catch (err) {
      // não falha a extração por causa disso — só avisa
      return json({ itens, fileStored: false, fileError: String(err.message || err), totalPaginas });
    }
  }

  return json({ itens, fileStored, totalPaginas });
};
