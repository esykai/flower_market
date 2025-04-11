if (typeof API_URL === 'undefined') {
    const API_URL = window.env.API_URL;
}

let currentFlower = null;
let categories = new Set();
let allFlowers = [];

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('google_token');
    const logoutBtn = document.getElementById('logout');
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('nav');
    const modal = document.getElementById('plantModal');
    const closeModalBtn = document.querySelector('.close-modal');
    let modalCurrentSlide = 0;
    let modalTotalSlides = 0;

    const init = async () => {
        toggleUI();
        await loadFlowers();
        loadUserData();
        setupEventListeners();
        checkURLForFlower();
        setTimeout(() => document.body.classList.add('loaded'), 10);
    };

    const toggleUI = () => {
        logoutBtn.style.display = token ? 'flex' : 'none';
    };

    const loadUserData = async () => {
        const userNameElement = document.getElementById('userNameNav');
        if (!token) {
            userNameElement.textContent = 'Гость';
            return;
        }
        try {
            const res = await fetch(`${API_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 401) {
                localStorage.removeItem('google_token');
                userNameElement.textContent = 'Гость';
                toggleUI();
                return;
            }
            if (!res.ok) throw new Error('Ошибка сервера');
            const userData = await res.json();
            userNameElement.textContent = userData.name || 'Пользователь';
        } catch (error) {
            console.error('Ошибка загрузки данных пользователя:', error);
            userNameElement.textContent = 'Гость';
        }
    };

    const loadFlowers = async () => {
        try {
            const flowersRes = await fetch(`${API_URL}/flowers`);
            if (!flowersRes.ok) throw new Error('Ошибка загрузки каталога');
            let flowers = await flowersRes.json();

            if (token) {
                flowers = await syncFavorites(flowers);
            }

            allFlowers = flowers;
            extractCategories(flowers);
            renderFlowers(flowers);
            return flowers;
        } catch (error) {
            console.error('Ошибка загрузки цветов:', error);
            alert('Не удалось загрузить каталог');
            return [];
        }
    };

    const syncFavorites = async (flowers) => {
        try {
            const favoritesRes = await fetch(`${API_URL}/favorites`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!favoritesRes.ok) throw new Error('Ошибка загрузки избранного');
            const favorites = await favoritesRes.json();
            return flowers.map(flower => ({
                ...flower,
                isFavorite: favorites.some(fav => fav.flower_id === flower.id)
            }));
        } catch (error) {
            console.error('Ошибка синхронизации избранного:', error);
            return flowers.map(flower => ({ ...flower, isFavorite: false }));
        }
    };

    const extractCategories = (flowers) => {
        categories.clear();
        flowers.forEach(flower => {
            const category = flower.category?.trim();
            if (category) {
                categories.add(category.toLowerCase());
            }
        });

        const select = document.getElementById('categoryFilter');
        while (select.options.length > 1) {
            select.remove(1);
        }
        Array.from(categories)
            .sort()
            .forEach(cat => {
                const displayCat = cat.charAt(0).toUpperCase() + cat.slice(1);
                select.add(new Option(displayCat, displayCat));
            });
    };

    const renderFlowers = (flowers) => {
        const container = document.getElementById('flowersContainer');
        container.innerHTML = flowers.map(flower => `
            <div class="plant-card${flower.quantity === 0 ? ' out-of-stock' : ''}" data-flower='${JSON.stringify(flower)}' data-id="${flower.id}">
                ${getImageHTML(flower.images)}
                <h3>${flower.name}</h3>
                <p class="quantity">В наличии: ${flower.quantity > 0 ? flower.quantity + ' шт.' : 'Нет в наличии'}</p>
                <p class="price">${flower.price} ₽</p>
                <button class="favorite-btn${flower.isFavorite ? ' active' : ''}" data-id="${flower.id}">
                    <i class="fas fa-heart"></i>
                </button>
            </div>
        `).join('');
        setupCardListeners();
    };

    const getImageHTML = (images) => {
        return images.length > 0
            ? `<img src="${API_URL}/static/${images[0].image_path}" alt="Изображение">`
            : `<div class="image-placeholder"><i class="fas fa-leaf"></i></div>`;
    };

    const filterFlowers = () => {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const category = document.getElementById('categoryFilter').value.toLowerCase();
        const filteredFlowers = allFlowers.filter(flower => {
            const matchesSearch = flower.name.toLowerCase().includes(searchTerm);
            const matchesCategory = !category || flower.category.toLowerCase() === category;
            return matchesSearch && matchesCategory;
        });
        renderFlowers(filteredFlowers);
    };

    const showModal = (flower) => {
        currentFlower = flower;
        document.getElementById('modalName').textContent = flower.name;
        document.getElementById('modalPrice').textContent = `${flower.price} ₽`;
        document.getElementById('modalCategory').textContent = `Категория: ${flower.category}`;
        document.getElementById('modalSize').textContent = `Размер: ${flower.size}`;
        const quantityElement = document.getElementById('modalQuantity');
        quantityElement.textContent = `В наличии: ${flower.quantity > 0 ? flower.quantity + ' шт.' : 'Нет в наличии'}`;
        quantityElement.classList.toggle('out-of-stock', flower.quantity === 0);
        document.getElementById('modalDescription').textContent = flower.description;
        document.getElementById('modalTips').innerHTML = `<strong>Советы по уходу:</strong> ${flower.tips || 'Нет данных'}`;

        const addToCartBtn = document.getElementById('modalAddToCart');
        addToCartBtn.disabled = flower.quantity === 0;
        addToCartBtn.textContent = flower.quantity === 0 ? 'Нет в наличии' : 'В корзину';
        if (flower.quantity > 0) addToCartBtn.innerHTML = '<i class="fas fa-cart-plus"></i> В корзину';

        const favoriteBtn = document.getElementById('toggleFavoriteBtn');
        favoriteBtn.classList.toggle('active', flower.isFavorite || false);

        document.getElementById('modalImageSlider').innerHTML = flower.images.map(img => `
            <img src="${API_URL}/static/${img.image_path}" alt="${flower.name}">
        `).join('');
        modalTotalSlides = flower.images.length;
        modalCurrentSlide = 0;
        setupModalSlider();

        const newUrl = `${window.location.pathname}?flower_id=${flower.id}`;
        window.history.pushState({ flowerId: flower.id }, '', newUrl);

        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    };

    const setupModalSlider = () => {
        const dots = document.getElementById('modalSliderDots');
        dots.innerHTML = Array.from({ length: modalTotalSlides }, (_, i) => `
            <div class="modal-slider-dot${i === 0 ? ' active' : ''}"></div>
        `).join('');
        updateModalSlider();
    };

    const updateModalSlider = () => {
        const slider = document.getElementById('modalImageSlider');
        const imgWidth = slider.querySelector('img')?.offsetWidth || 0;
        slider.style.transform = `translateX(-${modalCurrentSlide * imgWidth}px)`;
        document.querySelectorAll('.modal-slider-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === modalCurrentSlide);
        });
        document.getElementById('modalPrevSlide').disabled = modalCurrentSlide === 0;
        document.getElementById('modalNextSlide').disabled = modalCurrentSlide >= modalTotalSlides - 1;
    };

    const toggleFavorite = async (flowerId) => {
        if (!flowerId) {
            console.error('flowerId не определен');
            return;
        }
        if (!token) {
            alert('Войдите в аккаунт, чтобы добавить в избранное');
            return;
        }
        try {
            const flowerIndex = allFlowers.findIndex(f => f.id === flowerId);
            if (flowerIndex === -1) {
                console.error('Цветок не найден в allFlowers');
                return;
            }

            const isFavorite = allFlowers[flowerIndex].isFavorite;
            const method = isFavorite ? 'DELETE' : 'POST';
            const res = await fetch(`${API_URL}/favorites/${flowerId}`, {
                method,
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Ошибка сервера при обновлении избранного');


            allFlowers[flowerIndex].isFavorite = !isFavorite;


            if (currentFlower && currentFlower.id === flowerId) {
                currentFlower.isFavorite = !isFavorite;
                const modalBtn = document.getElementById('toggleFavoriteBtn');
                if (modalBtn) modalBtn.classList.toggle('active');
            }


            filterFlowers();
        } catch (error) {
            console.error('Ошибка обновления избранного:', error);
            alert('Не удалось обновить избранное');
        }
    };

    const addToCart = async () => {
        if (!token) return alert('Войдите в аккаунт');
        if (!currentFlower) return alert('Ошибка: выберите растение');
        try {
            const res = await fetch(`${API_URL}/cart/${currentFlower.id}?quantity=1`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Ошибка');
            alert('Добавлено в корзину!');
        } catch (error) {
            console.error('Ошибка добавления в корзину:', error);
            alert('Ошибка при добавлении в корзину');
        }
    };

    const checkURLForFlower = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const flowerId = urlParams.get('flower_id');
        if (flowerId) {
            const flower = allFlowers.find(f => f.id === parseInt(flowerId));
            if (flower) {
                showModal(flower);
            } else {
                console.error('Цветок с таким ID не найден');
            }
        }
    };

    const setupCardListeners = () => {
        document.querySelectorAll('.plant-card').forEach(card => {
            card.removeEventListener('click', cardClickHandler);
            card.addEventListener('click', cardClickHandler);
        });
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.removeEventListener('click', favoriteClickHandler);
            btn.addEventListener('click', favoriteClickHandler);
        });
    };

    const cardClickHandler = function (e) {
        const flower = JSON.parse(this.dataset.flower);
        showModal(flower);
    };

    const favoriteClickHandler = function (e) {
        e.stopPropagation();
        const flowerId = parseInt(this.dataset.id);
        toggleFavorite(flowerId);
    };

    const setupEventListeners = () => {
        document.getElementById('searchInput').addEventListener('input', filterFlowers);
        document.getElementById('categoryFilter').addEventListener('change', filterFlowers);

        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('google_token');
            toggleUI();
            window.location.reload();
        });

        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
            menuToggle.querySelector('i').classList.toggle('fa-bars');
            menuToggle.querySelector('i').classList.toggle('fa-times');
        });

        closeModalBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
                currentFlower = null;
                window.history.pushState({}, '', window.location.pathname);
            }, 300);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.style.display = 'none';
                    currentFlower = null;
                    window.history.pushState({}, '', window.location.pathname);
                }, 300);
            }
        });

        document.getElementById('modalPrevSlide').addEventListener('click', () => {
            if (modalCurrentSlide > 0) {
                modalCurrentSlide--;
                updateModalSlider();
            }
        });

        document.getElementById('modalNextSlide').addEventListener('click', () => {
            if (modalCurrentSlide < modalTotalSlides - 1) {
                modalCurrentSlide++;
                updateModalSlider();
            }
        });

        document.getElementById('modalAddToCart').addEventListener('click', addToCart);
        document.getElementById('toggleFavoriteBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentFlower) toggleFavorite(currentFlower.id);
        });

        window.addEventListener('popstate', () => {
            const urlParams = new URLSearchParams(window.location.search);
            const flowerId = urlParams.get('flower_id');
            if (flowerId) {
                const flower = allFlowers.find(f => f.id === parseInt(flowerId));
                if (flower) {
                    showModal(flower);
                } else {
                    modal.classList.remove('active');
                    setTimeout(() => modal.style.display = 'none', 300);
                }
            } else {
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.style.display = 'none';
                    currentFlower = null;
                }, 300);
            }
        });
    };

    init();
});