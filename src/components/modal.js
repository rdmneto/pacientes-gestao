/**
 * OftalmoCare — Modal Utility
 */

export function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

export function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

/**
 * Creates a modal DOM element and appends it to body
 * @param {string} id
 * @param {string} title
 * @param {string} contentHTML
 * @param {object} options - { width, onClose }
 * @returns {HTMLElement}
 */
export function createModal(id, title, contentHTML, options = {}) {
  // Remove existing
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = id;
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-container" style="max-width:${options.width || '640px'}">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="modal-close" data-close-modal="${id}" aria-label="Fechar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">${contentHTML}</div>
    </div>
  `;

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(id);
  });

  // Close button
  modal.querySelector('[data-close-modal]').addEventListener('click', () => {
    closeModal(id);
    if (options.onClose) options.onClose();
  });

  document.body.appendChild(modal);
  return modal;
}
