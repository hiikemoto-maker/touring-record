const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return jsonResponse({}, 204);

    const url = new URL(request.url);
    if (url.pathname === '/api/health') {
      return jsonResponse({ ok: true });
    }

    if (url.pathname === '/api/sync' && request.method === 'POST') {
      return handleSync(request, env);
    }

    return jsonResponse({ error: 'Not found' }, 404);
  }
};

async function handleSync(request, env) {
  if (!env.DB) return jsonResponse({ error: 'D1 binding DB is missing' }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const syncKey = String(body.syncKey || '').trim();
  if (syncKey.length < 6) {
    return jsonResponse({ error: 'Sync key must be at least 6 characters' }, 400);
  }

  const syncKeyHash = await sha256(syncKey);
  const records = Array.isArray(body.records) ? body.records : [];
  const deletedRecords = Array.isArray(body.deletedRecords) ? body.deletedRecords : [];
  const now = Date.now();

  for (const item of deletedRecords) {
    const id = normalizeId(item.id || item.recordId);
    if (!id) continue;
    const deletedAt = normalizeTimestamp(item.deletedAt || item.deleted_at) || now;
    await upsertDeleted(env.DB, syncKeyHash, id, deletedAt);
  }

  for (const record of records) {
    const id = normalizeId(record?.id);
    if (!id) continue;
    const updatedAt = normalizeTimestamp(record.updatedAt) || now;
    await upsertActive(env.DB, syncKeyHash, id, sanitizeRecord(record, updatedAt), updatedAt);
  }

  const rows = await env.DB.prepare(
    `SELECT record_id, data, updated_at, deleted_at
       FROM records
      WHERE sync_key_hash = ?`
  ).bind(syncKeyHash).all();

  const active = [];
  const deleted = [];
  for (const row of rows.results || []) {
    if (row.deleted_at) {
      deleted.push({ id: row.record_id, deletedAt: Number(row.deleted_at) });
      continue;
    }
    if (!row.data) continue;
    try {
      active.push(JSON.parse(row.data));
    } catch {}
  }

  return jsonResponse({ records: active, deletedRecords: deleted });
}

async function upsertDeleted(db, syncKeyHash, id, deletedAt) {
  const existing = await getRecordMeta(db, syncKeyHash, id);
  if (existing && Number(existing.updated_at || 0) > deletedAt) return;

  await db.prepare(
    `INSERT INTO records (sync_key_hash, record_id, data, updated_at, deleted_at)
     VALUES (?, ?, NULL, ?, ?)
     ON CONFLICT(sync_key_hash, record_id) DO UPDATE SET
       data = NULL,
       updated_at = excluded.updated_at,
       deleted_at = excluded.deleted_at`
  ).bind(syncKeyHash, id, deletedAt, deletedAt).run();
}

async function upsertActive(db, syncKeyHash, id, record, updatedAt) {
  const existing = await getRecordMeta(db, syncKeyHash, id);
  if (existing) {
    const existingUpdated = Number(existing.updated_at || 0);
    const existingDeleted = Number(existing.deleted_at || 0);
    if (existingDeleted && existingDeleted >= updatedAt) return;
    if (!existingDeleted && existingUpdated > updatedAt) return;
  }

  await db.prepare(
    `INSERT INTO records (sync_key_hash, record_id, data, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, NULL)
     ON CONFLICT(sync_key_hash, record_id) DO UPDATE SET
       data = excluded.data,
       updated_at = excluded.updated_at,
       deleted_at = NULL`
  ).bind(syncKeyHash, id, JSON.stringify(record), updatedAt).run();
}

async function getRecordMeta(db, syncKeyHash, id) {
  return db.prepare(
    `SELECT updated_at, deleted_at
       FROM records
      WHERE sync_key_hash = ? AND record_id = ?`
  ).bind(syncKeyHash, id).first();
}

function sanitizeRecord(record, updatedAt) {
  return {
    ...record,
    id: String(record.id),
    updatedAt,
    photos: [],
    photoCount: Number(record.photoCount || 0)
  };
}

function normalizeId(value) {
  const id = String(value || '').trim();
  return id ? id.slice(0, 128) : '';
}

function normalizeTimestamp(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0;
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function jsonResponse(data, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

