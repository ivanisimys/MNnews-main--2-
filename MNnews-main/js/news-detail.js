'use strict';

function formatDate(isoDate) {
    const date = new Date(isoDate);
    return date.toLocaleDateString('ru-RU');
}

function getQueryId() {
    const params = new URLSearchParams(window.location.search);
    return Number.parseInt(params.get('id') || '', 10);
}

function getBackLinkByCategory(category) {
    if (category === 'archive1') {
        return '../news_archive1.html';
    }

    if (category === 'archive2') {
        return '../news_archive2.html';
    }

    return '../../index.html';
}

function renderNewsDetail(item) {
    const root = document.getElementById('newsDetail');
    if (!root) {
        return;
    }

    const paragraphs = (item.content || [])
        .map((text) => `<p class="col-1-of-3__p">${text}</p>`)
        .join('');

    root.innerHTML = `
        <a class="back-link" href="${getBackLinkByCategory(item.category)}">← Вернуться к списку новостей</a>
        <h1 class="news-detail__title">${item.title}</h1>
        <p class="news-detail__lead">${item.lead}</p>
        <img src="https://placehold.co/960x540?text=MN+News+Detail" alt="${item.title}" class="news-detail__pic">
        ${paragraphs}
        <p class="date">Дата публикации: ${formatDate(item.date)}</p>
    `;
}

async function initNewsDetail() {
    const root = document.getElementById('newsDetail');
    if (!root) {
        return;
    }

    const id = getQueryId();
    if (!id) {
        root.innerHTML = '<p class="col-1-of-3__p">Некорректный ID новости.</p>';
        return;
    }

    try {
        const response = await fetch(`/api/news/${id}`);
        if (!response.ok) {
            throw new Error('Request failed');
        }

        const item = await response.json();
        renderNewsDetail(item);
    } catch (error) {
        root.innerHTML = '<p class="col-1-of-3__p">Не удалось загрузить новость. Проверьте, что сервер запущен.</p>';
    }
}

initNewsDetail();
