const { ipcRenderer } = require('electron');

class ResizeHandler {
  constructor() {
    this.isResizing = false;
    this.resizeDirection = null;
    this.startBounds = null;
    this.startMousePos = { x: 0, y: 0 };
    
    this.init();
  }

  init() {
    // Add event listeners to all resize handles
    const resizeHandles = document.querySelectorAll('.resize-handle');
    
    resizeHandles.forEach(handle => {
      handle.addEventListener('mousedown', this.startResize.bind(this));
    });

    // Global mouse events
    document.addEventListener('mousemove', this.doResize.bind(this));
    document.addEventListener('mouseup', this.stopResize.bind(this));
    
    // Prevent drag on resize handles
    resizeHandles.forEach(handle => {
      handle.addEventListener('dragstart', (e) => e.preventDefault());
    });
  }

  async startResize(e) {
    e.preventDefault();
    e.stopPropagation();
    
    this.isResizing = true;
    this.resizeDirection = this.getResizeDirection(e.target);
    this.startBounds = await ipcRenderer.invoke('get-window-bounds');
    this.startMousePos = { x: e.screenX, y: e.screenY };
    
    // Add global cursor style
    document.body.style.cursor = e.target.style.cursor;
    
    // Disable text selection during resize
    document.body.style.userSelect = 'none';
    
    // Only disable pointer events on text elements during resize, not buttons
    const elementsToDisable = document.querySelectorAll('h1, p, input[type="text"]');
    elementsToDisable.forEach(el => {
      el.style.pointerEvents = 'none';
      el.dataset.resizeDisabled = 'true';
    });
  }

  doResize(e) {
    if (!this.isResizing || !this.resizeDirection || !this.startBounds) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const deltaX = e.screenX - this.startMousePos.x;
    const deltaY = e.screenY - this.startMousePos.y;
    
    const newBounds = { ...this.startBounds };
    
    // Calculate new bounds based on resize direction
    switch (this.resizeDirection) {
      case 'n':
        newBounds.y += deltaY;
        newBounds.height -= deltaY;
        break;
      case 's':
        newBounds.height += deltaY;
        break;
      case 'w':
        newBounds.x += deltaX;
        newBounds.width -= deltaX;
        break;
      case 'e':
        newBounds.width += deltaX;
        break;
      case 'nw':
        newBounds.x += deltaX;
        newBounds.y += deltaY;
        newBounds.width -= deltaX;
        newBounds.height -= deltaY;
        break;
      case 'ne':
        newBounds.y += deltaY;
        newBounds.width += deltaX;
        newBounds.height -= deltaY;
        break;
      case 'sw':
        newBounds.x += deltaX;
        newBounds.width -= deltaX;
        newBounds.height += deltaY;
        break;
      case 'se':
        newBounds.width += deltaX;
        newBounds.height += deltaY;
        break;
    }
    
    // Apply minimum and maximum constraints
    const minWidth = 300;
    const minHeight = 200;
    const maxWidth = 1000;
    const maxHeight = 800;
    
    if (newBounds.width < minWidth) {
      if (this.resizeDirection.includes('w')) {
        newBounds.x = this.startBounds.x + this.startBounds.width - minWidth;
      }
      newBounds.width = minWidth;
    }
    
    if (newBounds.height < minHeight) {
      if (this.resizeDirection.includes('n')) {
        newBounds.y = this.startBounds.y + this.startBounds.height - minHeight;
      }
      newBounds.height = minHeight;
    }
    
    if (newBounds.width > maxWidth) {
      newBounds.width = maxWidth;
    }
    
    if (newBounds.height > maxHeight) {
      newBounds.height = maxHeight;
    }
    
    // Apply the new bounds via IPC
    ipcRenderer.invoke('set-window-bounds', newBounds);
  }

  stopResize() {
    if (!this.isResizing) return;
    
    this.isResizing = false;
    this.resizeDirection = null;
    this.startBounds = null;
    
    // Reset cursor and selection
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Re-enable pointer events on previously disabled elements
    const disabledElements = document.querySelectorAll('[data-resize-disabled="true"]');
    disabledElements.forEach(el => {
      el.style.pointerEvents = '';
      delete el.dataset.resizeDisabled;
    });
  }

  getResizeDirection(element) {
    const classList = element.classList;
    
    if (classList.contains('resize-n')) return 'n';
    if (classList.contains('resize-s')) return 's';
    if (classList.contains('resize-w')) return 'w';
    if (classList.contains('resize-e')) return 'e';
    if (classList.contains('resize-nw')) return 'nw';
    if (classList.contains('resize-ne')) return 'ne';
    if (classList.contains('resize-sw')) return 'sw';
    if (classList.contains('resize-se')) return 'se';
    
    return null;
  }
}

// Initialize resize handler when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Add a small delay to ensure other scripts have initialized
    setTimeout(() => {
      new ResizeHandler();
    }, 100);
  });
} else {
  // Add a small delay to ensure other scripts have initialized
  setTimeout(() => {
    new ResizeHandler();
  }, 100);
}