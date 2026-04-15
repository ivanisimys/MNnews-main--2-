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

    // Проверяем, является ли пользователь администратором
    const isAdmin = localStorage.getItem('is_admin') === '1';
    const adminButtons = isAdmin ? `
        <div style="margin-top: 20px; padding: 15px; background: #2a2a2a; border-radius: 5px; text-align: center;">
            <p style="color: #aaa; margin-bottom: 10px;">Панель администратора</p>
            <button onclick="editCurrentNews(${item.id})" 
                    style="padding: 10px 20px; background: #f39c12; color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px; font-weight: bold;"
                    onmouseover="this.style.background='#e67e22'" 
                    onmouseout="this.style.background='#f39c12'">
                ✏️ Редактировать новость
            </button>
            <button onclick="deleteCurrentNews(${item.id})" 
                    style="padding: 10px 20px; background: #e74c3c; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;"
                    onmouseover="this.style.background='#c0392b'" 
                    onmouseout="this.style.background='#e74c3c'">
                🗑️ Удалить новость
            </button>
        </div>
    ` : '';

    root.innerHTML = `
        <a class="back-link" href="${getBackLinkByCategory(item.category)}">← Вернуться к списку новостей</a>
        <h1 class="news-detail__title">${item.title}</h1>
        <p class="news-detail__lead">${item.lead}</p>
        <img src="${item.image || 'https://placehold.co/960x540?text=MN+News+Detail'}" alt="${item.title}" class="news-detail__pic" style="max-width: 100%; height: auto; margin: 20px 0;">
        ${paragraphs}
        <p class="date">Дата публикации: ${formatDate(item.date)}</p>
        ${adminButtons}
    `;
}

// Функция редактирования текущей новости
window.editCurrentNews = function(id) {
    // Перенаправляем в админ-панель с открытым редактором
    window.location.href = `/pages/menu_pages/admin_panel.html?edit=${id}`;
};

// Функция удаления текущей новости
window.deleteCurrentNews = async function(id) {
    if (!confirm('Вы уверены, что хотите удалить эту новость? Это действие нельзя отменить.')) {
        return;
    }
    
    const username = localStorage.getItem('name');
    try {
        const response = await fetch(`/api/news/${id}?actor=${encodeURIComponent(username)}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('Новость успешно удалена');
            // Возвращаемся на главную страницу
            window.location.href = '/index.html';
        } else {
            const error = await response.json();
            alert('Ошибка удаления: ' + (error.error || 'Неизвестная ошибка'));
        }
    } catch (err) {
        console.error(err);
        alert('Ошибка при удалении новости');
    }
};

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
