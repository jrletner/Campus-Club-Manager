/*
  Custom json-server with authentication and authorization.
  - POST /auth/login { username, pin } -> { token, user }
  - JWT Bearer required for all routes except /auth/login
  - Only admins can create/update/delete clubs and users
  - Non-admins may only add an event to a club (other writes forbidden)
  - Seeds users on first run if none exist
*/
const jsonServer = require('json-server');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_TTL_SEC = 60 * 60 * 8; // 8 hours

const server = jsonServer.create();
const router = jsonServer.router(DB_FILE);
const middlewares = jsonServer.defaults();

server.use(middlewares);
server.use(jsonServer.bodyParser);

// Utility to read/write lowdb
function db() {
  return router.db; // lowdb instance
}

function safePickUser(u) {
  if (!u) return null;
  return { id: u.id, username: u.username, isAdmin: !!u.isAdmin };
}

// Seed users if missing
function seedUsersIfEmpty() {
  const users = db().get('users').value();
  if (Array.isArray(users) && users.length > 0) return;
  const seed = [
    { id: 'u-admin', username: 'admin', pin: '1234', isAdmin: true },
    { id: 'u-user', username: 'user', pin: '1234', isAdmin: false },
  ];
  const hashed = seed.map((u) => ({
    id: u.id,
    username: u.username,
    pinHash: bcrypt.hashSync(u.pin, 10),
    isAdmin: !!u.isAdmin,
  }));
  db().set('users', hashed).write();
  // Ensure users key exists in db.json file as well if missing
  try {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    raw.users = db().get('users').value();
    fs.writeFileSync(DB_FILE, JSON.stringify(raw, null, 2));
  } catch (e) {
    // ignore
  }
}

// Ensure users collection exists
if (!db().has('users').value()) {
  db().set('users', []).write();
}
seedUsersIfEmpty();

// Auth: login
server.post('/auth/login', (req, res) => {
  const { username, pin } = req.body || {};
  if (!username || !pin) return res.status(400).json({ error: 'Missing credentials' });
  const user = db().get('users').find({ username }).value();
  if (!user || !user.pinHash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const ok = bcrypt.compareSync(String(pin), String(user.pinHash));
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const payload = { sub: user.id, username: user.username, isAdmin: !!user.isAdmin };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL_SEC });
  res.json({ token, user: safePickUser(user) });
});

// Auth: me
server.get('/auth/me', authRequired, (req, res) => {
  const u = req.user;
  res.json({ user: { id: u.sub, username: u.username, isAdmin: !!u.isAdmin } });
});

// Middleware: require auth for all other routes
server.use((req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  return authRequired(req, res, next);
});

// Authorization for users collection: only admin can write; admin can read; non-admin cannot read list
server.use((req, res, next) => {
  if (req.path.startsWith('/users')) {
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    if (!req.user?.isAdmin) {
      // Allow non-admins to PATCH their own user to update pin
      if (isWrite && req.method === 'PATCH') {
        // More robust than regex: split path and take segment after 'users'
        const id = (req.path.split('/')[2] || '').trim();
        if (!id || id !== req.user?.sub) {
          return res.status(403).json({ error: 'Admins only' });
        }
        return next();
      }
      if (isWrite) return res.status(403).json({ error: 'Admins only' });
      // Non-admins cannot list users; but allow GET /users/:id if it's them
      if (req.method === 'GET') {
        const id = (req.path.split('/')[2] || '').trim();
        if (!id || id !== req.user?.sub) {
          return res.status(403).json({ error: 'Admins only' });
        }
      }
    }
  }
  next();
});

// Authorization for clubs: only admin can write, except non-admins may add a single event via PUT /clubs/:id
server.use((req, res, next) => {
  if (!req.path.startsWith('/clubs')) return next();
  const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!isWrite) return next();
  // Admins: allowed
  if (req.user?.isAdmin) return next();
  // Non-admins: allow only adding an event via PUT /clubs/:id where only events changed by +1
  if (req.method === 'PUT') {
    const id = req.path.split('/')[2];
    const existing = db().get('clubs').find({ id }).value();
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const incoming = req.body;
    // Cannot change name/capacity/members
    const sameCore =
      incoming.name === existing.name &&
      incoming.capacity === existing.capacity &&
      JSON.stringify(incoming.members) === JSON.stringify(existing.members);
    if (!sameCore) return res.status(403).json({ error: 'Read-only' });
    // Events must be existing +1 new at the end
    const prevEvents = existing.events || [];
    const nextEvents = (incoming.events || []);
    if (nextEvents.length !== prevEvents.length + 1) {
      return res.status(403).json({ error: 'Only adding one event allowed' });
    }
    // naive check: previous events must be identical prefix
    const prefixSame = JSON.stringify(prevEvents) === JSON.stringify(nextEvents.slice(0, -1));
    if (!prefixSame) return res.status(403).json({ error: 'Only adding one event allowed' });
    return next();
  }
  // Non-admins: allow PATCH /clubs/:id to hold/give up their own spot, changing only members
  if (req.method === 'PATCH') {
    const id = req.path.split('/')[2];
    const existing = db().get('clubs').find({ id }).value();
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const incoming = req.body || {};
    const keys = Object.keys(incoming);
    if (keys.length === 0) return res.status(400).json({ error: 'No changes' });
    // Only members can be changed by non-admin
    if (keys.some((k) => k !== 'members')) return res.status(403).json({ error: 'Read-only' });
    const prevMembers = Array.isArray(existing.members) ? existing.members : [];
    const nextMembers = Array.isArray(incoming.members) ? incoming.members : [];
    // Core invariants: name/capacity/events must not change in a PATCH body for non-admin
    // (json-server PATCH merges; we only allow 'members' key anyway)

    // Helper: compare arrays excluding current user's own membership
    const userId = req.user?.sub;
    const userName = req.user?.username;
    const prevWithoutUser = prevMembers.filter((m) => m.id !== userId);
    const nextWithoutUser = nextMembers.filter((m) => m.id !== userId);
    const sameOthers = JSON.stringify(prevWithoutUser) === JSON.stringify(nextWithoutUser);
    if (!sameOthers) return res.status(403).json({ error: 'Read-only' });

    // Determine operation: hold (add) or give up (remove)
    const hadSeat = prevMembers.some((m) => m.id === userId);
    const hasSeatNext = nextMembers.some((m) => m.id === userId);

    // Hold: adding exactly the current user, capacity respected, and correct name
    if (!hadSeat && hasSeatNext) {
      if (nextMembers.length !== prevMembers.length + 1)
        return res.status(403).json({ error: 'Invalid change' });
      if ((existing.capacity || 0) < nextMembers.length)
        return res.status(403).json({ error: 'At capacity' });
      const added = nextMembers.find((m) => m.id === userId);
      if (!added || added.name !== userName)
        return res.status(403).json({ error: 'Invalid member' });
      return next();
    }

    // Give up: removing exactly the current user
    if (hadSeat && !hasSeatNext) {
      if (nextMembers.length !== prevMembers.length - 1)
        return res.status(403).json({ error: 'Invalid change' });
      return next();
    }

    // Otherwise, disallow
    return res.status(403).json({ error: 'Read-only' });
  }
  return res.status(403).json({ error: 'Admins only' });
});

// Helpers
function authRequired(req, res, next) {
  const auth = req.headers.authorization || '';
  const parts = auth.split(' ');
  if (parts[0] !== 'Bearer' || !parts[1]) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(parts[1], JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Preprocess user writes: we need to hash PIN.
server.post('/users', (req, res, next) => {
  try {
    const { username, pin, isAdmin } = req.body || {};
    if (!username || !pin) return res.status(400).json({ error: 'username and pin required' });
    const exists = db().get('users').find({ username }).value();
    if (exists) return res.status(409).json({ error: 'username exists' });
    const user = {
      id: `u-${Date.now()}`,
      username,
      pinHash: bcrypt.hashSync(String(pin), 10),
      isAdmin: !!isAdmin,
    };
    db().get('users').push(user).write();
    return res.status(201).json(safePickUser(user));
  } catch (e) {
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

server.patch('/users/:id', (req, res) => {
  const id = req.params.id;
  const curr = db().get('users').find({ id }).value();
  if (!curr) return res.status(404).json({ error: 'Not found' });
  const changes = { ...req.body };
  if (changes.pin) {
    changes.pinHash = bcrypt.hashSync(String(changes.pin), 10);
    delete changes.pin;
  }
  const updated = db().get('users').find({ id }).assign(changes).write();
  return res.json(safePickUser(updated));
});

// Attach router after authz and custom handlers
server.use(router);

// After router: keep default render
router.render = (req, res) => {
  res.jsonp(res.locals.data);
};

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API running on http://localhost:${PORT}`);
});
