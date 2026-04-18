# pong-leaderboard

Shared leaderboard module for the Cliffella Pong games.

## Repo
- GitHub: https://github.com/clf99/pong-leaderboard
- CDN module: https://cdn.jsdelivr.net/gh/clf99/pong-leaderboard@main/leaderboard.js

## How it works
This module uses public Nostr relays as the shared transport, so scores are visible to everyone instead of being trapped in one browser's local storage.

## Exports
- `submitAiScore(name, volleys)`
- `fetchAiScores(limit)`
- `submitClassicResult(winnerName, loserName, winnerScore, loserScore)`
- `fetchClassicStandings(limit)`
- `getRelayList()`

## Notes
- A browser-local keypair is created on first use and reused for that browser.
- This is designed for lightweight public arcade leaderboards, not high-security tournament enforcement.
