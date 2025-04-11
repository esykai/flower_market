const API_URL = window.env.API_URL;
const STATIC_URL = window.env.STATIC_URL;
let token = localStorage.getItem('google_token') || null;

const popularList = document.getElementById('popularList');
const prevSlide = document.getElementById('prevSlide');
const nextSlide = document.getElementById('nextSlide');
const modal = document.getElementById('plantModal');
const closeModal = document.querySelector('.close-modal');
const modalImageSlider = document.getElementById('modalImageSlider');
const modalPrevSlide = document.getElementById('modalPrevSlide');
const modalNextSlide = document.getElementById('modalNextSlide');
const modalSliderDots = document.getElementById('modalSliderDots');

let currentSlide = 0;
let totalSlides = 0;
let visibleItems = 0;
let modalCurrentSlide = 0;
let modalTotalSlides = 0;

document.addEventListener('DOMContentLoaded', () => {
    loadPopularFlowers();
});

async function loadPopularFlowers() {
    try {
        const response = await fetch(API_URL+'/flowers');
        if (!response.ok) throw new Error('Ошибка загрузки популярных товаров');
        const flowers = await response.json();
        const popular = flowers.slice(0, 5);

        popularList.innerHTML = '';
        popular.forEach(flower => {
            const card = document.createElement('div');
            card.className = 'plant-card';
            card.innerHTML = `
                <img src="${STATIC_URL}/${flower.images[0]?.image_path || 'placeholder.jpg'}" alt="${flower.name}">
                <h3>${flower.name}</h3>
                <p class="price">${flower.price} ₽</p>
            `;

            card.addEventListener('click', () => {
                window.location.href = `catalog.html?flower_id=${flower.id}`;
            });
            popularList.appendChild(card);
        });

        setupSlider(popular.length);
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

function setupSlider(totalItems) {
    const card = popularList.querySelector('.plant-card');
    if (!card) return;

    const cardWidth = card.offsetWidth + 20;
    const containerWidth = popularList.offsetWidth;
    visibleItems = Math.floor(containerWidth / cardWidth);
    totalSlides = Math.ceil(totalItems / visibleItems);

    const dotsContainer = document.getElementById('sliderDots');
    dotsContainer.innerHTML = '';
    for (let i = 0; i < totalSlides; i++) {
        const dot = document.createElement('div');
        dot.className = `slider-dot ${i === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => goToSlide(i));
        dotsContainer.appendChild(dot);
    }

    updateSlider();
}

function goToSlide(slideIndex) {
    currentSlide = slideIndex;
    updateSlider();
}

function updateSlider() {
    const cardWidth = popularList.querySelector('.plant-card').offsetWidth + 20;
    popularList.style.transform = `translateX(-${currentSlide * visibleItems * cardWidth}px)`;

    document.querySelectorAll('.slider-dot').forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
    });

    prevSlide.disabled = currentSlide === 0;
    nextSlide.disabled = currentSlide >= totalSlides - 1;
}

prevSlide.addEventListener('click', () => {
    if (currentSlide > 0) {
        currentSlide--;
        updateSlider();
    }
});

nextSlide.addEventListener('click', () => {
    if (currentSlide < totalSlides - 1) {
        currentSlide++;
        updateSlider();
    }
});


document.getElementById('shopNowBtn').addEventListener('click', () => {
    window.location.href = 'catalog.html';
});

const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('nav');

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