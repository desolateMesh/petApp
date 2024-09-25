export function initializeGallery() {
  const gridItems = document.querySelectorAll('.grid-item');
  gridItems.forEach(item => {
    const img = item.querySelector('img');
    if (img) {
      img.addEventListener('click', openFullImage);
    }
  });
}

function openFullImage(event) {
  const fullImageUrl = event.target.src;
  const windowContent = `
    <html>
      <head>
        <title>Full Image</title>
        <style>
          body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: black; }
          img { max-width: 100%; max-height: 100%; object-fit: contain; }
          #closeBtn { position: absolute; top: 10px; right: 10px; background: white; border: none; font-size: 20px; cursor: pointer; }
        </style>
      </head>
      <body>
        <button id="closeBtn" onclick="window.close()">X</button>
        <img src="${fullImageUrl}" alt="Full Image">
      </body>
    </html>
  `;

  const newWindow = window.open('', '_blank', 'width=800,height=600');
  newWindow.document.write(windowContent);
  newWindow.document.close();
}