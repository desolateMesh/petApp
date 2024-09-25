import { showError, hideError, updateCharCount, downloadImage } from './utils.js';

export function initializeFormHandlers() {
  const uploadForm = document.getElementById('uploadForm');
  const generateButton = document.getElementById('generateButton');
  const uploadForm3D = document.getElementById('upload-form');

  if (uploadForm) {
    uploadForm.addEventListener('submit', handleImageUpload);
  }

  if (generateButton) {
    generateButton.addEventListener('click', handleGenerate);
  }

  if (uploadForm3D) {
    uploadForm3D.addEventListener('submit', handle3DImageUpload);
  }

  // Set up character count for prompt text
  const promptTextElement = document.getElementById('promptText');
  if (promptTextElement) {
    promptTextElement.addEventListener('input', updateCharCount);
  }
}

async function handleImageUpload(e) {
  e.preventDefault();
  hideError();

  const spinner = document.getElementById('spinner');
  if (spinner) spinner.style.display = 'block';

  const formData = new FormData();
  const imageInput = document.getElementById('imageInput');

  if (!imageInput || imageInput.files.length === 0) {
    showError('Please select an image to upload.');
    if (spinner) spinner.style.display = 'none';
    return;
  }

  formData.append('image', imageInput.files[0]);

  try {
    const response = await fetch('/process-image-flush-lush', {
      method: 'POST',
      body: formData,
    });

    if (spinner) spinner.style.display = 'none';

    if (response.ok) {
      const data = await response.json();
      updateUIAfterUpload(data);
    } else {
      const errorData = await response.json();
      showError(errorData.error || 'An error occurred while processing the image.');
    }
  } catch (error) {
    console.error('Error:', error);
    showError('An error occurred. Please try again later.');
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}

async function handleGenerate() {
  hideError();
  const spinner = document.getElementById('spinner');
  const promptText = document.getElementById('promptText');

  if (!promptText || promptText.value.trim().length < 3) {  // Changed from 10 to 3
    showError('Prompt is too short. Please provide a more detailed description.');
    return;
  }

  if (spinner) spinner.style.display = 'block';

  try {
    const response = await fetch('/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: promptText.value.trim() }),
    });

    if (response.ok) {
      const data = await response.json();
      updateUIAfterGenerate(data);
    } else {
      const errorData = await response.json();
      showError(errorData.error || 'An error occurred while generating images.');
    }
  } catch (error) {
    console.error('Error:', error);
    showError('An error occurred. Please try again later.');
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}


async function handle3DImageUpload(e) {
  e.preventDefault();

  const outputContainer = document.getElementById('output-container');
  if (outputContainer) {
    outputContainer.innerHTML = '<p>Processing... Please wait.</p>';
  }

  const formData = new FormData();
  const imageInput = document.getElementById('image-input');

  if (!imageInput || imageInput.files.length === 0) {
    showError('Please select an image to upload.');
    return;
  }

  formData.append('image', imageInput.files[0]);

  try {
    const response = await fetch('/process-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'An error occurred');
    }

    const data = await response.json();
    updateUIAfter3DUpload(data);
  } catch (error) {
    console.error('Error:', error);
    showError(error.message || 'An error occurred while processing the image');
  }
}

function updateUIAfterUpload(data) {
  console.log("Entering updateUIAfterUpload function");
  console.log("Received data:", data);

  const promptArea = document.getElementById('promptArea');
  const promptText = document.getElementById('promptText');
  const generatedPreview = document.getElementById('generatedPreview');

  console.log("promptArea:", promptArea);
  console.log("promptText:", promptText);
  console.log("generatedPreview:", generatedPreview);

  if (promptText) {
    console.log("Setting promptText value");
    promptText.value = data.prompt || "No prompt generated";
    console.log("promptText value set to:", promptText.value);
    updateCharCount();
  } else {
    console.error("promptText element not found");
  }

  if (promptArea) {
    console.log("Displaying promptArea");
    promptArea.style.display = 'block';
  } else {
    console.error("promptArea element not found");
  }

  if (generatedPreview) {
    console.log("Updating generatedPreview");
    generatedPreview.innerHTML = `
      <p class="breed-info">Identified breed: ${data.animal_breed || 'Unknown'}</p>
      <p class="description-info">Description: ${data.animal_description || 'No description available'}</p>
    `;
    console.log("generatedPreview updated");
  } else {
    console.error("generatedPreview element not found");
  }

  console.log("Exiting updateUIAfterUpload function");
}

function updateUIAfterGenerate(data) {
  const generatedPreview = document.getElementById('generatedPreview');
  
  if (generatedPreview) {
    generatedPreview.innerHTML = ''; // Clear previous results
    const gridContainer = document.createElement('div');
    gridContainer.classList.add('image-grid');

    data.image_urls.forEach((url, index) => {
      const imageContainer = document.createElement('div');
      imageContainer.classList.add('image-container');

      const img = document.createElement('img');
      img.src = url;
      img.alt = `Generated image ${index + 1}`;
      img.classList.add('generated-image');

      const downloadButton = document.createElement('button');
      downloadButton.textContent = 'Download';
      downloadButton.classList.add('download-button');
      downloadButton.addEventListener('click', () => {
        downloadImage(url, `generated-image-${index + 1}.png`);
      });

      imageContainer.appendChild(img);
      imageContainer.appendChild(downloadButton);
      gridContainer.appendChild(imageContainer);
    });

    generatedPreview.appendChild(gridContainer);
  }
}

function updateUIAfter3DUpload(data) {
  const outputContainer = document.getElementById('output-container');
  const outputUris = data.output;

  if (outputContainer) {
    outputContainer.innerHTML = '';

    outputUris.forEach((uri) => {
      if (uri.endsWith('.obj')) {
        const link = document.createElement('a');
        link.href = uri;
        link.download = 'model.obj';
        link.textContent = 'Download 3D Model (.obj)';
        outputContainer.appendChild(link);
      } else if (uri.endsWith('.png') || uri.endsWith('.jpg') || uri.endsWith('.jpeg')) {
        const img = document.createElement('img');
        img.src = uri;
        outputContainer.appendChild(img);
      } else if (uri.endsWith('.mp4') || uri.endsWith('.webm')) {
        const video = document.createElement('video');
        video.src = uri;
        video.controls = true;
        outputContainer.appendChild(video);
      } else {
        const link = document.createElement('a');
        link.href = uri;
        link.textContent = 'Download Output';
        outputContainer.appendChild(link);
      }
    });
  }
}