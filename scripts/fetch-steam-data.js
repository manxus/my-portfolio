/**
 * Build-time script to fetch Steam library data.
 *
 * Usage:
 *   STEAM_API_KEY=<key> STEAM_ID=<id> node scripts/fetch-steam-data.js
 *
 * Outputs JSON to src/data/steam-library.json
 *
 * The Steam Web API key can be obtained at:
 *   https://steamcommunity.com/dev/apikey
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../src/data/steam-library.json');

const API_KEY = process.env.STEAM_API_KEY;
const STEAM_ID = process.env.STEAM_ID;

if (!API_KEY || !STEAM_ID) {
  console.error('Missing STEAM_API_KEY or STEAM_ID environment variables.');
  console.error('Usage: STEAM_API_KEY=<key> STEAM_ID=<id> node scripts/fetch-steam-data.js');
  process.exit(1);
}

const STEAM_API = 'https://api.steampowered.com';
const STORE_API = 'https://store.steampowered.com/api';

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function getPlayerSummary() {
  const url = `${STEAM_API}/ISteamUser/GetPlayerSummaries/v2/?key=${API_KEY}&steamids=${STEAM_ID}`;
  const data = await fetchJSON(url);
  const player = data.response.players[0];
  if (!player) throw new Error('Player not found');
  return {
    steamId: player.steamid,
    personaName: player.personaname,
    avatarUrl: player.avatarfull,
    profileUrl: player.profileurl,
    lastLogoff: player.lastlogoff,
  };
}

async function getOwnedGames() {
  const url = `${STEAM_API}/IPlayerService/GetOwnedGames/v1/?key=${API_KEY}&steamid=${STEAM_ID}&include_appinfo=1&include_played_free_games=1`;
  const data = await fetchJSON(url);
  return (data.response.games || [])
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, 50)
    .map((g) => ({
      appId: g.appid,
      name: g.name,
      playtimeHours: Math.round((g.playtime_forever / 60) * 10) / 10,
      iconUrl: `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`,
      headerUrl: `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
    }));
}

async function getAchievements(appId) {
  try {
    const url = `${STEAM_API}/ISteamUserStats/GetPlayerAchievements/v1/?key=${API_KEY}&steamid=${STEAM_ID}&appid=${appId}`;
    const data = await fetchJSON(url);
    const achievements = data.playerstats.achievements || [];
    const unlocked = achievements.filter((a) => a.achieved === 1).length;
    return { total: achievements.length, unlocked };
  } catch {
    return null;
  }
}

async function main() {
  console.log('Fetching Steam data...');

  const profile = await getPlayerSummary();
  console.log(`Profile: ${profile.personaName}`);

  const games = await getOwnedGames();
  console.log(`Found ${games.length} games`);

  const top10 = games.slice(0, 10);
  for (const game of top10) {
    const ach = await getAchievements(game.appId);
    game.achievements = ach;
    if (ach) {
      console.log(`  ${game.name}: ${ach.unlocked}/${ach.total} achievements`);
    }
  }

  const output = {
    fetchedAt: new Date().toISOString(),
    profile,
    games,
  };

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Written to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
