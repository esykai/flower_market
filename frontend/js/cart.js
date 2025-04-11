if (typeof API_URL === 'undefined') {
    var API_URL = window.env.API_URL;
}
const STATIC_URL = window.env.STATIC_URL;
const TELEGRAM_BOT_URL = window.env.TELEGRAM_BOT_URL;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('google_token');


    const cartSidebar = document.createElement('div');
    cartSidebar.id = 'cartSidebar';
    cartSidebar.innerHTML = `
        <div class="cart-sidebar-header">
            <h2>Ваша корзина</h2>
            <span class="close-cart-sidebar">×</span>
        </div>
        <div class="cart-items" id="cartItems"></div>
        <div class="cart-footer">
            <div class="cart-total" id="cartTotal"></div>
            <button class="cart-checkout-btn">Оформить заказ</button>
        </div>
    `;
    document.body.appendChild(cartSidebar);


    const cartIcon = document.createElement('a');
    cartIcon.href = '#';
    cartIcon.id = 'cartLink';
    cartIcon.innerHTML = '<i class="fas fa-shopping-cart"></i>';
    cartIcon.title = 'Корзина';
    cartIcon.className = 'cart-icon';
    document.body.appendChild(cartIcon);

    const loadCart = async () => {
        if (!token) {
            alert('Войдите в аккаунт, чтобы просмотреть корзину');
            return;
        }
        try {
            const res = await fetch(`${API_URL}/cart/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Ошибка загрузки корзины');
            const cartItems = await res.json();
            renderCart(cartItems);
            cartSidebar.classList.add('active');
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Не удалось загрузить корзину');
        }
    };

    const renderCart = (cartItems) => {
        const cartContainer = document.getElementById('cartItems');
        const cartTotal = document.getElementById('cartTotal');
        const checkoutBtn = document.querySelector('.cart-checkout-btn');

        if (cartItems.length === 0) {
            cartContainer.innerHTML = '<p class="cart-empty">Корзина пуста</p>';
            cartTotal.innerHTML = '';
            checkoutBtn.disabled = true;
            return;
        }

        cartContainer.innerHTML = cartItems.map(item => {
            const isOutOfStock = item.flower.quantity === 0;
            const exceedsStock = item.quantity > item.flower.quantity && item.flower.quantity > 0;
            const availableQuantity = Math.min(item.quantity, item.flower.quantity);
            const quantityText = isOutOfStock
                ? 'Нет в наличии'
                : exceedsStock
                    ? `${item.quantity} шт. <span class="stock-warning">(Придёт только ${item.flower.quantity} шт.)</span>`
                    : `${item.quantity} шт.`;

            return `
                <div class="cart-item ${isOutOfStock ? 'out-of-stock' : ''}" data-id="${item.id}">
                    <img src="${STATIC_URL}/${item.flower.images[0]?.image_path || ''}" alt="${item.flower.name}">
                    <div class="cart-item-info">
                        <h3>${item.flower.name}</h3>
                        <p>Цена: ${item.flower.price} ₽</p>
                        <p>Кол-во: ${quantityText}</p>
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
        checkoutBtn.disabled = false;
    };

    const removeFromCart = async (cartItemId) => {
        if (!token) return alert('Войдите в аккаунт');
        try {
            const res = await fetch(`${API_URL}/cart/${cartItemId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Ошибка удаления');
            loadCart();
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при удалении из корзины');
        }
    };

    const showQRModal = async () => {
        if (!token) {
            alert('Войдите в аккаунт для оформления заказа');
            return;
        }

        try {
            const userRes = await fetch(`${API_URL}/auth/me/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!userRes.ok) throw new Error('Ошибка получения данных пользователя');
            const userData = await userRes.json();
            const userId = userData.id;

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
            cartSidebar.classList.remove('active');

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


    cartIcon.addEventListener('click', (e) => {
        e.preventDefault();
        loadCart();
    });

    cartSidebar.querySelector('.close-cart-sidebar').addEventListener('click', () => {
        cartSidebar.classList.remove('active');
    });

    cartSidebar.addEventListener('click', (e) => {
        if (e.target === cartSidebar) {
            cartSidebar.classList.remove('active');
        }
        if (e.target.closest('.remove-from-cart')) {
            const btn = e.target.closest('.remove-from-cart');
            const cartItemId = btn.dataset.id;
            removeFromCart(cartItemId);
        }
        if (e.target.closest('.cart-checkout-btn')) {
            showQRModal();
        }
    });


    const cartStyles = `
        #cartSidebar {
            position: fixed;
            top: 0;
            right: -400px;
            width: 400px;
            height: 100%;
            background: #ffffff;
            box-shadow: -5px 0 20px rgba(0, 0, 0, 0.1);
            z-index: 2000;
            transition: right 0.3s ease;
            display: flex;
            flex-direction: column;
        }

        #cartSidebar.active {
            right: 0;
        }

        .cart-sidebar-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem;
            border-bottom: 1px solid #e5e7eb;
        }

        .cart-sidebar-header h2 {
            font-size: 1.8rem;
            color: #1f2937;
            background: linear-gradient(45deg, #059669, #10b981);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .close-cart-sidebar {
            font-size: 2rem;
            color: #374151;
            cursor: pointer;
            transition: color 0.3s;
        }

        .close-cart-sidebar:hover {
            color: #ef4444;
        }

        .cart-items {
            flex: 1;
            padding: 1.5rem;
            overflow-y: auto;
        }

        .cart-item {
            display: flex;
            align-items: center;
            background: #f9fafb;
            border-radius: 1rem;
            padding: 1rem;
            margin-bottom: 1rem;
            transition: all 0.3s ease;
        }

        .cart-item:hover {
            background: #f3f4f6;
            transform: translateY(-2px);
        }

        .cart-item img {
            width: 60px;
            height: 60px;
            object-fit: cover;
            border-radius: 0.5rem;
            margin-right: 1rem;
        }

        .cart-item-info {
            flex: 1;
        }

        .cart-item-info h3 {
            font-size: 1.1rem;
            color: #1f2937;
            margin-bottom: 0.25rem;
        }

        .cart-item-info p {
            font-size: 0.9rem;
            color: #4b5563;
            margin-bottom: 0.25rem;
        }

        .stock-warning {
            color: #ef4444;
            font-size: 0.85rem;
            font-weight: 500;
            display: block;
            margin-top: 0.25rem;
        }

        .remove-from-cart {
            background: #ef4444;
            color: white;
            border: none;
            padding: 0.5rem;
            border-radius: 0.5rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .remove-from-cart:hover {
            background: #dc2626;
        }

        .cart-empty {
            font-size: 1.1rem;
            color: #6b7280;
            text-align: center;
            padding: 2rem 0;
        }

        .cart-footer {
            padding: 1.5rem;
            border-top: 1px solid #e5e7eb;
        }

        .cart-total {
            margin-bottom: 1rem;
            text-align: right;
        }

        .cart-total p {
            font-size: 1.2rem;
            color: #1f2937;
        }

        .cart-total strong {
            color: #10b981;
        }

        .cart-checkout-btn {
            width: 100%;
            padding: 0.75rem;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 1rem;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .cart-checkout-btn:disabled {
            background: #d1d5db;
            cursor: not-allowed;
        }

        .cart-checkout-btn:hover:not(:disabled) {
            background: #059669;
            box-shadow: 0 5px 15px rgba(16, 185, 129, 0.3);
        }

        .cart-icon {
            position: fixed;
            bottom: 20px;
            right: 20px;
            text-decoration: none;
            color: #374151;
            font-size: 2rem;
            background: #ffffff;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
            z-index: 1999;
        }

        .cart-icon:hover {
            color: #10b981;
            transform: scale(1.1);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
        }


        .qr-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
        }

        .qr-modal.animate-fade-in {
            opacity: 1;
        }

        .qr-modal-content {
            background: #ffffff;
            padding: clamp(1.5rem, 3vw, 2rem);
            border-radius: 1.5rem;
            text-align: center;
            max-width: clamp(300px, 80vw, 400px);
            width: 90%;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            position: relative;
            animation: slideUp 0.4s ease-out;
        }

        .qr-close {
            position: absolute;
            top: 1rem;
            right: 1rem;
            font-size: clamp(1.5rem, 4vw, 2rem);
            color: #374151;
            cursor: pointer;
            transition: color 0.3s ease;
        }

        .qr-close:hover {
            color: #ef4444;
        }

        .qr-modal-content h2 {
            font-size: clamp(1.5rem, 4vw, 1.8rem);
            color: #1f2937;
            margin-bottom: 1rem;
            background: linear-gradient(45deg, #059669, #10b981);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .qr-modal-content p {
            font-size: clamp(0.85rem, 2.5vw, 1rem);
            color: #4b5563;
            margin-bottom: clamp(1rem, 2vw, 1.5rem);
        }

        .qr-code {
            margin: clamp(1rem, 2vw, 1.5rem) auto;
        }

        .qr-link {
            display: inline-flex;
            align-items: center;
            padding: clamp(0.5rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem);
            background: #10b981;
            color: white;
            text-decoration: none;
            border-radius: 2rem;
            font-size: clamp(0.85rem, 2vw, 1rem);
            font-weight: 600;
            transition: background 0.3s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }

        .qr-link:hover {
            background: #059669;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(16, 185, 129, 0.3);
        }

        .qr-link i {
            margin-right: 0.5rem;
            font-size: clamp(1rem, 2.5vw, 1.2rem);
        }


        .blurred main,
        .blurred header {
            filter: blur(5px);
            pointer-events: none;
            transition: filter 0.3s ease;
        }


        @keyframes slideUp {
            from { transform: translateY(50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }


        @media (max-width: 768px) {
            #cartSidebar {
                width: 100%;
                right: -100%;
            }

            #cartSidebar.active {
                right: 0;
            }

            .cart-item {
                flex-direction: column;
                align-items: flex-start;
            }

            .cart-item img {
                width: 100%;
                height: auto;
                margin-bottom: 0.5rem;
            }

            .remove-from-cart {
                width: 100%;
                text-align: center;
            }

            .cart-icon {
                bottom: 15px;
                right: 15px;
                width: 50px;
                height: 50px;
                font-size: 1.5rem;
            }

            .qr-modal-content {
                padding: clamp(1rem, 2vw, 1.5rem);
                max-width: clamp(250px, 80vw, 350px);
            }

            .qr-modal-content h2 {
                font-size: clamp(1.2rem, 3vw, 1.5rem);
            }

            .qr-modal-content p {
                font-size: clamp(0.8rem, 2vw, 0.9rem);
            }

            .qr-link {
                padding: clamp(0.4rem, 1.5vw, 0.6rem) clamp(0.8rem, 2vw, 1rem);
                font-size: clamp(0.8rem, 2vw, 0.9rem);
            }
        }

        @media (max-width: 480px) {
            .qr-modal-content {
                padding: clamp(0.75rem, 2vw, 1rem);
                max-width: clamp(200px, 80vw, 300px);
            }

            .qr-modal-content h2 {
                font-size: clamp(1rem, 3vw, 1.3rem);
            }

            .qr-code canvas {
                width: clamp(120px, 40vw, 150px) !important;
                height: clamp(120px, 40vw, 150px) !important;
            }
        }
    `;
    const styleSheet = document.createElement('style');
    styleSheet.textContent = cartStyles;
    document.head.appendChild(styleSheet);
});