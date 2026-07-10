'use strict';

const crypto = require('crypto');
const { getDatabase, getBucket, STORAGE_BUCKET } = require('./_shared/firebase-admin');
const { verifyToken } = require('./_shared/upload-session');

const CRM_LEVELS = ['diretor', 'trafego', 'gestor', 'engenharia', 'executivo', 'sdr', 'jackeline'];
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isValidDealId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
  }

  const secret = process.env.UPLOAD_SESSION_SECRET;
  if (!secret) {
    return { statusCode: 500, body: JSON.stringify({ error: 'UPLOAD_SESSION_SECRET não configurada' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body inválido' }) };
  }

  const { sessionToken, dealId, fileName, contentType, fileBase64 } = body;

  // Validar token — source of trust para uid
  let tokenPayload;
  try {
    tokenPayload = verifyToken(sessionToken, secret);
  } catch (e) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Token inválido: ' + e.message }) };
  }

  const uid = tokenPayload.uid;

  // Buscar usuário do RTDB pelo uid do token (não confiar em nenhum campo do body)
  let db;
  try {
    db = getDatabase();
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro de configuração do servidor' }) };
  }

  let user;
  try {
    const snapshot = await db.ref('users/' + uid).once('value');
    user = snapshot.val();
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro ao verificar usuário' }) };
  }

  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Usuário não encontrado' }) };
  }

  // Verificar acesso ao CRM pelo level server-side
  const level = (user.level || '').toLowerCase().trim();
  if (!CRM_LEVELS.includes(level)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Sem permissão para upload no CRM' }) };
  }

  // Validar dealId — sem path separators
  if (!isValidDealId(dealId)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'dealId inválido' }) };
  }

  // Validar fileName
  if (!fileName || typeof fileName !== 'string' || fileName.trim().length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'fileName ausente' }) };
  }

  // Validar contentType
  if (!contentType || !ALLOWED_MIMES.has(contentType)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Tipo de arquivo não permitido' }) };
  }

  // Validar e decodificar base64
  if (!fileBase64 || typeof fileBase64 !== 'string' || fileBase64.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'fileBase64 ausente' }) };
  }

  const fileBuffer = Buffer.from(fileBase64, 'base64');
  if (fileBuffer.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'arquivo vazio ou base64 inválido' }) };
  }

  if (fileBuffer.length > MAX_BYTES) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Arquivo muito grande. Máximo 10MB.' }) };
  }

  const ts = Date.now();
  const safeNome = sanitizeFileName(fileName);
  const path = `crm/${dealId}/${ts}_${safeNome}`;

  let bucket;
  try {
    bucket = getBucket();
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro de configuração do Storage' }) };
  }

  // Token de download permanente compatível com Firebase Storage getDownloadURL()
  const downloadToken = crypto.randomUUID();

  try {
    const file = bucket.file(path);
    await file.save(fileBuffer, {
      contentType,
      metadata: {
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro no upload: ' + e.message }) };
  }

  // URL permanente no mesmo formato que getDownloadURL() gera
  const encodedPath = encodeURIComponent(path);
  const url =
    `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodedPath}` +
    `?alt=media&token=${downloadToken}`;

  const arqData = {
    nome: fileName,
    url,
    tipo: contentType,
    tamanho: fileBuffer.length,
    uploadedBy: user.name || uid,
    uploadedAt: ts,
    path,
  };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arqData),
  };
};
