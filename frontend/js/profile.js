const API_URL = window.env.API_URL;
const STATIC_URL = window.env.STATIC_URL;
const GOOGLE_CLIENT_ID = window.env.GOOGLE_CLIENT_ID;
const TELEGRAM_BOT_URL = window.env.TELEGRAM_BOT_URL;

document.addEventListener('DOMContentLoaded', () => {
    const authSection = document.getElementById('authSection');
    const profileContent = document.getElementById('profileContent');
    const logoutBtn = document.getElementById('logout');
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('nav');
    const modal = document.getElementById('plantModal');
    const closeModal = document.querySelector('.close-modal');
    const modalImageSlider = document.getElementById('modalImageSlider');
    const modalPrevSlide = document.getElementById('modalPrevSlide');
    const modalNextSlide = document.getElementById('modalNextSlide');
    const modalSliderDots = document.getElementById('modalSliderDots');
    let token = localStorage.getItem('google_token');
    let modalCurrentSlide = 0;
    let modalTotalSlides = 0;
    let userId = null;

    const init = async () => {
        await loadGoogleAPI();
        toggleUI();
        if (token) await loadProfile();
        setupEventListeners();
        checkHash();
    };

    const checkHash = () => {
        if (window.location.hash === '#favorites') {
            const favoritesTab = document.querySelector('[data-tab="favorites"]');
            if (favoritesTab) favoritesTab.click();
        }
    };

    const loadGoogleAPI = () => {
        return new Promise((resolve) => {
            if (typeof google !== 'undefined') return resolve();

            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = resolve;
            script.onerror = () => {
                authSection.innerHTML = `
                    <div class="auth-card">
                        <h2 class="auth-title">Ошибка загрузки</h2>
                        <p class="auth-subtitle">Попробуйте перезагрузить страницу</p>
                    </div>
                `;
            };
            document.head.appendChild(script);
        });
    };

    const toggleUI = () => {
        if (token) {
            authSection.style.display = 'none';
            profileContent.style.display = 'block';
            logoutBtn.style.display = 'flex';
        } else {
            authSection.style.display = 'flex';
            profileContent.style.display = 'none';
            logoutBtn.style.display = 'none';
            initGoogleButton();
        }
    };

    const initGoogleButton = () => {
        if (typeof google === 'undefined') return;

        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: response => handleGoogleResponse(response.credential)
        });

        google.accounts.id.renderButton(
            document.getElementById('googleSignIn'),
            { theme: 'outline', size: 'large', width: 300, text: 'signin_with' }
        );
    };

    const handleGoogleResponse = async (credential) => {
        try {
            const res = await fetch(`${API_URL}/auth/google-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: credential })
            });

            if (!res.ok) throw new Error('Ошибка авторизации');

            const { access_token } = await res.json();
            localStorage.setItem('google_token', access_token);
            token = access_token;
            toggleUI();
            loadProfile();
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка входа через Google');
        }
    };

    const loadProfile = async () => {
        try {
            const [userRes, favoritesRes, cartRes] = await Promise.all([
                fetch(`${API_URL}/auth/me/`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_URL}/favorites/`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_URL}/cart/`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (!userRes.ok || !favoritesRes.ok || !cartRes.ok) {
                throw new Error('Ошибка загрузки данных');
            }

            const userData = await userRes.json();
            const favorites = await favoritesRes.json();
            const cartItems = await cartRes.json();

            userId = userData.id;
            updateProfileUI(userData, favorites, cartItems);
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Не удалось загрузить данные');
        }
    };

    const updateProfileUI = (userData, favorites, cartItems) => {
        document.getElementById('userName').textContent = userData.name || 'Пользователь';
        document.getElementById('userEmail').textContent = userData.email || '';
        document.getElementById('favoritesCount').textContent = favorites.length;
        document.getElementById('cartItemsCount').textContent = cartItems.reduce((sum, item) => sum + item.quantity, 0);

        const profileFields = ['address', 'phone', 'telegram'];
        profileFields.forEach(field => {
            const element = document.getElementById(field);
            if (element) element.value = userData.profile?.[field] || '';
        });

        renderSection('favoritesGrid', favorites, item => `
            <div class="plant-card" data-flower='${JSON.stringify(item.flower)}'>
                ${getImageHTML(item.flower.images)}
                <h3>${item.flower.name}</h3>
                <p class="price">${item.flower.price} ₽</p>
            </div>
        `);

        renderCart(cartItems);
    };

    const getImageHTML = (images) => {
        return images.length > 0
            ? `<img src="${STATIC_URL}/${images[0].image_path}" alt="Изображение">`
            : `<div class="image-placeholder"><i class="fas fa-leaf"></i></div>`;
    };

    const renderSection = (containerId, items, template) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = items.length ? items.map(template).join('') : '<p class="empty">Пусто</p>';
        if (containerId === 'favoritesGrid') {
            container.querySelectorAll('.plant-card').forEach(card => {
                const flower = JSON.parse(card.dataset.flower);
                card.classList.toggle('out-of-stock', flower.quantity === 0);
                card.addEventListener('click', () => showModal(flower));
            });
        }
    };

    const renderCart = (cartItems) => {
        const cartGrid = document.getElementById('cartGrid');
        const cartTotal = document.getElementById('cartTotal');
        const checkoutBtn = document.querySelector('#cartTab .cart-checkout-btn');
        if (!cartGrid || !cartTotal) return;

        if (cartItems.length === 0) {
            cartGrid.innerHTML = '<p class="cart-empty">Корзина пуста</p>';
            cartTotal.innerHTML = '';
            if (checkoutBtn) checkoutBtn.disabled = true;
            return;
        }

        cartGrid.innerHTML = cartItems.map(item => {
            const isOutOfStock = item.flower.quantity === 0;
            const exceedsStock = item.quantity > item.flower.quantity && item.flower.quantity > 0;
            const availableQuantity = Math.min(item.quantity, item.flower.quantity);
            const quantityText = isOutOfStock
                ? 'Нет в наличии'
                : exceedsStock
                    ? `${item.quantity} шт. <span class="stock-warning">(Придёт только ${item.flower.quantity} шт.)</span>`
                    : `${item.quantity} шт.`;

            return `
                <div class="cart-item ${isOutOfStock ? 'out-of-stock' : ''}" data-flower='${JSON.stringify(item.flower)}' data-id="${item.id}">
                    <img src="${STATIC_URL}/${item.flower.images[0]?.image_path || ''}" alt="${item.flower.name}">
                    <div class="cart-item-info">
                        <h3>${item.flower.name}</h3>
                        <p>Цена: ${item.flower.price} ₽</p>
                        <p>Количество: ${quantityText}</p>
                        <p>Итого: ${(item.flower.price * availableQuantity).toFixed(2)} ₽</p>
                    </div>
                    <button class="remove-from-cart" data-id="${item.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }).join('');

        const total = cartItems.reduce((sum, item) => {
            const availableQuantity = Math.min(item.quantity, item.flower.quantity);
            return sum + (item.flower.quantity > 0 ? item.flower.price * availableQuantity : 0);
        }, 0);
        cartTotal.innerHTML = `<p>Общая сумма: <strong>${total.toFixed(2)} ₽</strong></p>`;
        if (checkoutBtn) checkoutBtn.disabled = false;
    };

    const showModal = (flower) => {
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

        modalImageSlider.innerHTML = flower.images.map(img => `
            <img src="${STATIC_URL}/${img.image_path}" alt="${flower.name}">
        `).join('');

        modalTotalSlides = flower.images.length;
        modalCurrentSlide = 0;
        setupModalSlider();
        modal.style.display = 'flex';
    };

    const setupModalSlider = () => {
        modalSliderDots.innerHTML = Array.from({ length: modalTotalSlides }, (_, i) => `
            <div class="modal-slider-dot${i === 0 ? ' active' : ''}"></div>
        `).join('');
        updateModalSlider();
    };

    const updateModalSlider = () => {
        const imgWidth = modalImageSlider.querySelector('img')?.offsetWidth || 0;
        modalImageSlider.style.transform = `translateX(-${modalCurrentSlide * imgWidth}px)`;

        document.querySelectorAll('.modal-slider-dot').forEach((dot, index) => {
            dot.classList.toggle('active', index === modalCurrentSlide);
        });

        modalPrevSlide.style.display = modalTotalSlides > 1 ? 'block' : 'none';
        modalNextSlide.style.display = modalTotalSlides > 1 ? 'block' : 'none';
        modalPrevSlide.disabled = modalCurrentSlide === 0;
        modalNextSlide.disabled = modalCurrentSlide >= modalTotalSlides - 1;
    };

    const showQRModal = async () => {
        if (!userId) {
            alert('Ошибка: пользователь не авторизован');
            return;
        }

        try {
            const telegramLink = `${TELEGRAM_BOT_URL}?start=${userId}`;
            const qrModal = document.createElement('div');
            qrModal.className = 'qr-modal animate-fade-in';
            qrModal.innerHTML = `
                <div class="qr-modal-content">
                    <span class="qr-close">×</span>
                    <h2>Оплатите заказ</h2>
                    <p>Сканируйте QR-код или перейдите по ссылке:</p>
                    <canvas class="qr-code" id="qrCode"></canvas>
                    <a href="${telegramLink}" target="_blank" class="qr-link">
                        <i class="fab fa-telegram"></i> ${telegramLink}
                    </a>
                </div>
            `;
            document.body.appendChild(qrModal);

            if (typeof QRCode === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
                script.onload = () => {
                    QRCode.toCanvas(document.getElementById('qrCode'), telegramLink, { width: 200 }, (error) => {
                        if (error) console.error('Ошибка генерации QR-кода:', error);
                    });
                };
                document.head.appendChild(script);
            } else {
                QRCode.toCanvas(document.getElementById('qrCode'), telegramLink, { width: 200 }, (error) => {
                    if (error) console.error('Ошибка генерации QR-кода:', error);
                });
            }

            document.body.classList.add('blurred');
            qrModal.querySelector('.qr-close').addEventListener('click', () => {
                qrModal.remove();
                document.body.classList.remove('blurred');
            });
            qrModal.addEventListener('click', (e) => {
                if (e.target === qrModal) {
                    qrModal.remove();
                    document.body.classList.remove('blurred');
                }
            });
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при оформлении заказа');
        }
    };

    const loadTabData = async (tabId) => {
        try {
            switch(tabId) {
                case 'favorites':
                    const favRes = await fetch(`${API_URL}/favorites`, { headers: { 'Authorization': `Bearer ${token}` } });
                    const favorites = await favRes.json();
                    renderSection('favoritesGrid', favorites, item => `
                        <div class="plant-card" data-flower='${JSON.stringify(item.flower)}'>
                            ${getImageHTML(item.flower.images)}
                            <h3>${item.flower.name}</h3>
                            <p class="quantity">В наличии: ${item.flower.quantity > 0 ? item.flower.quantity + ' шт.' : 'Нет в наличии'}</p>
                            <p class="price">${item.flower.price} ₽</p>
                        </div>
                    `);
                    break;
                case 'cart':
                    const cartRes = await fetch(`${API_URL}/cart`, { headers: { 'Authorization': `Bearer ${token}` } });
                    const cartItems = await cartRes.json();
                    renderCart(cartItems);
                    break;
                case 'purchases':
                    const purchasesRes = await fetch(`${API_URL}/cart/purchases`, { headers: { 'Authorization': `Bearer ${token}` } });
                    const purchases = await purchasesRes.json();

                    const groupedPurchases = [];
                    purchases.sort((a, b) => new Date(a.purchase_date) - new Date(b.purchase_date));
                    let currentGroup = [];
                    let lastDate = null;

                    purchases.forEach(purchase => {
                        const purchaseDate = new Date(purchase.purchase_date).getTime();
                        if (lastDate === null || (purchaseDate - lastDate) <= 5000) {
                            currentGroup.push(purchase);
                        } else {
                            groupedPurchases.push(currentGroup);
                            currentGroup = [purchase];
                        }
                        lastDate = purchaseDate;
                    });
                    if (currentGroup.length) groupedPurchases.push(currentGroup);

                    renderSection('purchasesList', groupedPurchases, group => {
                        const totalPrice = group.reduce((sum, item) => sum + item.total_price, 0);
                        const date = new Date(group[0].purchase_date).toLocaleString();
                        const isGroup = group.length > 1;

                        return `
                            <div class="purchase-group ${isGroup ? 'joint-purchase' : ''}">
                                <h2 class="purchase-group-title">${isGroup ? 'Совместная покупка' : 'Покупка'}</h2>
                                <p class="purchase-date">Дата: ${date}</p>
                                <div class="purchase-items">
                                    ${group.map(item => `
                                        <div class="purchase-item">
                                            ${item.flower.images && item.flower.images.length > 0
                                                ? `<img src="${STATIC_URL}/${item.flower.images[0].image_path}" alt="${item.flower.name}">`
                                                : `<div class="image-placeholder"><i class="fas fa-leaf"></i></div>`}
                                            <div class="purchase-item-info">
                                                <h3>${item.flower.name}</h3>
                                                <p>Количество: ${item.quantity} шт.</p>
                                                <p>Цена: ${item.total_price} ₽</p>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                                <p class="purchase-total">Общая сумма: <span>${totalPrice} ₽</span></p>
                            </div>
                        `;
                    });
                    break;
            }
        } catch (error) {
            console.error(`Ошибка загрузки вкладки ${tabId}:`, error);
        }
    };

    const removeFromCart = async (cartItemId) => {
        try {
            const res = await fetch(`${API_URL}/cart/${cartItemId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Ошибка удаления');
            await loadProfile();
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при удалении из корзины');
        }
    };

    const setupEventListeners = () => {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => {
                    c.classList.remove('active');
                    c.style.display = 'none';
                });

                btn.classList.add('active');
                const tabId = btn.dataset.tab;
                const tabContent = document.getElementById(tabId);

                if (tabContent) {
                    tabContent.style.display = 'block';
                    tabContent.classList.add('active');
                    if (tabContent.dataset.loaded !== 'true') {
                        await loadTabData(tabId);
                        tabContent.dataset.loaded = 'true';
                    }
                }
            });
        });

        document.getElementById('profileForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = {
                address: document.getElementById('address').value,
                phone: document.getElementById('phone').value,
                telegram: document.getElementById('telegram').value
            };
            try {
                const res = await fetch(`${API_URL}/auth/profile`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(formData)
                });
                if (!res.ok) throw new Error('Ошибка сохранения');
                alert('Профиль успешно обновлен!');
            } catch (error) {
                console.error('Ошибка:', error);
                alert('Ошибка при сохранении изменений');
            }
        });

        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('google_token');
            token = null;
            toggleUI();
            window.location.reload();
        });

        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
            menuToggle.querySelector('i').classList.toggle('fa-bars');
            menuToggle.querySelector('i').classList.toggle('fa-times');
        });

        document.addEventListener('click', (e) => {
            const isMenuClicked = nav.contains(e.target) || menuToggle.contains(e.target);
            if (!isMenuClicked && nav.classList.contains('active')) {
                nav.classList.remove('active');
                menuToggle.querySelector('i').classList.replace('fa-times', 'fa-bars');
            }
        });

        closeModal.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });

        modalPrevSlide.addEventListener('click', () => {
            if (modalCurrentSlide > 0) {
                modalCurrentSlide--;
                updateModalSlider();
            }
        });

        modalNextSlide.addEventListener('click', () => {
            if (modalCurrentSlide < modalTotalSlides - 1) {
                modalCurrentSlide++;
                updateModalSlider();
            }
        });

        document.getElementById('modalAddToCart').addEventListener('click', async () => {
            const flower = JSON.parse(document.querySelector('.plant-card:hover')?.dataset.flower || document.querySelector('.cart-item:hover')?.dataset.flower || '{}');
            if (flower.quantity === 0) return;
            try {
                const res = await fetch(`${API_URL}/cart`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ flower_id: flower.id, quantity: 1 })
                });
                if (!res.ok) throw new Error('Ошибка добавления');
                alert('Добавлено в корзину!');
                loadProfile();
            } catch (error) {
                console.error('Ошибка:', error);
                alert('Ошибка при добавлении в корзину');
            }
        });

        document.addEventListener('click', (e) => {
            if (e.target.closest('.remove-from-cart')) {
                const btn = e.target.closest('.remove-from-cart');
                const cartItemId = btn.dataset.id;
                removeFromCart(cartItemId);
            }
            if (e.target.closest('.cart-checkout-btn')) {
                showQRModal();
            }
        });

        const phoneInput = document.getElementById('phone');
        if (phoneInput) {
            phoneInput.addEventListener('input', (e) => {
                const x = e.target.value.replace(/\D/g, '').match(/(\d{0,1})(\d{0,3})(\d{0,3})(\d{0,4})/);
                e.target.value = !x[2] ? x[1] : '+7 (' + x[2] + (x[3] ? ') ' + x[3] : '') + (x[4] ? '-' + x[4] : '');
            });
        }
    };

    init();
});