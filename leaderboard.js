import { SimplePool, finalizeEvent, generateSecretKey, getPublicKey } from 'https://esm.sh/nostr-tools@2.13.0';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.snort.social'
];

const pool = new SimplePool();
const KIND = 13371;
const APP_TAG = 'cliffella-pong-leaderboard';
const KEY_NAME = 'cliffella-pong-leaderboard-secret';
const MAX_FETCH = 200;

function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function sanitizeName(name, fallback = 'PLAYER') {
  const cleaned = (name || fallback)
    .toUpperCase()
    .replace(/[^A-Z0-9 _.-]/g, '')
    .trim()
    .slice(0, 12);
  return cleaned || fallback;
}

function storageAvailable() {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function getOrCreateSecretKey() {
  if (!storageAvailable()) return generateSecretKey();
  let hex = localStorage.getItem(KEY_NAME);
  if (!hex) {
    hex = bytesToHex(generateSecretKey());
    localStorage.setItem(KEY_NAME, hex);
  }
  return hexToBytes(hex);
}

function waitForPub(pub, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('publish timeout')), timeoutMs);
    pub.on('ok', () => {
      clearTimeout(timer);
      resolve(true);
    });
    pub.on('failed', reason => {
      clearTimeout(timer);
      reject(new Error(reason || 'publish failed'));
    });
  });
}

async function publishEvent(content, tags) {
  const sk = getOrCreateSecretKey();
  const event = finalizeEvent({
    kind: KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['t', APP_TAG],
      ...tags
    ],
    content: JSON.stringify(content)
  }, sk);

  const pubs = pool.publish(RELAYS, event);
  await Promise.any(pubs.map(pub => waitForPub(pub)));
  return event;
}

async function listEvents(mode) {
  const events = await pool.querySync(RELAYS, {
    kinds: [KIND],
    '#t': [APP_TAG],
    '#g': [mode],
    limit: MAX_FETCH
  });

  const deduped = new Map();
  for (const event of events || []) {
    if (!deduped.has(event.id)) deduped.set(event.id, event);
  }

  return Array.from(deduped.values()).sort((a, b) => b.created_at - a.created_at);
}

export async function submitAiScore(name, volleys) {
  const safeName = sanitizeName(name);
  const safeVolleys = Math.max(0, Number(volleys) || 0);
  return publishEvent({
    type: 'aipong-score',
    name: safeName,
    volleys: safeVolleys,
    pubkey: getPublicKey(getOrCreateSecretKey())
  }, [
    ['g', 'aipong'],
    ['name', safeName],
    ['score', String(safeVolleys)]
  ]);
}

export async function fetchAiScores(limit = 20) {
  const events = await listEvents('aipong');
  return events
    .map(event => {
      try {
        const data = JSON.parse(event.content || '{}');
        return {
          id: event.id,
          name: sanitizeName(data.name),
          volleys: Math.max(0, Number(data.volleys) || 0),
          date: new Date(event.created_at * 1000).toLocaleDateString(),
          createdAt: event.created_at,
          pubkey: event.pubkey
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.volleys - a.volleys || b.createdAt - a.createdAt)
    .slice(0, limit);
}

export async function submitClassicResult(winnerName, loserName, winnerScore, loserScore) {
  const winner = sanitizeName(winnerName, 'P1');
  const loser = sanitizeName(loserName, 'P2');
  const winScore = Math.max(0, Number(winnerScore) || 0);
  const loseScore = Math.max(0, Number(loserScore) || 0);
  return publishEvent({
    type: 'classic-match',
    winner,
    loser,
    winnerScore: winScore,
    loserScore: loseScore,
    pubkey: getPublicKey(getOrCreateSecretKey())
  }, [
    ['g', 'pong'],
    ['winner', winner],
    ['loser', loser],
    ['score', `${winScore}-${loseScore}`]
  ]);
}

export async function fetchClassicStandings(limit = 20) {
  const events = await listEvents('pong');
  const standings = new Map();

  for (const event of events) {
    try {
      const data = JSON.parse(event.content || '{}');
      const winner = sanitizeName(data.winner, 'P1');
      const loser = sanitizeName(data.loser, 'P2');
      const winnerScore = Math.max(0, Number(data.winnerScore) || 0);
      const loserScore = Math.max(0, Number(data.loserScore) || 0);

      if (!standings.has(winner)) standings.set(winner, { name: winner, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, diff: 0, lastPlayed: event.created_at });
      if (!standings.has(loser)) standings.set(loser, { name: loser, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, diff: 0, lastPlayed: event.created_at });

      const winnerRow = standings.get(winner);
      const loserRow = standings.get(loser);

      winnerRow.wins += 1;
      winnerRow.pointsFor += winnerScore;
      winnerRow.pointsAgainst += loserScore;
      winnerRow.diff = winnerRow.pointsFor - winnerRow.pointsAgainst;
      winnerRow.lastPlayed = Math.max(winnerRow.lastPlayed, event.created_at);

      loserRow.losses += 1;
      loserRow.pointsFor += loserScore;
      loserRow.pointsAgainst += winnerScore;
      loserRow.diff = loserRow.pointsFor - loserRow.pointsAgainst;
      loserRow.lastPlayed = Math.max(loserRow.lastPlayed, event.created_at);
    } catch {
      // ignore malformed events
    }
  }

  return Array.from(standings.values())
    .sort((a, b) => b.wins - a.wins || b.diff - a.diff || b.lastPlayed - a.lastPlayed)
    .slice(0, limit)
    .map(row => ({
      ...row,
      date: new Date(row.lastPlayed * 1000).toLocaleDateString()
    }));
}

export function getRelayList() {
  return [...RELAYS];
}
