'use strict';

function showLoginError(message) {
    const popup = document.getElementById('loginErrorPopup');
    const popupMessage = document.getElementById('popupMessage');
    const closeBtn = document.querySelector('.popup-close');

    popupMessage.textContent = message;
    popup.classList.add('popup-visible');

    closeBtn.onclick = function () {
        popup.classList.remove('popup-visible');
    };

    popup.onclick = function (event) {
        if (event.target === popup) {
            popup.classList.remove('popup-visible');
        }
    };
}

function setAuthMode(mode) {
    const loginBlock = document.getElementById('loginFormBlock');
    const registerBlock = document.getElementById('registerFormBlock');
    const showLoginBtn = document.getElementById('showLogin');
    const showRegisterBtn = document.getElementById('showRegister');

    if (!loginBlock || !registerBlock || !showLoginBtn || !showRegisterBtn) {
        return;
    }

    const loginActive = mode === 'login';
    loginBlock.style.display = loginActive ? 'block' : 'none';
    registerBlock.style.display = loginActive ? 'none' : 'block';
    showLoginBtn.classList.toggle('is-active', loginActive);
    showRegisterBtn.classList.toggle('is-active', !loginActive);
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json'
        },
        ...options
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || 'Server request failed.');
    }

    return data;
}

function getStatusText(status) {
    if (status === 'pending') {
        return 'Заявка на регистрацию ожидает подтверждения администратора.';
    }

    if (status === 'rejected') {
        return 'Заявка отклонена администратором. Обратитесь к команде сервера.';
    }

    return 'Профиль активен.';
}

function applyProfile(user) {
    const authColumns = document.querySelector('.columns');
    const playerCard = document.querySelector('.player-card');
    const adminPanel = document.querySelector('#admin_panel');
    const adminPanelCreate = document.querySelector('#admin_panel2');
    const requestsLink = document.querySelector('#requestsLink');

    if (authColumns) {
        authColumns.style.display = 'none';
    }

    if (playerCard) {
        playerCard.style.display = 'block';
    }

    const nameValue = document.querySelector('#name');
    const rankValue = document.querySelector('#rank');
    const reputationValue = document.querySelector('#rep');
    const clanValue = document.querySelector('#clan');
    const notesValue = document.querySelector('#profile-notes');

    if (nameValue) {
        nameValue.innerText = user.username;
    }

    const profile = user.profile;

    if (profile) {
        rankValue.innerText = profile.rank || '';
        reputationValue.innerText = String(profile.reputation ?? '');
        clanValue.innerText = profile.clan || '';
        notesValue.innerText = profile.notes || getStatusText(user.status);
    } else {
        rankValue.innerText = 'Профиль отсутствует';
        reputationValue.innerText = '-';
        clanValue.innerText = '-';
        notesValue.innerText = getStatusText(user.status);
    }

    const canUseAdminTools = Boolean(user.isAdmin && user.status === 'approved');

    if (adminPanel) {
        adminPanel.style.display = canUseAdminTools ? 'block' : 'none';
    }

    if (adminPanelCreate) {
        adminPanelCreate.style.display = canUseAdminTools ? 'block' : 'none';
    }

    if (requestsLink) {
        requestsLink.style.display = canUseAdminTools ? 'inline-block' : 'none';
    }
}

async function loadCurrentProfile() {
    const loginState = localStorage.getItem('login');
    const username = localStorage.getItem('name');

    if (loginState !== '1' || !username) {
        return;
    }

    try {
        const user = await requestJson(`/api/auth/profile/${encodeURIComponent(username)}`);
        localStorage.setItem('status', user.status || 'approved');
        localStorage.setItem('is_admin', user.isAdmin ? '1' : '0');
        applyProfile(user);
    } catch (error) {
        showLoginError('Не удалось загрузить профиль. Войдите заново.');
    }
}

function setupExitButton() {
    const exitButton = document.querySelector('#exit');
    const profileLogoutButton = document.querySelector('#profileLogoutBtn');

    function clearAuthSession() {
        localStorage.removeItem('login');
        localStorage.removeItem('name');
        localStorage.removeItem('is_admin');
        localStorage.removeItem('status');
    }

    const isLoggedIn = localStorage.getItem('login') === '1';

    if (exitButton) {
        exitButton.style.display = isLoggedIn ? 'inline-block' : 'none';
    }

    if (profileLogoutButton) {
        profileLogoutButton.style.display = isLoggedIn ? 'inline-block' : 'none';
    }

    if (exitButton) {
        exitButton.addEventListener('click', function (event) {
            event.preventDefault();
            clearAuthSession();
            location.reload();
        });
    }

    if (profileLogoutButton) {
        profileLogoutButton.addEventListener('click', function () {
            clearAuthSession();
            location.reload();
        });
    }
}

function setupLoginForm() {
    const form = document.querySelector('#login');

    if (!form) {
        return;
    }

    form.addEventListener('submit', async function (event) {
        event.preventDefault();

        const data = new FormData(form);
        const username = String(data.get('us') || '').trim();
        const password = String(data.get('password') || '');

        try {
            const user = await requestJson('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            localStorage.setItem('name', user.username);
            localStorage.setItem('login', '1');
            localStorage.setItem('is_admin', user.isAdmin ? '1' : '0');
            localStorage.setItem('status', user.status || 'approved');
            location.reload();
        } catch (error) {
            showLoginError(error.message || 'Неверные данные');
        }
    });
}

function setupRegisterForm() {
    const registerForm = document.querySelector('#registerForm');

    if (!registerForm) {
        return;
    }

    registerForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const data = new FormData(registerForm);
        const username = String(data.get('username') || '').trim();
        const email = String(data.get('us') || '').trim();
        const password = String(data.get('password') || '');
        const passwordRepeat = String(data.get('password-repeat') || '');

        if (password !== passwordRepeat) {
            showLoginError('Пароли не совпадают.');
            return;
        }

        try {
            const user = await requestJson('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, email, password })
            });

            localStorage.setItem('name', user.username);
            localStorage.setItem('login', '1');
            localStorage.setItem('is_admin', '0');
            localStorage.setItem('status', user.status || 'pending');
            location.reload();
        } catch (error) {
            showLoginError(error.message || 'Ошибка регистрации.');
        }
    });
}

function setupAdminPanels() {
    const adminPanel = document.querySelector('#admin_panel');
    const adminPanelCreate = document.querySelector('#admin_panel2');

    if (adminPanel) {
        adminPanel.addEventListener('submit', async function (event) {
            event.preventDefault();

            const actor = localStorage.getItem('name');
            const data = new FormData(adminPanel);

            const targetUsername = String(data.get('plname') || '').trim();
            const updates = {};

            const rank = String(data.get('position') || '').trim();
            const reputation = String(data.get('reputation') || '').trim();
            const clan = String(data.get('guild') || '').trim();
            const notes = String(data.get('notes') || '').trim();

            if (rank) {
                updates.rank = rank;
            }

            if (reputation) {
                updates.reputation = Number.parseInt(reputation, 10);
            }

            if (clan) {
                updates.clan = clan;
            }

            if (notes) {
                updates.notes = notes;
            }

            if (!targetUsername || Object.keys(updates).length === 0) {
                showLoginError('Заполните ник и хотя бы одно поле для изменения.');
                return;
            }

            try {
                await requestJson(`/api/auth/profile/${encodeURIComponent(targetUsername)}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ actor, updates })
                });

                showLoginError('Профиль успешно обновлён.');
                adminPanel.reset();
            } catch (error) {
                showLoginError(error.message || 'Не удалось обновить профиль.');
            }
        });
    }

    if (adminPanelCreate) {
        adminPanelCreate.addEventListener('submit', async function (event) {
            event.preventDefault();

            const actor = localStorage.getItem('name');
            const data = new FormData(adminPanelCreate);

            const username = String(data.get('new_plname') || '').trim();
            const password = String(data.get('new_password') || '').trim();

            if (!username || !password) {
                showLoginError('Введите никнейм и пароль.');
                return;
            }

            try {
                await requestJson('/api/auth/users', {
                    method: 'POST',
                    body: JSON.stringify({ actor, username, password })
                });

                showLoginError('Аккаунт успешно создан.');
                adminPanelCreate.reset();
            } catch (error) {
                showLoginError(error.message || 'Не удалось создать аккаунт.');
            }
        });
    }
}

function setupAuthSwitch() {
    const loginBtn = document.getElementById('showLogin');
    const registerBtn = document.getElementById('showRegister');

    if (!loginBtn || !registerBtn) {
        return;
    }

    loginBtn.addEventListener('click', function () {
        setAuthMode('login');
    });

    registerBtn.addEventListener('click', function () {
        setAuthMode('register');
    });
}

setupAuthSwitch();
setupExitButton();
setupLoginForm();
setupRegisterForm();
setupAdminPanels();
loadCurrentProfile();
