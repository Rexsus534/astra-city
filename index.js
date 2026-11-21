import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json({ limit: '64kb' }));
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.resolve('server/data');
const DB_FILE = path.join(DATA_DIR, 'players.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }, null, 2));

const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const writeDB = (data) => {
  const temp = DB_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, DB_FILE);
};
const sessions = new Map(); // token -> { userKey, expiresAt }
const worldPlayers = new Map();
const movementTimes = new Map();
const actionTimes = new Map();
const sessionLifetime = 7 * 24 * 60 * 60 * 1000;
const allowedUnlocks = new Set(['strength', 'flight', 'energy', 'telekinesis', 'shield']);
const allowedSkills = new Set(['strength', 'movement', 'energy', 'defense']);
const safeUser = (u) => ({
  username: u.username,
  level: u.level || 1,
  xp: u.xp || 0,
  credits: u.credits ?? 250,
  unlocks: u.unlocks || ['strength', 'flight'],
  skills: u.skills || {},
  cosmetic: u.cosmetic || { color: '#42d8ff', suit: 'Astra' },
  missions: u.missions || {}
});
function makeSession(userKey) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userKey, expiresAt: Date.now() + sessionLifetime });
  return token;
}
function getSession(token) {
  const s = sessions.get(String(token || ''));
  if (!s) return null;
  if (s.expiresAt <= Date.now()) { sessions.delete(token); return null; }
  return s;
}
function getUserFromHeader(req) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const session = getSession(token);
  if (!session) return null;
  return { token, key: session.userKey };
}
function cleanSkills(value) {
  const out = {};
  if (value && typeof value === 'object') for (const [key, val] of Object.entries(value)) if (allowedSkills.has(key) && val === true) out[key] = true;
  return out;
}
function cleanCosmetic(value, fallback) {
  const color = typeof value?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.color) ? value.color : fallback?.color || '#42d8ff';
  return { color, suit: 'Astra' };
}
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'Astra City', online: worldPlayers.size }));

app.post('/api/register', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!/^[A-Za-z0-9_]{3,18}$/.test(username)) return res.status(400).json({ error: 'Username: 3–18 letters, numbers or underscore.' });
  if (password.length < 6 || password.length > 128) return res.status(400).json({ error: 'Password must be 6–128 characters.' });
  const data = readDB();
  const key = username.toLowerCase();
  if (data.users[key]) return res.status(409).json({ error: 'Username already exists.' });
  const user = { username, passwordHash: await bcrypt.hash(password, 10), level: 1, xp: 0, credits: 250, unlocks: ['strength', 'flight'], skills: {}, cosmetic: { color: '#42d8ff', suit: 'Astra' }, missions: {}, createdAt: Date.now() };
  data.users[key] = user;
  writeDB(data);
  res.json({ token: makeSession(key), player: safeUser(user) });
});
app.post('/api/login', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const key = username.toLowerCase();
  const user = readDB().users[key];
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Incorrect username or password.' });
  user.lastLogin = Date.now();
  const data = readDB(); data.users[key].lastLogin = user.lastLogin; writeDB(data);
  res.json({ token: makeSession(key), player: safeUser(user) });
});
app.get('/api/me', (req, res) => {
  const session = getUserFromHeader(req);
  if (!session) return res.status(401).json({ error: 'Session expired' });
  const user = readDB().users[session.key];
  if (!user) return res.status(401).json({ error: 'Account not found' });
  res.json({ player: safeUser(user) });
});
app.post('/api/save', (req, res) => {
  const session = getUserFromHeader(req);
  if (!session) return res.status(401).json({ error: 'Session expired' });
  const data = readDB();
  const user = data.users[session.key];
  if (!user) return res.status(401).json({ error: 'Account not found' });
  const p = req.body || {};
  user.level = Math.max(1, Math.min(1000, Math.floor(Number(p.level) || user.level || 1)));
  user.xp = Math.max(0, Math.min(1_000_000_000, Math.floor(Number(p.xp) || 0)));
  user.credits = Math.max(0, Math.min(1_000_000_000, Math.floor(Number(p.credits) || 0)));
  user.unlocks = Array.isArray(p.unlocks) ? [...new Set(p.unlocks.filter(x => allowedUnlocks.has(x)))].slice(0, 5) : user.unlocks;
  user.skills = cleanSkills(p.skills);
  user.cosmetic = cleanCosmetic(p.cosmetic, user.cosmetic);
  user.missions = p.missions && typeof p.missions === 'object' ? Object.fromEntries(Object.entries(p.missions).filter(([k, v]) => /^[a-zA-Z0-9_]{1,48}$/.test(k) && (typeof v === 'boolean' || (k === 'storyStage' && Number.isInteger(v) && v >= 0 && v <= 5))).slice(0, 100)) : user.missions;
  user.updatedAt = Date.now();
  writeDB(data);
  res.json({ ok: true, player: safeUser(user) });
});

app.use(express.static(path.resolve('dist')));
app.get('*', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
function clamp(n, min, max) { n = Number(n); if (!Number.isFinite(n)) n = 0; return Math.max(min, Math.min(max, n)); }
function broadcastPlayers() { io.emit('players', Array.from(worldPlayers.values())); }
const actionWhitelist = new Set(['punch', 'energy', 'telekinesis', 'shield', 'ultimate', 'flight']);
io.on('connection', (socket) => {
  socket.on('auth-world', ({ token } = {}) => {
    const session = getSession(token);
    if (!session) return socket.emit('world-error', 'Sign in again.');
    const user = readDB().users[session.userKey];
    socket.data.userKey = session.userKey;
    socket.data.username = user.username;
    const player = { id: socket.id, username: user.username, level: user.level || 1, x: 0, y: 1, z: 0, heading: 0, color: user.cosmetic?.color || '#42d8ff', flying: false };
    worldPlayers.set(socket.id, player);
    socket.emit('world-ready', { players: Array.from(worldPlayers.values()) });
    broadcastPlayers();
  });
  socket.on('move', (data = {}) => {
    if (!socket.data.userKey) return;
    const player = worldPlayers.get(socket.id); if (!player) return;
    const now = Date.now(); const last = movementTimes.get(socket.id) || 0;
    if (now - last < 35) return; movementTimes.set(socket.id, now);
    player.x = clamp(data.x, -450, 450); player.y = clamp(data.y, 0, 140); player.z = clamp(data.z, -450, 450);
    player.heading = clamp(data.heading, -10000, 10000); player.flying = Boolean(data.flying);
    socket.broadcast.emit('player-move', player);
  });
  socket.on('hero-action', (action = {}) => {
    if (!socket.data.userKey || !actionWhitelist.has(action.type)) return;
    const now = Date.now(); const last = actionTimes.get(socket.id) || 0;
    if (now - last < 180) return; actionTimes.set(socket.id, now);
    const p = worldPlayers.get(socket.id); if (!p) return;
    socket.broadcast.emit('hero-action', { id: socket.id, username: p.username, type: action.type, x: p.x, y: p.y, z: p.z, heading: p.heading, at: now });
  });
  socket.on('chat', (message) => {
    if (!socket.data.username) return;
    const text = String(message || '').trim().slice(0, 180);
    if (text) io.emit('chat', { username: socket.data.username, text, at: Date.now() });
  });
  socket.on('disconnect', () => {
    worldPlayers.delete(socket.id); movementTimes.delete(socket.id); actionTimes.delete(socket.id); broadcastPlayers();
  });
});
httpServer.listen(PORT, () => console.log(`Astra City server listening on http://localhost:${PORT}`));
