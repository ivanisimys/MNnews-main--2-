'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT_DIR, 'data');
const NEWS_FILE = path.join(DATA_DIR, 'news.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Логирование запросов для отладки
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.body && Object.keys(req.body).length > 0) {
        console.log('Body:', JSON.stringify(req.body, null, 2).substring(0, 200));
    }
    next();
});

// Проверка и создание директории data при необходимости
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
        console.log('✓ Data directory exists:', DATA_DIR);
    } catch (error) {
        console.log('Creating data directory:', DATA_DIR);
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

// Проверка существования файлов данных
async function ensureDataFiles() {
    const files = [
        { path: NEWS_FILE, default: [] },
        { path: USERS_FILE, default: [] }
    ];

    for (const file of files) {
        try {
            await fs.access(file.path);
            console.log('✓ File exists:', path.basename(file.path));
        } catch (error) {
            console.log('Creating file:', path.basename(file.path));
            await fs.writeFile(file.path, JSON.stringify(file.default, null, 2), 'utf-8');
        }
    }
}

async function readJson(filePath) {
    try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const normalized = fileContent.replace(/^\uFEFF/, '');
        return JSON.parse(normalized);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
        throw new Error(`Failed to read ${path.basename(filePath)}`);
    }
}

async function writeJson(filePath, data) {
    try {
        // Создаем временный файл для атомарной записи
        const tempFile = filePath + '.tmp';
        await fs.writeFile(tempFile, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
        await fs.rename(tempFile, filePath);
        console.log('✓ Successfully wrote:', path.basename(filePath));
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error.message);
        throw new Error(`Failed to write ${path.basename(filePath)}`);
    }
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
    if (!stored || typeof stored !== 'string') {
        return false;
    }

    const [scheme, salt, originalHash] = stored.split(':');
    if (scheme !== 'scrypt' || !salt || !originalHash) {
        return false;
    }

    const candidateHash = crypto.scryptSync(password, salt, 64).toString('hex');
    const originalBuffer = Buffer.from(originalHash, 'hex');
    const candidateBuffer = Buffer.from(candidateHash, 'hex');

    if (originalBuffer.length !== candidateBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(originalBuffer, candidateBuffer);
}

function normalizeUser(raw) {
    const username = String(raw?.username || '').trim();
    const isAdmin = Boolean(raw?.isAdmin);

    let status = String(raw?.status || '').toLowerCase();
    if (!status) {
        status = isAdmin ? 'approved' : 'pending';
    }

    if (!['pending', 'approved', 'rejected'].includes(status)) {
        status = 'pending';
    }

    if (isAdmin) {
        status = 'approved';
    }

    const normalized = {
        username,
        passwordHash: String(raw?.passwordHash || ''),
        email: String(raw?.email || ''),
        isAdmin,
        status,
        profile: null
    };

    if (!normalized.passwordHash) {
        const legacyPassword = String(raw?.password || '');
        if (legacyPassword) {
            normalized.passwordHash = hashPassword(legacyPassword);
        } else {
            normalized.passwordHash = hashPassword(crypto.randomBytes(8).toString('hex'));
        }
    }

    if (status === 'approved') {
        normalized.profile = {
            rank: raw?.profile?.rank || (isAdmin ? 'Администратор' : 'Игрок'),
            reputation: Number.isFinite(Number(raw?.profile?.reputation)) ? Number(raw.profile.reputation) : (isAdmin ? 100 : 1),
            clan: raw?.profile?.clan || (isAdmin ? 'MN Staff' : 'Без гильдии'),
            notes: raw?.profile?.notes || (isAdmin ? 'Полный доступ к админ-панели' : 'Профиль активен')
        };
    }

    return normalized;
}

async function readNews() {
    return readJson(NEWS_FILE);
}

async function readUsers() {
    const users = await readJson(USERS_FILE);
    const hadLegacyPasswords = users.some((user) => Object.prototype.hasOwnProperty.call(user, 'password'));
    const normalizedUsers = users.map(normalizeUser);

    if (hadLegacyPasswords) {
        await writeJson(USERS_FILE, normalizedUsers);
    }

    return normalizedUsers;
}

async function persistUsers(users) {
    await writeJson(USERS_FILE, users.map(normalizeUser));
}

function toPublicUser(user) {
    return {
        username: user.username,
        email: user.email,
        isAdmin: Boolean(user.isAdmin),
        status: user.status,
        hasProfile: Boolean(user.profile),
        profile: user.profile
    };
}

function ensureAdmin(users, username) {
    const actor = users.find((user) => user.username === username);
    return Boolean(actor && actor.isAdmin && actor.status === 'approved');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        ok: true, 
        date: new Date().toISOString(),
        platform: process.platform,
        nodeVersion: process.version,
        cwd: process.cwd(),
        dataDir: DATA_DIR
    });
});

// Get all news
app.get('/api/news', async (req, res) => {
    try {
        const items = await readNews();
        const { category } = req.query;

        if (category) {
            return res.json(items.filter((item) => item.category === category));
        }

        res.json(items);
    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).json({ error: 'Failed to read news data.' });
    }
});

// Get single news item
app.get('/api/news/:id', async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        const items = await readNews();
        const item = items.find((news) => news.id === id);

        if (!item) {
            return res.status(404).json({ error: 'News item not found.' });
        }

        res.json(item);
    } catch (error) {
        console.error('Error fetching news item:', error);
        res.status(500).json({ error: 'Failed to read news data.' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        console.log(`Login attempt for user: ${username}`);
        
        const users = await readUsers();
        const user = users.find((item) => item.username === username);

        if (!user) {
            console.log(`User not found: ${username}`);
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const isValid = verifyPassword(password, user.passwordHash);
        console.log(`Password validation for ${username}: ${isValid}`);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        console.log(`Successful login: ${username}`);
        res.json(toPublicUser(user));
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login.' });
    }
});

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, email } = req.body || {};

        if (!username || !password || !email) {
            return res.status(400).json({ error: 'Username, password and email are required.' });
        }

        console.log(`Registration attempt: ${username} (${email})`);

        const users = await readUsers();
        const normalizedUsername = String(username).trim().toLowerCase();
        const normalizedEmail = String(email).trim().toLowerCase();

        const existingByUsername = users.find(
            (user) => String(user.username || '').trim().toLowerCase() === normalizedUsername
        );

        if (existingByUsername) {
            if (existingByUsername.status === 'pending') {
                return res.status(409).json({ error: 'Заявка с таким никнеймом уже отправлена и ожидает решения.' });
            }

            if (existingByUsername.status === 'approved') {
                return res.status(409).json({ error: 'Пользователь с таким никнеймом уже зарегистрирован.' });
            }

            return res.status(409).json({ error: 'Заявка с таким никнеймом уже была отклонена. Обратитесь к администратору.' });
        }

        const existingByEmail = users.find(
            (user) => String(user.email || '').trim().toLowerCase() === normalizedEmail
        );

        if (existingByEmail) {
            if (existingByEmail.status === 'pending') {
                return res.status(409).json({ error: 'Заявка с таким email уже отправлена и ожидает решения.' });
            }

            if (existingByEmail.status === 'approved') {
                return res.status(409).json({ error: 'Аккаунт с таким email уже существует.' });
            }

            return res.status(409).json({ error: 'Заявка с таким email уже была отклонена. Обратитесь к администратору.' });
        }

        const nextUser = normalizeUser({
            username,
            passwordHash: hashPassword(password),
            email,
            isAdmin: false,
            status: 'pending',
            profile: null
        });

        users.push(nextUser);
        await persistUsers(users);

        console.log(`Registration successful: ${username} (status: pending)`);
        res.status(201).json(toPublicUser(nextUser));
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register.' });
    }
});

// Get user profile
app.get('/api/auth/profile/:username', async (req, res) => {
    try {
        const users = await readUsers();
        const user = users.find((item) => item.username === req.params.username);

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json(toPublicUser(user));
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Failed to get profile.' });
    }
});

// Get registration requests (admin only)
app.get('/api/auth/registration-requests', async (req, res) => {
    try {
        const actor = String(req.query.actor || '');
        
        if (!actor) {
            return res.status(400).json({ error: 'Actor parameter is required.' });
        }

        console.log(`Fetching registration requests for actor: ${actor}`);
        
        const users = await readUsers();

        if (!ensureAdmin(users, actor)) {
            console.log(`Unauthorized access attempt by: ${actor}`);
            return res.status(403).json({ error: 'Only admin can view registration requests.' });
        }

        const requests = users
            .filter((user) => user.status === 'pending' && !user.isAdmin)
            .map((user) => ({
                username: user.username,
                email: user.email,
                status: user.status
            }));

        console.log(`Found ${requests.length} pending requests`);
        res.json(requests);
    } catch (error) {
        console.error('Error fetching registration requests:', error);
        res.status(500).json({ error: 'Failed to load registration requests.' });
    }
});

// Approve registration request
app.post('/api/auth/registration-requests/:username/approve', async (req, res) => {
    try {
        const { actor } = req.body || {};
        const targetUsername = req.params.username;

        if (!actor) {
            return res.status(400).json({ error: 'Actor is required.' });
        }

        console.log(`Approving request for ${targetUsername} by ${actor}`);

        const users = await readUsers();

        if (!ensureAdmin(users, actor)) {
            return res.status(403).json({ error: 'Only admin can approve requests.' });
        }

        const target = users.find((user) => user.username === targetUsername);

        if (!target) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (target.status !== 'pending') {
            return res.status(400).json({ error: 'Only pending requests can be approved.' });
        }

        target.status = 'approved';
        target.profile = {
            rank: 'Игрок',
            reputation: 1,
            clan: 'Без гильдии',
            notes: 'Профиль активирован после одобрения заявки'
        };

        await persistUsers(users);
        console.log(`Request approved for: ${targetUsername}`);
        res.json(toPublicUser(target));
    } catch (error) {
        console.error('Error approving request:', error);
        res.status(500).json({ error: 'Failed to approve registration request.' });
    }
});

// Reject registration request
app.post('/api/auth/registration-requests/:username/reject', async (req, res) => {
    try {
        const { actor } = req.body || {};
        const targetUsername = req.params.username;

        if (!actor) {
            return res.status(400).json({ error: 'Actor is required.' });
        }

        console.log(`Rejecting request for ${targetUsername} by ${actor}`);

        const users = await readUsers();

        if (!ensureAdmin(users, actor)) {
            return res.status(403).json({ error: 'Only admin can reject requests.' });
        }

        const target = users.find((user) => user.username === targetUsername);

        if (!target) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (target.status !== 'pending') {
            return res.status(400).json({ error: 'Only pending requests can be rejected.' });
        }

        target.status = 'rejected';
        target.profile = null;

        await persistUsers(users);
        console.log(`Request rejected for: ${targetUsername}`);
        res.json(toPublicUser(target));
    } catch (error) {
        console.error('Error rejecting request:', error);
        res.status(500).json({ error: 'Failed to reject registration request.' });
    }
});

// Create user (admin only)
app.post('/api/auth/users', async (req, res) => {
    try {
        const { actor, username, password } = req.body || {};

        if (!actor || !username || !password) {
            return res.status(400).json({ error: 'Actor, username and password are required.' });
        }

        const users = await readUsers();

        if (!ensureAdmin(users, actor)) {
            return res.status(403).json({ error: 'Only admin can create users.' });
        }

        const exists = users.some((user) => user.username.toLowerCase() === String(username).toLowerCase());
        if (exists) {
            return res.status(409).json({ error: 'User already exists.' });
        }

        users.push(normalizeUser({
            username,
            passwordHash: hashPassword(password),
            email: '',
            isAdmin: false,
            status: 'approved',
            profile: {
                rank: 'Игрок',
                reputation: 1,
                clan: 'Без гильдии',
                notes: 'Создано администратором'
            }
        }));

        await persistUsers(users);
        res.status(201).json({ ok: true });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user.' });
    }
});

// Update user profile (admin only)
app.patch('/api/auth/profile/:username', async (req, res) => {
    try {
        const { actor, updates } = req.body || {};

        if (!actor || !updates || typeof updates !== 'object') {
            return res.status(400).json({ error: 'Actor and updates are required.' });
        }

        const users = await readUsers();

        if (!ensureAdmin(users, actor)) {
            return res.status(403).json({ error: 'Only admin can edit profiles.' });
        }

        const target = users.find((user) => user.username === req.params.username);
        if (!target) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (target.status !== 'approved') {
            return res.status(400).json({ error: 'Profile can be edited only for approved users.' });
        }

        const profileUpdates = {
            ...updates
        };

        let hasAdminUpdate = false;
        let nextAdminValue = false;
        if (Object.prototype.hasOwnProperty.call(profileUpdates, 'isAdmin')) {
            if (typeof profileUpdates.isAdmin !== 'boolean') {
                return res.status(400).json({ error: 'isAdmin must be a boolean.' });
            }
            hasAdminUpdate = true;
            nextAdminValue = profileUpdates.isAdmin;
            delete profileUpdates.isAdmin;
        }

        if (Object.keys(profileUpdates).length === 0 && !hasAdminUpdate) {
            return res.status(400).json({ error: 'No valid updates were provided.' });
        }

        if (hasAdminUpdate && target.isAdmin && !nextAdminValue) {
            if (actor === target.username) {
                return res.status(400).json({ error: 'You cannot remove admin rights from your own account.' });
            }

            const approvedAdminsCount = users.filter((user) => user.isAdmin && user.status === 'approved').length;
            if (approvedAdminsCount <= 1) {
                return res.status(400).json({ error: 'Cannot remove admin rights from the last administrator.' });
            }
        }

        target.profile = {
            ...target.profile,
            ...profileUpdates
        };

        if (hasAdminUpdate) {
            target.isAdmin = nextAdminValue;

            if (!Object.prototype.hasOwnProperty.call(profileUpdates, 'rank')) {
                if (nextAdminValue && target.profile.rank === 'Игрок') {
                    target.profile.rank = 'Администратор';
                }

                if (!nextAdminValue && target.profile.rank === 'Администратор') {
                    target.profile.rank = 'Игрок';
                }
            }
        }

        await persistUsers(users);
        res.json(toPublicUser(target));
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});

// --- News Management (Admin) ---

// Create news
app.post('/api/news', async (req, res) => {
    try {
        const { title, content, image, actor } = req.body || {};
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required.' });
        }

        const users = await readUsers();
        if (!ensureAdmin(users, actor)) {
            return res.status(403).json({ error: 'Only admin can create news.' });
        }

        const items = await readNews();
        const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
        
        let processedContent = content;
        if (typeof content === 'string') {
            processedContent = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        }
        
        const newItem = {
            id: newId,
            title,
            content: processedContent,
            image: image || '',
            date: new Date().toISOString(),
            category: 'current',
            preview: typeof content === 'string' ? content.substring(0, 150) + '...' : (Array.isArray(content) ? content[0] : ''),
            lead: typeof content === 'string' ? content.substring(0, 200) : (Array.isArray(content) ? content[0] : '')
        };

        items.unshift(newItem);
        await writeJson(NEWS_FILE, items);
        res.status(201).json(newItem);
    } catch (error) {
        console.error('Error creating news:', error);
        res.status(500).json({ error: 'Failed to create news.' });
    }
});

// Update news
app.put('/api/news/:id', async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        const { title, content, image, actor } = req.body || {};

        const users = await readUsers();
        if (!ensureAdmin(users, actor)) {
            return res.status(403).json({ error: 'Only admin can edit news.' });
        }

        const items = await readNews();
        const index = items.findIndex(n => n.id === id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'News not found.' });
        }

        let processedContent = content;
        if (typeof content === 'string') {
            processedContent = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        }

        items[index] = {
            ...items[index],
            title: title || items[index].title,
            content: processedContent || items[index].content,
            image: image !== undefined ? image : items[index].image,
            date: new Date().toISOString()
        };

        await writeJson(NEWS_FILE, items);
        res.json(items[index]);
    } catch (error) {
        console.error('Error updating news:', error);
        res.status(500).json({ error: 'Failed to update news.' });
    }
});

// Delete news
app.delete('/api/news/:id', async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        const { actor } = req.query;

        const users = await readUsers();
        if (!ensureAdmin(users, actor)) {
            return res.status(403).json({ error: 'Only admin can delete news.' });
        }

        let items = await readNews();
        const initialLength = items.length;
        items = items.filter(n => n.id !== id);

        if (items.length === initialLength) {
            return res.status(404).json({ error: 'News not found.' });
        }

        await writeJson(NEWS_FILE, items);
        res.json({ message: 'Deleted' });
    } catch (error) {
        console.error('Error deleting news:', error);
        res.status(500).json({ error: 'Failed to delete news.' });
    }
});

// Serve static files
app.use(express.static(ROOT_DIR));

// Handle SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

// Start server with better error handling
async function startServer() {
    try {
        console.log('='.repeat(80));
        console.log('Starting MNnews server...');
        console.log('='.repeat(80));
        
        // Ensure data directory and files exist
        await ensureDataDir();
        await ensureDataFiles();
        
        // Check file permissions
        console.log('\nChecking file permissions...');
        try {
            await fs.access(DATA_DIR, fsSync.constants.R_OK | fsSync.constants.W_OK);
            console.log('✓ Data directory is readable and writable');
        } catch (error) {
            console.error('✗ Data directory permission issue:', error.message);
            console.error('Please run: chmod -R 755', DATA_DIR);
            console.error('And: chown -R $USER:$USER', DATA_DIR);
        }
        
        console.log('\nServer configuration:');
        console.log('  Platform:', process.platform);
        console.log('  Node version:', process.version);
        console.log('  Port:', PORT);
        console.log('  Root directory:', ROOT_DIR);
        console.log('  Data directory:', DATA_DIR);
        console.log('='.repeat(80));
        
        app.listen(PORT, () => {
            console.log(`\n✓ Server is running on http://localhost:${PORT}`);
            console.log('✓ Press Ctrl+C to stop the server\n');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
