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
            throw new Error('Request failed with status ' + response.status);
        }

        const items = await response.json();
        renderNewsCards(container, items);
        
        // Удаляем старое уведомление об обновлении, если оно есть
        const existingUpdate = container.parentElement.querySelector('.last-update');
        if (existingUpdate) {
            existingUpdate.remove();
        }
        
        // Добавляем информацию о последнем обновлении (только одну)
        const lastUpdate = document.createElement('p');
        lastUpdate.className = 'last-update';
        lastUpdate.style.cssText = 'text-align: right; color: #888; font-size: 0.85em; margin-top: 10px;';
        lastUpdate.textContent = `Обновлено: ${new Date().toLocaleTimeString('ru-RU')}`;
        container.parentElement.appendChild(lastUpdate);
        
    } catch (error) {
        console.error('Error loading news:', error);
        container.innerHTML = '<p class="col-1-of-3__p" style="color: #e74c3c;">Не удалось загрузить новости. Убедитесь, что сервер запущен (npm start в папке server).</p>';
    }
}

// Добавляем функцию для ручного обновления
window.refreshNews = async function() {
    const container = document.getElementById('newsList');
    if (container) {
        container.innerHTML = '<p class="col-1-of-3__p">Обновление...</p>';
        await initNewsList();
    }
};

initNewsList();
