'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.resolve(__dirname, '..');
const NEWS_FILE = path.join(ROOT_DIR, 'data', 'news.json');
const USERS_FILE = path.join(ROOT_DIR, 'data', 'users.json');

app.use(cors());
app.use(express.json());

async function readJson(filePath) {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const normalized = fileContent.replace(/^\uFEFF/, '');
    return JSON.parse(normalized);
}

async function writeJson(filePath, data) {
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
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
        status = isAdmin ? 'approved' : 'approved';
    }

    if (!['pending', 'approved', 'rejected'].includes(status)) {
        status = 'approved';
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

app.get('/api/health', (req, res) => {
    res.json({ ok: true, date: new Date().toISOString() });
});

app.get('/api/news', async (req, res) => {
    try {
        const items = await readNews();
        const { category } = req.query;

        if (category) {
            return res.json(items.filter((item) => item.category === category));
        }

        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read news data.' });
    }
});

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
        res.status(500).json({ error: 'Failed to read news data.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        const users = await readUsers();
        const user = users.find((item) => item.username === username);

        if (!user || !verifyPassword(password, user.passwordHash)) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        res.json(toPublicUser(user));
    } catch (error) {
        res.status(500).json({ error: 'Failed to login.' });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, email } = req.body || {};

        if (!username || !password || !email) {
            return res.status(400).json({ error: 'Username, password and email are required.' });
        }

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

        res.status(201).json(toPublicUser(nextUser));
    } catch (error) {
        res.status(500).json({ error: 'Failed to register.' });
    }
});

app.get('/api/auth/profile/:username', async (req, res) => {
    try {
        const users = await readUsers();
        const user = users.find((item) => item.username === req.params.username);

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json(toPublicUser(user));
    } catch (error) {
        res.status(500).json({ error: 'Failed to get profile.' });
    }
});

app.get('/api/auth/registration-requests', async (req, res) => {
    try {
        const actor = String(req.query.actor || '');
        const users = await readUsers();

        if (!ensureAdmin(users, actor)) {
            return res.status(403).json({ error: 'Only admin can view registration requests.' });
        }

        const requests = users
            .filter((user) => user.status === 'pending' && !user.isAdmin)
            .map((user) => ({
                username: user.username,
                email: user.email,
                status: user.status
            }));

        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load registration requests.' });
    }
});

app.post('/api/auth/registration-requests/:username/approve', async (req, res) => {
    try {
        const { actor } = req.body || {};
        const targetUsername = req.params.username;

        if (!actor) {
            return res.status(400).json({ error: 'Actor is required.' });
        }

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
        res.json(toPublicUser(target));
    } catch (error) {
        res.status(500).json({ error: 'Failed to approve registration request.' });
    }
});

app.post('/api/auth/registration-requests/:username/reject', async (req, res) => {
    try {
        const { actor } = req.body || {};
        const targetUsername = req.params.username;

        if (!actor) {
            return res.status(400).json({ error: 'Actor is required.' });
        }

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
        res.json(toPublicUser(target));
    } catch (error) {
        res.status(500).json({ error: 'Failed to reject registration request.' });
    }
});

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
        res.status(500).json({ error: 'Failed to create user.' });
    }
});

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

        target.profile = {
            ...target.profile,
            ...updates
        };

        await persistUsers(users);
        res.json(toPublicUser(target));
    } catch (error) {
        res.status(500).json({ error: 'Failed to update profile.' });
    }
});

// --- Управление новостями (Админ) ---

// Создание новости
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
        
        const newItem = {
            id: newId,
            title,
            content,
            image: image || '',
            date: new Date().toISOString(),
            category: 'current'
        };

        items.unshift(newItem);
        await writeJson(NEWS_FILE, items);
        res.status(201).json(newItem);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create news.' });
    }
});

// Редактирование новости
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

        items[index] = {
            ...items[index],
            title: title || items[index].title,
            content: content || items[index].content,
            image: image !== undefined ? image : items[index].image
        };

        await writeJson(NEWS_FILE, items);
        res.json(items[index]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update news.' });
    }
});

// Удаление новости
app.delete('/api/news/:id', async (req, res) => {
    try {
        const id = Number.parseInt(req.params.id, 10);
        const { actor } = req.query; // Получаем actor из query параметров для DELETE

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
        console.error(error);
        res.status(500).json({ error: 'Failed to delete news.' });
    }
});

app.use(express.static(ROOT_DIR));

app.get('*', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`MNnews server started: http://localhost:${PORT}`);
});
