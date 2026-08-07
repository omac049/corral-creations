const CART_STORAGE_KEY = 'corral-creations-cart';
const cart = new Map();
const bagCount = document.querySelector('.bag-count');
const cartDrawer = document.querySelector('.cart-drawer');
const cartItems = document.querySelector('.cart-items');
const cartFooter = document.querySelector('.cart-footer');
const subtotal = document.querySelector('.subtotal strong');
const checkoutMessage = document.querySelector('.checkout-message');
const scrim = document.querySelector('.scrim');
const dialog = document.querySelector('.product-dialog');
const closeCartButton = document.querySelector('.close-cart');
const bagButton = document.querySelector('.bag-button');
const mobileBagButton = document.querySelector('.mobile-nav-bag');
const mobileBagCount = document.querySelector('.mobile-bag-count');
const formMessage = document.querySelector('.form-message');
let currentProduct = null;
let previousFocus = null;

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return;
    saved.forEach((item) => {
      if (item?.id && item?.name && Number.isFinite(item.price) && Number.isFinite(item.quantity) && item.quantity > 0) {
        cart.set(item.id, { ...item, price: Number(item.price), quantity: Math.floor(item.quantity) });
      }
    });
  } catch {
    // Storage can be unavailable in private/file contexts; the bag still works in memory.
  }
}

function persistCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([...cart.values()]));
  } catch {
    // Keep the in-memory bag usable when storage is unavailable.
  }
}

const productFromElement = (el) => ({
  id: el.dataset.id,
  name: el.dataset.name,
  price: Number(el.dataset.price),
  image: el.dataset.image,
});

function addToCart(product) {
  const existing = cart.get(product.id);
  cart.set(product.id, { ...product, quantity: existing ? existing.quantity + 1 : 1 });
  persistCart();
  renderCart();
  openCart();
}

function updateQuantity(id, amount) {
  const item = cart.get(id);
  if (!item) return;
  item.quantity += amount;
  if (item.quantity <= 0) cart.delete(id);
  persistCart();
  renderCart();
}

function renderCart() {
  const items = [...cart.values()];
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  bagCount.textContent = count;
  if (mobileBagCount) mobileBagCount.textContent = count;
  subtotal.textContent = `$${total.toFixed(2)}`;
  cartFooter.hidden = items.length === 0;

  if (!items.length) {
    cartItems.innerHTML = '<p class="empty-cart">Your bag is waiting for something lovely.</p>';
    return;
  }

  cartItems.innerHTML = items.map((item) => `
    <article class="cart-item">
      <img src="${item.image}" alt="" />
      <div>
        <h3>${item.name}</h3>
        <p>$${item.price.toFixed(2)}</p>
        <div class="quantity" aria-label="Quantity for ${item.name}">
          <button type="button" data-action="decrease" data-id="${item.id}" aria-label="Decrease quantity">−</button>
          <span>${item.quantity}</span>
          <button type="button" data-action="increase" data-id="${item.id}" aria-label="Increase quantity">＋</button>
        </div>
      </div>
      <button class="remove-item" type="button" data-action="remove" data-id="${item.id}" aria-label="Remove ${item.name}">×</button>
    </article>
  `).join('');
}

function openCart() {
  previousFocus = document.activeElement;
  scrim.hidden = false;
  requestAnimationFrame(() => cartDrawer.classList.add('open'));
  cartDrawer.setAttribute('aria-hidden', 'false');
  bagButton.setAttribute('aria-expanded', 'true');
  mobileBagButton?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => closeCartButton.focus());
}

function closeCart() {
  cartDrawer.classList.remove('open');
  cartDrawer.setAttribute('aria-hidden', 'true');
  bagButton.setAttribute('aria-expanded', 'false');
  mobileBagButton?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('no-scroll');
  setTimeout(() => { scrim.hidden = true; }, 300);
  if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
}

document.querySelectorAll('.product').forEach((productEl) => {
  const product = productFromElement(productEl);
  productEl.querySelector('.add-button').addEventListener('click', () => addToCart(product));
  productEl.querySelector('.product-image').addEventListener('click', () => {
    currentProduct = product;
    dialog.querySelector('img').src = product.image;
    dialog.querySelector('img').alt = product.name;
    dialog.querySelector('h2').textContent = product.name;
    dialog.querySelector('.dialog-bottom strong').textContent = `$${product.price.toFixed(2)}`;
    dialog.showModal();
  });
});

bagButton.addEventListener('click', openCart);
mobileBagButton?.addEventListener('click', openCart);
document.querySelector('.close-cart').addEventListener('click', closeCart);
scrim.addEventListener('click', closeCart);

cartItems.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === 'remove') { cart.delete(id); persistCart(); }
  if (action === 'increase') updateQuantity(id, 1);
  if (action === 'decrease') updateQuantity(id, -1);
  if (action === 'remove') renderCart();
});

document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
document.querySelector('.dialog-add').addEventListener('click', () => {
  if (currentProduct) addToCart(currentProduct);
  dialog.close();
});
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

const menuButton = document.querySelector('.menu-button');
const mobileMenu = document.querySelector('.mobile-menu');
menuButton.addEventListener('click', () => {
  const open = mobileMenu.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  mobileMenu.setAttribute('aria-hidden', String(!open));
  if (open) mobileMenu.querySelector('a')?.focus();
});
mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  mobileMenu.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open menu');
  mobileMenu.setAttribute('aria-hidden', 'true');
  menuButton.focus();
}));

document.querySelector('.newsletter-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = event.currentTarget.querySelector('input');
  formMessage.textContent = 'Thanks — the studio list is ready to connect to your email platform.';
  input.value = '';
});

document.querySelector('.checkout-button').addEventListener('click', () => {
  checkoutMessage.hidden = false;
  checkoutMessage.textContent = 'Checkout is ready to connect to Shopify, Stripe, or your preferred payment provider.';
});

document.addEventListener('keydown', (event) => {
  const cartOpen = cartDrawer.classList.contains('open');
  const menuOpen = mobileMenu.classList.contains('open');
  if (event.key === 'Tab' && cartOpen) {
    const focusable = [...cartDrawer.querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
    return;
  }
  if (event.key !== 'Escape') return;
  if (cartOpen) closeCart();
  if (menuOpen) {
    mobileMenu.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open menu');
    mobileMenu.setAttribute('aria-hidden', 'true');
    menuButton.focus();
  }
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((el, index) => {
  el.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
  observer.observe(el);
});

loadCart();
renderCart();
