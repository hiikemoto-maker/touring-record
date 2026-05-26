import fs from 'node:fs';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || 'c32f9ff51dc5bc7450364ee942a59b50';
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const databaseName = process.env.D1_DATABASE_NAME || 'touring_record_sync';
const scriptName = process.env.WORKER_SCRIPT_NAME || 'touring-record-sync';
const workersDevSubdomain = process.env.WORKERS_DEV_SUBDOMAIN || 'hi-ikemoto';

if (!apiToken) {
  console.error('CLOUDFLARE_API_TOKEN is required.');
  console.error('Create a free Cloudflare API token with Workers Scripts Edit and D1 Edit permissions, then run:');
  console.error('  CLOUDFLARE_API_TOKEN=... node cloudflare/deploy-sync-api.mjs');
  process.exit(1);
}

const apiBase = 'https://api.cloudflare.com/client/v4';

async function cf(path, options = {}) {
  const res = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok || json.success === false) {
    const errors = json.errors ? JSON.stringify(json.errors) : text;
    throw new Error(`${options.method || 'GET'} ${path} failed ${res.status}: ${errors}`);
  }
  return json;
}

async function getOrCreateD1Database() {
  const list = await cf(`/accounts/${accountId}/d1/database`);
  const existing = (list.result || []).find(db => db.name === databaseName);
  if (existing) {
    console.log(`D1 database exists: ${databaseName}`);
    return existing.uuid || existing.id;
  }

  const created = await cf(`/accounts/${accountId}/d1/database`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: databaseName })
  });
  const id = created.result?.uuid || created.result?.id;
  if (!id) throw new Error('D1 database created but ID was not returned.');
  console.log(`D1 database created: ${databaseName}`);
  return id;
}

async function applySchema(databaseId) {
  const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
  for (const sql of statements) {
    await cf(`/accounts/${accountId}/d1/database/${databaseId}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });
  }
  console.log('D1 schema applied.');
}

async function uploadWorker(databaseId) {
  const worker = fs.readFileSync(new URL('./sync-worker.js', import.meta.url), 'utf8');
  const metadata = {
    main_module: 'sync-worker.js',
    compatibility_date: '2026-05-26',
    bindings: [
      { type: 'd1', name: 'DB', id: databaseId }
    ]
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('sync-worker.js', new Blob([worker], { type: 'application/javascript+module' }), 'sync-worker.js');

  await cf(`/accounts/${accountId}/workers/scripts/${scriptName}`, {
    method: 'PUT',
    body: form
  });
  console.log(`Worker uploaded: ${scriptName}`);
}

async function enableWorkersDev() {
  try {
    await cf(`/accounts/${accountId}/workers/scripts/${scriptName}/subdomain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true })
    });
    console.log('workers.dev route enabled.');
  } catch (error) {
    console.log('workers.dev route was not changed. Check the dashboard if the URL does not open.');
  }
}

async function healthCheck(url) {
  const res = await fetch(`${url}/api/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error('Health check response was not ok.');
}

const databaseId = await getOrCreateD1Database();
await applySchema(databaseId);
await uploadWorker(databaseId);
await enableWorkersDev();

const url = `https://${scriptName}.${workersDevSubdomain}.workers.dev`;
console.log(`Sync API URL: ${url}`);

try {
  await healthCheck(url);
  console.log('Health check: ok');
} catch (error) {
  console.log(`Health check skipped/failed: ${error.message}`);
  console.log('If the worker was just created, wait a minute and try the URL in your browser.');
}

