'use strict';

// Получаем ID категории из URL
const urlParams = new URLSearchParams(window.location.search);
const categoryId = urlParams.get('id');

async function loadCategory() {
    if (!categoryId) {
        document.getElementById('category-title').textContent = 'Категория не найдена';
        return;
    }

    try {
        // Загружаем информацию о категории
        const catResponse = await fetch('/api/categories');
        if (!catResponse.ok) throw new Error('Failed to fetch categories');
        
        const categories = await catResponse.json();
        const category = categories.find(c => c.id === categoryId);
        
        if (!category) {
            document.getElementById('category-title').textContent = 'Категория не найдена';
            return;
        }

        // Обновляем заголовок и описание
        document.getElementById('category-title').textContent = category.name;
        document.getElementById('category-description').textContent = category.description || '';
        document.title = `${category.name} - MNnews`;

        // Загружаем новости категории
        const newsResponse = await fetch(`/api/news?category=${categoryId}`);
        if (!newsResponse.ok) throw new Error('Failed to fetch news');
        
        const news = await newsResponse.json();
        displayNews(news, categoryId);

    } catch (error) {
        console.error('Error loading category:', error);
        document.getElementById('category-title').textContent = 'Ошибка загрузки';
    }
}

function displayNews(news, categoryId) {
    const container = document.getElementById('news-container');
    
    if (!news || news.length === 0) {
        container.innerHTML = '<p class="no-news">В этой категории пока нет новостей</p>';
        return;
    }

    let html = '';
    
    for (const item of news) {
        const date = new Date(item.date).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        html += `
            <article class="news-card">
                ${item.image ? `<img src="${item.image}" alt="${item.title}" class="news-card__image">` : ''}
                <div class="news-card__content">
                    <h3 class="news-card__title">${item.title}</h3>
                    <p class="news-card__date">${date}</p>
                    <p class="news-card__excerpt">${item.excerpt || item.text.substring(0, 150)}...</p>
                    <a href="news.html?id=${item.id}" class="news-card__link">Читать далее →</a>
                </div>
            </article>
        `;
    }

    container.innerHTML = html;
}

// Загружаем категорию при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadCategory);
} else {
    loadCategory();
}
