'use strict';

function formatDate(isoDate) {
    const date = new Date(isoDate);
    return date.toLocaleDateString('ru-RU');
}

function getDetailLink(id) {
    if (window.location.pathname.includes('/pages/')) {
        return `News/detail.html?id=${id}`;
    }

    return `pages/News/detail.html?id=${id}`;
}

function renderNewsCards(container, items) {
    container.innerHTML = '';

    if (!items.length) {
        container.innerHTML = '<p class="col-1-of-3__p">Новостей пока нет.</p>';
        return;
    }

    for (const item of items) {
        const link = document.createElement('a');
        link.className = 'news-card-link';
        link.href = getDetailLink(item.id);

        link.innerHTML = `
            <article class="col-1-of-3">
                <img src="${item.image}" alt="${item.title}" class="col-1-of-3__pic">
                <h2 class="col-1-of-3__h1">${item.title}</h2>
                <p class="col-1-of-3__p">${item.preview}</p>
                <p class="date">Дата: ${formatDate(item.date)}</p>
            </article>
        `;

        container.appendChild(link);
    }
}

async function initNewsList() {
    const container = document.getElementById('newsList');
    if (!container) {
        return;
    }

    const category = container.dataset.category;

    try {
        const url = category ? `/api/news?category=${encodeURIComponent(category)}` : '/api/news';
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Request failed');
        }

        const items = await response.json();
        renderNewsCards(container, items);
    } catch (error) {
        container.innerHTML = '<p class="col-1-of-3__p">Не удалось загрузить новости. Проверьте, что сервер запущен.</p>';
    }
}

initNewsList();
