import { initializeFormHandlers } from './formHandlers.js';
import { initializeGallery } from './imageGallery.js';
import { initializeUIComponents } from './uiComponents.js';

document.addEventListener('DOMContentLoaded', function() {
  initializeFormHandlers();
  initializeGallery();
  initializeUIComponents();
});