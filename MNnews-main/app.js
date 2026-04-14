'use strict';

const THEME_KEY = 'mnnews_theme';

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

function getInitialTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getThemeToggleText(theme) {
    return theme === 'dark' ? 'Светлая тема' : 'Тёмная тема';
}

function ensureThemeToggle() {
    const menu = document.querySelector('.menu');
    if (!menu) {
        return;
    }

    let toggleButton = document.getElementById('themeToggle');
    if (!toggleButton) {
        const item = document.createElement('li');
        item.className = 'menu__item';

        toggleButton = document.createElement('button');
        toggleButton.id = 'themeToggle';
        toggleButton.className = 'theme-toggle';
        toggleButton.type = 'button';

        item.appendChild(toggleButton);
        menu.appendChild(item);
    }

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    toggleButton.textContent = getThemeToggleText(currentTheme);

    toggleButton.onclick = function () {
        const previousTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const nextTheme = previousTheme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
        localStorage.setItem(THEME_KEY, nextTheme);
        toggleButton.textContent = getThemeToggleText(nextTheme);
    };
}

function updateLoginLabel() {
    const loginLabel = document.querySelector('.menu__item.login a') || document.querySelector('.login p');
    const loginState = localStorage.getItem('login');

    if (loginLabel && loginState === '1') {
        loginLabel.innerText = 'Профиль';
    }
}

applyTheme(getInitialTheme());
ensureThemeToggle();
updateLoginLabel();
