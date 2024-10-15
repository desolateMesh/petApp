// Disable right-click
document.addEventListener('contextmenu', event => event.preventDefault());

// Disable keyboard shortcuts
document.onkeydown = function(e) {
  if(e.keyCode == 123) { // F12 key
    return false;
  }
  if(e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)) { // Ctrl+Shift+I
    return false;
  }
  if(e.ctrlKey && e.shiftKey && e.keyCode == 'C'.charCodeAt(0)) { // Ctrl+Shift+C
    return false;
  }
  if(e.ctrlKey && e.shiftKey && e.keyCode == 'J'.charCodeAt(0)) { // Ctrl+Shift+J
    return false;
  }
  if(e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)) { // Ctrl+U
    return false;
  }
};

/*// Detect DevTools
function detectDevTools() {
  const widthThreshold = window.outerWidth - window.innerWidth > 160;
  const heightThreshold = window.outerHeight - window.innerHeight > 160;
  if (widthThreshold || heightThreshold) {
    window.location.href = "https://petglamappai.com/warning-page";
  }
}

setInterval(detectDevTools, 1000);
*/