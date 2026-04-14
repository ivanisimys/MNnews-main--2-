'use strict';

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

function renderMessage(root, text) {
    root.innerHTML = `<p class="col-1-of-3__p">${text}</p>`;
}

function renderRequests(root, requests, actor) {
    if (!requests.length) {
        renderMessage(root, 'Новых заявок нет.');
        return;
    }

    const items = requests.map((request) => {
        return `
            <article class="col-1-of-3" style="max-width:100%; margin-bottom: 12px;">
                <h2 class="col-1-of-3__h1">${request.username}</h2>
                <p class="col-1-of-3__p">Email: ${request.email || 'не указан'}</p>
                <p class="date">Статус: ${request.status}</p>
                <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="approve-btn" data-username="${request.username}" type="button" style="max-width:220px;">Принять</button>
                    <button class="reject-btn" data-username="${request.username}" type="button" style="max-width:220px; background:#9b3c4a;">Отклонить</button>
                </div>
            </article>
        `;
    }).join('');

    root.innerHTML = items;

    const approveButtons = root.querySelectorAll('.approve-btn');
    const rejectButtons = root.querySelectorAll('.reject-btn');

    for (const button of approveButtons) {
        button.addEventListener('click', async function () {
            const username = button.getAttribute('data-username');
            try {
                await requestJson(`/api/auth/registration-requests/${encodeURIComponent(username)}/approve`, {
                    method: 'POST',
                    body: JSON.stringify({ actor })
                });
                await loadRequests();
            } catch (error) {
                alert(error.message);
            }
        });
    }

    for (const button of rejectButtons) {
        button.addEventListener('click', async function () {
            const username = button.getAttribute('data-username');
            try {
                await requestJson(`/api/auth/registration-requests/${encodeURIComponent(username)}/reject`, {
                    method: 'POST',
                    body: JSON.stringify({ actor })
                });
                await loadRequests();
            } catch (error) {
                alert(error.message);
            }
        });
    }
}

async function loadRequests() {
    const root = document.getElementById('requestsRoot');

    if (!root) {
        return;
    }

    const actor = localStorage.getItem('name');
    const isAdmin = localStorage.getItem('is_admin') === '1';

    if (!actor || !isAdmin) {
        renderMessage(root, 'Доступ запрещён. Эта страница доступна только администраторам.');
        return;
    }

    try {
        const requests = await requestJson(`/api/auth/registration-requests?actor=${encodeURIComponent(actor)}`);
        renderRequests(root, requests, actor);
    } catch (error) {
        renderMessage(root, error.message || 'Не удалось загрузить заявки.');
    }
}

loadRequests();
