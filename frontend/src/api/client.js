import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 120_000,
});

// ── Query endpoints ───────────────────────────────────────────────────────────
export const runQuery     = (sql)         => api.post('/api/query/run',     { sql }).then(r => r.data);
export const explainQuery = (sql)         => api.post('/api/query/explain', { sql }).then(r => r.data);
export const getSchema    = (table = '')  => api.get('/api/query/schema', { params: { table } }).then(r => r.data);
export const analyzeQuery = (sql)         => api.post('/api/query/analyze', { sql }).then(r => r.data);

// ── Agent endpoints ───────────────────────────────────────────────────────────
export const runAgent = (message, sql = null, mode = 'auto') =>
  api.post('/api/agent/run', { message, sql, mode }).then(r => r.data);

// ── Chat endpoint (conversational, no tools) ──────────────────────────────────
export const sendChatMessage = (message, history = [], contextSql = null) =>
  api.post('/api/chat/send', {
    message,
    history,
    context_sql: contextSql,
  }).then(r => r.data);

export async function streamChatMessage(message, history = [], contextSql = null, onToken) {
  const response = await fetch(`${api.defaults.baseURL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history,
      context_sql: contextSql,
    }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with status ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullReply = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundaryIndex = buffer.indexOf('\n\n');
    while (boundaryIndex !== -1) {
      const event = buffer.slice(0, boundaryIndex).trim();
      buffer = buffer.slice(boundaryIndex + 2);
      boundaryIndex = buffer.indexOf('\n\n');

      if (!event.startsWith('data:')) continue;
      const payload = JSON.parse(event.slice(5).trim());
      if (payload.token) {
        fullReply += payload.token;
        onToken?.(payload.token, fullReply);
      }
      if (payload.error) {
        throw new Error(payload.error);
      }
      if (payload.done) {
        return { reply: fullReply };
      }
    }
  }

  return { reply: fullReply };
}

export default api;