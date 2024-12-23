import { showError } from './utils.js';

export function initializeUIComponents() {
  initializeHamburgerMenu();
  initializeBackToTopButton();
  initializeBuyButtons();
  initializeHoverImages();
}

function initializeHamburgerMenu() {
  const hamburger = document.getElementById('hamburger');
  const nav = document.getElementById('nav');

  if (hamburger && nav) {
    hamburger.addEventListener('click', function() {
      nav.classList.toggle('show');
    });
  }
}

function initializeBackToTopButton() {
  const backToTopButton = document.querySelector('.circle-button');

  if (backToTopButton) {
    window.addEventListener('scroll', function() {
      if (window.pageYOffset > 100) {
        backToTopButton.classList.add('show');
      } else {
        backToTopButton.classList.remove('show');
      }
    });

    backToTopButton.addEventListener('click', function() {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
}

export function scrollFunction(backToTopButton) {
  if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
    backToTopButton.style.display = "block";
  } else {
    backToTopButton.style.display = "none";
  }
}

function initializeBuyButtons() {
  const buyButtons = document.querySelectorAll('.buy-button');
  buyButtons.forEach((button) => {
    button.addEventListener('click', (e) => {
      const style = e.target.getAttribute('data-style');
      if (style) {
        handleBuyButtonClick(style);
      } else {
        showError('Invalid style selected.');
      }
    });
  });
}

async function handleBuyButtonClick(style) {
  try {
    const response = await fetch('/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        style,
        success_url: `${window.location.origin}/${style === '3d-figure' ? '3dfiguregeneration.html' : 'flushandlush.html'}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${window.location.origin}/cancel.html`
      }),
    });

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;  // Redirect to Stripe checkout
    } else {
      throw new Error('No checkout URL received from server');
    }
  } catch (error) {
    console.error('Error:', error);
    showError('An error occurred. Please try again.');
  }
}

// Image Display Handler
const ImageDisplayHandler = {
  init() {
    const images = document.querySelectorAll('.grid-item img');
    images.forEach((img, index) => {
      img.setAttribute('data-index', index);
      img.addEventListener('click', (event) => {
        event.preventDefault();
        this.showImage(img.src, img.alt);
      });
    });
  },

  showImage(src, alt) {
    const overlay = document.createElement('div');
    overlay.className = 'image-overlay';
    
    const imgElement = document.createElement('img');
    imgElement.src = src;
    imgElement.alt = alt;
    
    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '&times;';
    closeBtn.className = 'close-btn';
    closeBtn.addEventListener('click', (event) => {
      event.preventDefault();
      this.closeOverlay(overlay);
    });
    
    overlay.appendChild(imgElement);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        event.preventDefault();
        this.closeOverlay(overlay);
      }
    });
  },

  closeOverlay(overlay) {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }
};

// Make sure to call the init function when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  ImageDisplayHandler.init();
});

// Export the ImageDisplayHandler if using ES modules
export { ImageDisplayHandler };