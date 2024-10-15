import { initializeFormHandlers } from './formHandlers.js';
import { initializeGallery } from './imageGallery.js';
import { initializeUIComponents } from './uiComponents.js';

document.addEventListener('DOMContentLoaded', function() {
  initializeFormHandlers();
  initializeGallery();
  initializeUIComponents();

function openModal(content) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <span class="close">&times;</span>
      <div id="modal-body"></div>
    </div>
  `;
  document.body.appendChild(modal);

  const modalBody = modal.querySelector('#modal-body');
  modalBody.innerHTML = content;

  const closeBtn = modal.querySelector('.close');
  closeBtn.onclick = () => {
    document.body.removeChild(modal);
  };

  window.onclick = (event) => {
    if (event.target === modal) {
      document.body.removeChild(modal);
    }
  };
}

async function verifyPaymentAndOpenModal(sessionId) {
  try {
    const response = await fetch('/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });

    const data = await response.json();

    if (data.status === 'success') {
      const flushAndLushContent = await fetch('/flushandlush.html').then(res => res.text());
      openModal(flushAndLushContent);
    } else {
      alert('Payment verification failed. Please try again.');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('An error occurred. Please try again.');
  }
}

// Update the existing code that handles the payment success redirect
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session_id');
if (sessionId) {
  verifyPaymentAndOpenModal(sessionId);
}









});

