import { showError } from './utils.js';

// Image Gallery functionality
const rowGalleries = {
  row1: {
    'flush-and-lush': [
      '/public/images/dog1lush1.png',
      '/public/images/dog1lush2.png',
      '/public/images/dog1lush3.png',
      '/public/images/realdog1lush.png',
      '/public/images/realcatlush.png',
      '/public/images/catlush1.png',
      '/public/images/catlush2.png'
    ],
    '3d-figure': [
      '/public/images/realfrenchBulldog.png',
      '/public/images/frenchie3Dfigure1.png',
      '/public/images/frenchie3Dfigure2.png',
      '/public/images/frenchie3Dfigure3.png',
      '/public/images/realBulldog.png',
      '/public/images/bully3Dfigure1.png',
      '/public/images/bully3Dfigure2.png'
    ],
    'realistic': [
      '/images/exampleImages/realdog2lush.png',
      '/images/exampleImages/dog3lush2.png',
      '/images/exampleImages/dog3lush3.png',
      '/images/exampleImages/dog3lush4.png',
    ],
  },
  // ... (row2 and row3 data omitted for brevity)
};

let currentGallery = [];
let currentImageIndex = 0;
let modal, modalImg, closeBtn, prevBtn, nextBtn;

export function initializeGallery() {
  modal = document.getElementById('imageModal');
  modalImg = document.getElementById('modalImage');
  closeBtn = document.getElementsByClassName('close')[0];
  prevBtn = document.getElementsByClassName('prev')[0];
  nextBtn = document.getElementsByClassName('next')[0];

  if (closeBtn) closeBtn.addEventListener('click', closeImageGallery);
  if (prevBtn) prevBtn.addEventListener('click', showPreviousImage);
  if (nextBtn) nextBtn.addEventListener('click', showNextImage);

  window.addEventListener('click', function(event) {
    if (event.target === modal) {
      closeImageGallery();
    }
  });
}

export function openImageGallery(event) {
  const gridItem = event.target.closest('.grid-item');
  const galleryName = gridItem.dataset.gallery;
  const rowName = gridItem.closest('.row').dataset.row;
  currentGallery = rowGalleries[rowName][galleryName];
  currentImageIndex = 0;
  updateModalImage();
  modal.style.display = 'block';
}

function closeImageGallery() {
  modal.style.display = 'none';
}

function showNextImage() {
  currentImageIndex = (currentImageIndex + 1) % currentGallery.length;
  updateModalImage();
}

function showPreviousImage() {
  currentImageIndex = (currentImageIndex - 1 + currentGallery.length) % currentGallery.length;
  updateModalImage();
}

function updateModalImage() {
  modalImg.src = currentGallery[currentImageIndex];
}