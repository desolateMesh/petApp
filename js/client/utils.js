// Function to show error messages
export function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  } else {
    console.error('Error:', message);
  }
}


// Function to hide error messages
export function hideError() {
  const errorDiv = document.getElementById('errorMessage');
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
}

// Function to update character count
export function updateCharCount() {
  const promptText = document.getElementById('promptText');
  const charCount = document.getElementById('charCount');
  if (promptText && charCount) {
    const currentLength = promptText.value.length;
    charCount.textContent = `${currentLength} / 500`;
  }
}

// Function to handle image download
export function downloadImage(url, filename) {
  fetch(url)
    .then(response => response.blob())
    .then(blob => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
    .catch(error => {
      console.error('Error downloading image:', error);
      showError('Failed to download the image. Please try again.');
    });
}
