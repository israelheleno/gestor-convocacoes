// matcher.js
// Lógica de cruzamento de nomes: exato, parcial e aprendizado

import { db } from './firebase-config.js';
import {
  collection, getDocs, doc, updateDoc, arrayUnion, query, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * Resultado possível do match:
 * { tipo: 'exato', usuario }
 * { tipo: 'parcial', usuario, nomeEncontrado }
 * { tipo: 'nao_encontrado', nomeOriginal }
 */
export async function cruzarNomes(nomesConvocados, grupoId) {
  // Buscar todos os usuários do grupo
  const snap = await getDocs(
    query(collection(db, 'usuarios'), where('grupo_id', '==', grupoId))
  );
  const usuarios = snap.docs.map(d => d.data());

  const resultados = [];

  for (const nomeConvocado of nomesConvocados) {
    const resultado = encontrarUsuario(nomeConvocado, usuarios);
    resultados.push(resultado);
  }

  return resultados;
}

function encontrarUsuario(nomeConvocado, usuarios) {
  const nomeNorm = normalizarTexto(nomeConvocado);

  // ── 1. Busca exata no nome completo ou nomes_conhecidos ──────────
  for (const usuario of usuarios) {
    const nomesConhecidos = usuario.nomes_conhecidos || [];
    const todosOsNomes = [usuario.nome_completo, ...nomesConhecidos];

    for (const nome of todosOsNomes) {
      if (normalizarTexto(nome) === nomeNorm) {
        return { tipo: 'exato', usuario, nomeEncontrado: nome };
      }
    }
  }

  // ── 2. Busca parcial: nome do papel está contido no nome completo ─
  for (const usuario of usuarios) {
    const nomeCompNorm = normalizarTexto(usuario.nome_completo);
    if (nomeCompNorm.includes(nomeNorm) || nomeNorm.includes(nomeCompNorm)) {
      return { tipo: 'parcial', usuario, nomeEncontrado: nomeConvocado };
    }
  }

  // ── 3. Busca por palavras em comum (similaridade) ────────────────
  const melhorMatch = buscarPorSimilaridade(nomeNorm, usuarios);
  if (melhorMatch) {
    return { tipo: 'parcial', usuario: melhorMatch.usuario, nomeEncontrado: nomeConvocado };
  }

  return { tipo: 'nao_encontrado', nomeOriginal: nomeConvocado };
}

function buscarPorSimilaridade(nomeNorm, usuarios) {
  const palavrasConvocado = nomeNorm.split(' ').filter(p => p.length > 2);
  let melhorScore = 0;
  let melhorUsuario = null;

  for (const usuario of usuarios) {
    const nomeCompNorm = normalizarTexto(usuario.nome_completo);
    const palavrasUsuario = nomeCompNorm.split(' ').filter(p => p.length > 2);

    const coincidencias = palavrasConvocado.filter(p =>
      palavrasUsuario.some(pu => pu === p || levenshtein(p, pu) <= 1)
    ).length;

    const score = coincidencias / Math.max(palavrasConvocado.length, 1);

    if (score > melhorScore && score >= 0.5) {
      melhorScore = score;
      melhorUsuario = usuario;
    }
  }

  return melhorUsuario ? { usuario: melhorUsuario, score: melhorScore } : null;
}

// ── Aprendizado: salva alias quando usuário confirma ────────────────
export async function confirmarAlias(uid, novoAlias) {
  const userRef = doc(db, 'usuarios', uid);
  await updateDoc(userRef, {
    nomes_conhecidos: arrayUnion(novoAlias)
  });
}

// ── Utilitários ─────────────────────────────────────────────────────
function normalizarTexto(texto) {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Distância de Levenshtein para erros de OCR
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m+1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}
