'use strict';

// Получаем ID новости из URL
const urlParams = new URLSearchParams(window.location.search);
const newsId = urlParams.get('id');

async function loadNews() {
    if (!newsId) {
        document.getElementById('news-detail').innerHTML = '<p class="no-news">Новость не найдена</p>';
        return;
    }

    try {
        // Загружаем новость
        const response = await fetch(`/api/news/${newsId}`);
        if (!response.ok) throw new Error('Failed to fetch news');
        
        const news = await response.json();
        displayNews(news);

    } catch (error) {
        console.error('Error loading news:', error);
        document.getElementById('news-detail').innerHTML = '<p class="no-news">Ошибка загрузки новости</p>';
    }
}

function displayNews(news) {
    const container = document.getElementById('news-detail');
    
    const date = new Date(news.date).toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Обрабатываем контент - если это массив, объединяем в параграфы
    let contentHTML = '';
    if (Array.isArray(news.content)) {
        contentHTML = news.content.map(paragraph => `<p>${paragraph}</p>`).join('');
    } else {
        contentHTML = `<p>${news.content}</p>`;
    }

    const html = `
        <a href="javascript:history.back()" class="back-link">← Назад</a>
        ${news.image ? `<img src="${news.image}" alt="${news.title}" class="news-detail__pic">` : ''}
        <h1 class="news-detail__title">${news.title}</h1>
        <p class="news-detail__date"><time datetime="${news.date}">${date}</time></p>
        ${news.lead ? `<p class="news-detail__lead">${news.lead}</p>` : ''}
        <div class="news-detail__content">
            ${contentHTML}
        </div>
    `;

    container.innerHTML = html;
    document.title = `${news.title} - MNnews`;
}

// Загружаем новость при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNews);
} else {
    loadNews();
}
