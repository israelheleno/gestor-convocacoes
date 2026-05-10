// ocr-engine.js
// Motor de leitura de imagens usando Tesseract.js (roda no browser, sem custo de servidor)

export async function lerConvocacao(imagemFile, onProgress) {
  // Carrega Tesseract via CDN
  const { createWorker } = Tesseract;

  const worker = await createWorker('por', 1, {
    logger: m => {
      if (onProgress && m.status === 'recognizing text') {
        onProgress(Math.round(m.progress * 100));
      }
    }
  });

  const imageUrl = URL.createObjectURL(imagemFile);
  const { data: { text } } = await worker.recognize(imageUrl);
  await worker.terminate();
  URL.revokeObjectURL(imageUrl);

  return extrairDados(text);
}

function extrairDados(texto) {
  const resultado = {
    textoOriginal: texto,
    data_hora: null,
    titulo_evento: null,
    local: null,
    convocados: [],
    id_verificacao: null,
    erros: []
  };

  // ── Data e Hora ──────────────────────────────────────────────────
  // Padrões: "14 de maio de 2026" / "14/05/2026" / "14-05-2026"
  const meses = {
    janeiro:1, fevereiro:2, março:3, marco:3, abril:4, maio:5,
    junho:6, julho:7, agosto:8, setembro:9, outubro:10,
    novembro:11, dezembro:12
  };

  let dataEncontrada = null;
  let horaEncontrada = null;

  // Formato extenso: "Para o dia 14 de maio de 2026"
  const regexDataExtensa = /(\d{1,2})\s+de\s+([a-záéíóúãõç]+)\s+de\s+(\d{4})/i;
  const matchData = texto.match(regexDataExtensa);
  if (matchData) {
    const dia = matchData[1].padStart(2,'0');
    const mesNome = matchData[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    const ano = matchData[3];
    const mesNum = meses[mesNome] || meses[matchData[2].toLowerCase()];
    if (mesNum) {
      dataEncontrada = `${ano}-${String(mesNum).padStart(2,'0')}-${dia}`;
    }
  }

  // Formato numérico como fallback: dd/mm/aaaa
  if (!dataEncontrada) {
    const regexDataNum = /(\d{2})\/(\d{2})\/(\d{4})/;
    const m = texto.match(regexDataNum);
    if (m) dataEncontrada = `${m[3]}-${m[2]}-${m[1]}`;
  }

  // Hora: "às 15h" / "15:00" / "15h30"
  const regexHora = /(?:às|as)\s*(\d{1,2})h(\d{0,2})|(\d{1,2}):(\d{2})\s*h?/i;
  const matchHora = texto.match(regexHora);
  if (matchHora) {
    if (matchHora[1]) {
      const h = matchHora[1].padStart(2,'0');
      const m = (matchHora[2] || '00').padStart(2,'0');
      horaEncontrada = `${h}:${m}`;
    } else if (matchHora[3]) {
      horaEncontrada = `${matchHora[3].padStart(2,'0')}:${matchHora[4]}`;
    }
  }

  if (dataEncontrada && horaEncontrada) {
    resultado.data_hora = `${dataEncontrada}T${horaEncontrada}:00`;
  } else if (dataEncontrada) {
    resultado.data_hora = `${dataEncontrada}T00:00:00`;
    resultado.erros.push('Hora não identificada');
  } else {
    resultado.erros.push('Data não identificada');
  }

  // ── Tema / Título do Evento ──────────────────────────────────────
  // Busca padrão "tema" ou conteúdo entre aspas ou após "reunião"
  const regexTema = /tema\s+["""]([^"""]+)["""]/i;
  const matchTema = texto.match(regexTema);
  if (matchTema) {
    resultado.titulo_evento = matchTema[1].trim().substring(0, 80);
  } else {
    // Fallback: pega linha com "reunião" ou "sessão"
    const linhas = texto.split('\n');
    for (const linha of linhas) {
      if (/reuni[aã]o|sess[aã]o|audi[eê]ncia/i.test(linha)) {
        resultado.titulo_evento = linha.trim().substring(0, 80);
        break;
      }
    }
  }

  if (!resultado.titulo_evento) resultado.erros.push('Título do evento não identificado');

  // ── Local ────────────────────────────────────────────────────────
  const regexLocal = /local[:\s]+([^\n]+)/i;
  const matchLocal = texto.match(regexLocal);
  if (matchLocal) resultado.local = matchLocal[1].trim();

  // ── Extração de Nomes da Tabela ──────────────────────────────────
  resultado.convocados = extrairNomesDaTabela(texto);

  // ── ID de Verificação Anti-Duplicidade ──────────────────────────
  if (dataEncontrada && horaEncontrada && resultado.titulo_evento) {
    const dataLimpa = dataEncontrada.replace(/-/g, '');
    const horaLimpa = horaEncontrada.replace(':', '');
    const temaLimpo = resultado.titulo_evento
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 10);
    resultado.id_verificacao = `${dataLimpa}${horaLimpa}${temaLimpo}`;
  }

  return resultado;
}

function extrairNomesDaTabela(texto) {
  const nomes = [];
  const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 2);

  // Estratégia: após a linha que contém "NOME" e "FUNÇÃO", coletar nomes
  let dentroTabela = false;
  const palavrasIgnorar = [
    'NOME', 'FUNÇÃO', 'FUNCAO', 'CARGO', 'OBSERV', 'OBRIG',
    'DISPENSADO', 'PRESIDENTE', 'CÂMARA', 'CAMARA', 'RUA',
    'FONE', 'FAX', 'CEP', 'SÃO', 'SAO', 'COORDENADOR',
    'DEPARTAMENTO', 'CONVOCAÇÃO', 'CONVOCACAO', 'ORDEM',
    'SERVIÇO', 'SERVICO', 'REUNIÃO', 'REUNIAO'
  ];

  // Funções/cargos comuns que indicam que a linha é uma função, não um nome
  const regexFuncao = /operador|responsável|repórter|reporter|diretor|coordenador|transmiss|câmera|camera|áudio|audio|plenário|plenario/i;

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];

    // Detecta início da tabela
    if (/\bNOME\b/i.test(linha) && /\bFUN[ÇC][ÃA]O\b/i.test(linha)) {
      dentroTabela = true;
      continue;
    }

    if (!dentroTabela) continue;

    // Para ao encontrar OBSERVAÇÕES ou assinaturas
    if (/observa[çc][oõ]es|dispensado|presidente.*session|coordenador de comunica/i.test(linha)) {
      break;
    }

    // Ignora linhas que são claramente funções
    if (regexFuncao.test(linha)) continue;

    // Ignora linhas com palavras-chave institucionais
    if (palavrasIgnorar.some(p => linha.toUpperCase().includes(p))) continue;

    // Verifica se parece um nome próprio: 2+ palavras capitalizadas, sem números
    if (pareceNomeProprio(linha)) {
      nomes.push(normalizarNome(linha));
    }
  }

  // Fallback: busca por padrão "Nome Sobrenome" em linhas adjacentes a funções
  if (nomes.length === 0) {
    nomes.push(...extrairNomesPorPadrão(linhas));
  }

  return [...new Set(nomes)]; // Remove duplicatas
}

function pareceNomeProprio(texto) {
  // Remove números e caracteres especiais
  const limpo = texto.replace(/[0-9()\/\-\:\.]/g, '').trim();
  if (limpo.length < 5) return false;

  // Deve ter pelo menos 2 palavras
  const palavras = limpo.split(/\s+/).filter(p => p.length > 1);
  if (palavras.length < 2) return false;

  // Maioria das palavras devem começar com maiúscula
  const capitalizadas = palavras.filter(p => /^[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ]/.test(p));
  return capitalizadas.length >= Math.ceil(palavras.length * 0.6);
}

function normalizarNome(nome) {
  return nome
    .replace(/[^\w\sÀ-ÿ]/g, '') // Remove pontuação estranha do OCR
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairNomesPorPadrão(linhas) {
  const nomes = [];
  const regexFuncao = /operador|responsável|repórter|reporter|diretor|coordenador|transmiss|câmera|camera|áudio|audio/i;

  for (let i = 0; i < linhas.length - 1; i++) {
    const atual = linhas[i];
    const proxima = linhas[i+1];

    // Se a próxima linha é uma função, a atual provavelmente é um nome
    if (regexFuncao.test(proxima) && pareceNomeProprio(atual)) {
      nomes.push(normalizarNome(atual));
    }
  }
  return nomes;
}
