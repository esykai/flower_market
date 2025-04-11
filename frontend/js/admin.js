const API_URL = window.env.API_URL;
const AUTH_URL = API_URL+'/auth';
const STATIC_URL = window.env.STATIC_URL;
let token = localStorage.getItem('google_token') || null;

const loginForm = document.getElementById('loginForm');
const addForm = document.getElementById('addForm');
const flowerList = document.getElementById('flowerList');
const logoutBtn = document.getElementById('logout');
const adminTitle = document.getElementById('adminTitle');
const googleLoginBtn = document.getElementById('googleLoginBtn');


function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const icon = toast.querySelector('.toast-icon i');

    toastMessage.textContent = message;
    toast.classList.remove('success', 'error', 'warning');
    toast.classList.add(type);

    if (type === 'success') icon.className = 'fas fa-check-circle';
    else if (type === 'error') icon.className = 'fas fa-exclamation-circle';
    else if (type === 'warning') icon.className = 'fas fa-exclamation-triangle';

    toast.classList.add('show');
    clearTimeout(toast.timeout);
    toast.timeout = setTimeout(() => toast.classList.remove('show'), 5000);
}


function displayQuantityIndicators() {
    const cards = document.querySelectorAll('#flowerList .flower-card');
    cards.forEach(card => {
        const oldIndicator = card.querySelector('.quantity-indicator');
        if (oldIndicator) oldIndicator.remove();

        const quantityElement = card.querySelector('.quantity .value');
        if (quantityElement) {
            const quantity = parseInt(quantityElement.textContent);
            const indicator = document.createElement('div');
            indicator.className = 'quantity-indicator';
            indicator.textContent = quantity + ' шт';

            if (quantity === 0) indicator.classList.add('quantity-low');
            else if (quantity <= 5) indicator.classList.add('quantity-medium');
            else indicator.classList.add('quantity-high');

            card.appendChild(indicator);
        }
    });
}


function initializeGoogleAuth() {
    google.accounts.id.initialize({
        client_id: '523452047195-uugq2rpq2u9lpb7d0fiffjn26o36c6mj.apps.googleusercontent.com',
        callback: handleCredentialResponse
    });
    google.accounts.id.renderButton(googleLoginBtn, { theme: 'outline', size: 'large' });
}


async function handleCredentialResponse(response) {
    const idToken = response.credential;
    document.getElementById('mainLoader').style.display = 'flex';
    try {
        const apiResponse = await fetch(`${AUTH_URL}/google-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: idToken })
        });
        if (!apiResponse.ok) throw new Error('Ошибка авторизации');
        const data = await apiResponse.json();
        token = data.access_token;
        localStorage.setItem('google_token', token);
        await checkAdminStatus();
    } catch (error) {
        console.error('Ошибка авторизации:', error);
        showToast('Ошибка авторизации', 'error');
    } finally {
        document.getElementById('mainLoader').style.display = 'none';
    }
}


async function checkAdminStatus() {
    document.getElementById('mainLoader').style.display = 'flex';
    try {
        const response = await fetch(`${AUTH_URL}/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Недействительный токен');
        const user = await response.json();
        if (user.is_admin) {
            showAdminPanel();
            await loadFlowers();
            showToast('Успешный вход!', 'success');
        } else {
            showToast('У вас нет прав администратора.', 'error');
            logout();
        }
    } catch (error) {
        console.error('Ошибка проверки статуса:', error);
        showToast(error.message, 'warning');
        logout();
    } finally {
        document.getElementById('mainLoader').style.display = 'none';
    }
}


function logout() {
    localStorage.removeItem('google_token');
    token = null;
    showLoginForm();
    showToast('Вы вышли из системы', 'success');
}


function showLoginForm() {
    loginForm.style.display = 'block';
    addForm.style.display = 'none';
    logoutBtn.style.display = 'none';
    googleLoginBtn.style.display = 'block';
    adminTitle.textContent = 'Вход в админку';
    document.getElementById('flowerListContainer').classList.remove('active');
}


function showAdminPanel() {
    loginForm.style.display = 'none';
    addForm.style.display = 'block';
    logoutBtn.style.display = 'block';
    googleLoginBtn.style.display = 'none';
    adminTitle.textContent = 'Управление цветами';
    document.getElementById('flowerListContainer').classList.add('active');
}


async function loadFlowers() {
    document.getElementById('mainLoader').style.display = 'flex';
    try {
        const response = await fetch(API_URL+'/flowers', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Ошибка загрузки цветов');
        const flowers = await response.json();
        flowerList.innerHTML = '';

        flowers.forEach(flower => {
            const card = document.createElement('div');
            card.className = `flower-card ${flower.quantity === 0 ? 'out-of-stock' : ''}`;
            card.innerHTML = `
                <div class="flower-images">
                    ${flower.images.map(img => `<img src="${STATIC_URL}/${img.image_path}" alt="${flower.name}">`).join('') || '<p>Нет фото</p>'}
                </div>
                <h3>${flower.name}</h3>
                <div class="info">
                    <p><strong>Категория:</strong> <span class="value">${flower.category}</span></p>
                    <p><strong>Размер:</strong> <span class="value">${flower.size}</span></p>
                    <p><strong>Цена:</strong> <span class="value price">${flower.price} ₽</span></p>
                    <p class="quantity"><strong>Количество:</strong> <span class="value">${flower.quantity}</span></p>
                    ${flower.quantity === 0 ? '<p class="out-of-stock-label">Нет в наличии</p>' : ''}
                </div>
                <div class="flower-actions">
                    <button class="edit-btn" data-id="${flower.id}"><i class="fas fa-edit"></i> Редактировать</button>
                    <button class="delete-btn" data-id="${flower.id}"><i class="fas fa-trash"></i> Удалить</button>
                </div>
            `;
            flowerList.appendChild(card);
        });

        document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => editFlower(btn.dataset.id)));
        document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => deleteFlower(btn.dataset.id)));
        displayQuantityIndicators();
    } catch (error) {
        console.error('Ошибка загрузки цветов:', error);
        showToast('Ошибка загрузки цветов', 'error');
    } finally {
        document.getElementById('mainLoader').style.display = 'none';
    }
}


document.getElementById('images').addEventListener('change', (e) => {
    const preview = document.getElementById('addImagePreview');
    preview.innerHTML = '';
    Array.from(e.target.files).forEach(file => {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        preview.appendChild(img);
    });
    document.getElementById('fileCount').textContent = e.target.files.length;
});

document.getElementById('editImages').addEventListener('change', (e) => {
    const preview = document.getElementById('editNewImagePreview');
    preview.innerHTML = '';
    Array.from(e.target.files).forEach(file => {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        preview.appendChild(img);
    });
    document.getElementById('editFileCount').textContent = e.target.files.length;
});


document.getElementById('addFlowerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('mainLoader').style.display = 'flex';
    const formData = new FormData(e.target);

    try {
        const response = await fetch(API_URL+'/flowers', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        if (!response.ok) throw new Error('Ошибка добавления цветка');
        e.target.reset();
        document.getElementById('addImagePreview').innerHTML = '';
        document.getElementById('fileCount').textContent = '0';
        await loadFlowers();
        showToast('Цветок успешно добавлен!', 'success');
    } catch (error) {
        console.error('Ошибка добавления цветка:', error);
        showToast(`Ошибка: ${error.message}`, 'error');
    } finally {
        document.getElementById('mainLoader').style.display = 'none';
    }
});


async function editFlower(id) {
    document.getElementById('mainLoader').style.display = 'flex';
    try {
        const response = await fetch(`${API_URL}/flowers/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Ошибка загрузки данных цветка');
        const flower = await response.json();

        document.getElementById('editId').value = flower.id;
        document.getElementById('editName').value = flower.name;
        document.getElementById('editCategory').value = flower.category;
        document.getElementById('editPrice').value = flower.price;
        document.getElementById('editQuantity').value = flower.quantity;
        document.getElementById('editSize').value = flower.size;
        document.getElementById('editTips').value = flower.tips || '';
        document.getElementById('editDescription').value = flower.description || '';

        const preview = document.getElementById('editImagePreview');
        preview.innerHTML = flower.images.map(img => `
            <div class="image-container">
                <img src="${STATIC_URL}/${img.image_path}" alt="${flower.name}">
                <button type="button" class="delete-image-btn" data-image="${img.id}">×</button>
            </div>
        `).join('') || '<p>Нет фото</p>';

        const modal = document.getElementById('editModal');
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);

        document.querySelectorAll('.delete-image-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const imageId = btn.dataset.image;
                try {
                    await fetch(`${API_URL}/flowers/${id}/images/${imageId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    btn.parentElement.remove();
                    showToast('Изображение удалено', 'success');
                } catch (error) {
                    showToast('Ошибка удаления изображения', 'error');
                }
            });
        });
    } catch (error) {
        console.error('Ошибка редактирования цветка:', error);
        showToast('Ошибка при редактировании цветка', 'error');
    } finally {
        document.getElementById('mainLoader').style.display = 'none';
    }
}


document.getElementById('editFlowerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    document.getElementById('mainLoader').style.display = 'flex';
    const formData = new FormData(e.target);

    try {
        const response = await fetch(`${API_URL}/flowers/${id}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        if (!response.ok) throw new Error('Ошибка сохранения изменений');
        const modal = document.getElementById('editModal');
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
        await loadFlowers();
        showToast('Изменения сохранены!', 'success');
    } catch (error) {
        console.error('Ошибка сохранения изменений:', error);
        showToast(`Ошибка: ${error.message}`, 'error');
    } finally {
        document.getElementById('mainLoader').style.display = 'none';
    }
});


async function deleteFlower(id) {
    if (confirm('Вы уверены, что хотите удалить этот цветок?')) {
        document.getElementById('mainLoader').style.display = 'flex';
        try {
            const response = await fetch(`${API_URL}/flowers/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Ошибка удаления цветка');
            await loadFlowers();
            showToast('Цветок успешно удален!', 'success');
        } catch (error) {
            console.error('Ошибка удаления цветка:', error);
            showToast('Ошибка при удалении цветка', 'error');
        } finally {
            document.getElementById('mainLoader').style.display = 'none';
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    if (token) checkAdminStatus();
    else showLoginForm();

    initializeGoogleAuth();

    document.getElementById('closeEditModal').addEventListener('click', () => {
        const modal = document.getElementById('editModal');
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    });

    document.getElementById('toastClose').addEventListener('click', () => {
        document.getElementById('toast').classList.remove('show');
    });

    window.addEventListener('click', (e) => {
        const modal = document.getElementById('editModal');
        if (e.target === modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('editModal');
            if (modal.classList.contains('active')) {
                modal.classList.remove('active');
                setTimeout(() => modal.style.display = 'none', 300);
            }
        }
    });

    logoutBtn.addEventListener('click', logout);

    setTimeout(() => {
        document.querySelectorAll('.hidden').forEach(element => element.classList.add('fade-in'));
    }, 300);
});