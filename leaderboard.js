const AIPONG_API = 'https://cliffella.space/api/aipong-leaderboard';
const PONG_API = 'https://cliffella.space/api/pong-leaderboard';

function sanitizeName(name, fallback = 'PLAYER') {
  const cleaned = (name || fallback)
    .toUpperCase()
    .replace(/[^A-Z0-9 _.-]/g, '')
    .trim()
    .slice(0, 12);
  return cleaned || fallback;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`request failed: ${response.status}`);
  }

  return response.json();
}

export async function submitAiScore(name, volleys) {
  const safeName = sanitizeName(name, 'ANON');
  const safeVolleys = Math.max(0, Math.floor(Number(volleys) || 0));
  return fetchJson(AIPONG_API, {
    method: 'POST',
    body: JSON.stringify({ name: safeName, volleys: safeVolleys })
  });
}

export async function fetchAiScores(limit = 20) {
  const data = await fetchJson(AIPONG_API, { method: 'GET' });
  return (data.scores || []).slice(0, limit).map(row => ({
    name: sanitizeName(row.name),
    volleys: Math.max(0, Number(row.volleys) || 0),
    date: row.date || '',
    createdAt: Number(row.createdAt) || 0,
  }));
}

export async function submitClassicResult(winnerName, loserName, winnerScore, loserScore) {
  const winner = sanitizeName(winnerName, 'P1');
  const loser = sanitizeName(loserName, 'P2');
  const winScore = Math.max(0, Math.floor(Number(winnerScore) || 0));
  const loseScore = Math.max(0, Math.floor(Number(loserScore) || 0));
  return fetchJson(PONG_API, {
    method: 'POST',
    body: JSON.stringify({
      winner,
      loser,
      winnerScore: winScore,
      loserScore: loseScore,
    })
  });
}

export async function fetchClassicStandings(limit = 20) {
  const data = await fetchJson(PONG_API, { method: 'GET' });
  return (data.standings || []).slice(0, limit).map(row => ({
    name: sanitizeName(row.name),
    wins: Math.max(0, Number(row.wins) || 0),
    losses: Math.max(0, Number(row.losses) || 0),
    pointsFor: Math.max(0, Number(row.pointsFor) || 0),
    pointsAgainst: Math.max(0, Number(row.pointsAgainst) || 0),
    diff: Number(row.diff) || 0,
    date: row.date || '',
    lastPlayed: Number(row.lastPlayed) || 0,
  }));
}
