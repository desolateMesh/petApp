import { showError } from './utils.js';

export function initializeUIComponents() {
  initializeHamburgerMenu();
  initializeBackToTopButton();
  initializeBuyButtons();
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
    window.onscroll = function() {
      scrollFunction(backToTopButton);
    };

    backToTopButton.addEventListener('click', function() {
      document.body.scrollTop = 0; // For Safari
      document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE, and Opera
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