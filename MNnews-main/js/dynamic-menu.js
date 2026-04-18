'use strict';

async function loadDynamicMenu() {
    const submenu = document.querySelector('.sub-menu');
    if (!submenu) return;

    try {
        const response = await fetch('/api/categories');
        if (!response.ok) {
            throw new Error('Failed to fetch categories');
        }

        const categories = await response.json();
        
        // Определяем текущую страницу
        const currentPage = window.location.pathname;
        
        // Формируем меню
        let menuHTML = '';
        
        for (const cat of categories) {
            let link;
            
            if (cat.id === 'current') {
                link = '../index.html';
            } else {
                // Используем универсальную страницу категории
                link = `category.html?id=${cat.id}`;
            }
            
            const currentPage = window.location.pathname;
            const isActive = currentPage.includes(`id=${cat.id}`) || 
                           (cat.id === 'current' && (currentPage.endsWith('index.html') || currentPage.endsWith('/')));
            const activeClass = isActive ? ' style="background: color-mix(in srgb, var(--accent) 30%, var(--card));"' : '';
            
            menuHTML += `<li class="sub-menu__item"${activeClass}><a href="${link}">${cat.name}</a></li>`;
        }
        
        submenu.innerHTML = menuHTML;
    } catch (error) {
        console.error('Error loading dynamic menu:', error);
        // Оставляем статическое меню в случае ошибки
    }
}

// Загружаем меню при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDynamicMenu);
} else {
    loadDynamicMenu();
}
