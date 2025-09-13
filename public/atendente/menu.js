// public/atendente/menu.js
// Este arquivo lida com a manipulação do DOM e os eventos da página do menu,
// delegando a lógica de negócio para o MenuLogic.

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Referências a Elementos do DOM ---
    const DOM = {
        adminOnlyLinks: document.querySelectorAll('.admin-only'),
        logoutBtn: document.getElementById('logoutBtn'),
        loadingMessage: document.getElementById('loadingMessage'),
        noProductsMessage: document.getElementById('noProductsMessage'),
        productsBoard: document.querySelector('.products-board'),
        categoryColumns: {
            FOOD: document.getElementById('foodProductsList'),
            DRINK: document.getElementById('drinkProductsList'),
            DESSERT: document.getElementById('dessertProductsList'),
            SNACK: document.getElementById('snackProductsList'),
        },
        categoryCounts: {
            FOOD: document.getElementById('count-food'),
            DRINK: document.getElementById('count-drink'),
            DESSERT: document.getElementById('count-dessert'),
            SNACK: document.getElementById('count-snack'),
        },
        viewCartBtn: document.getElementById('viewCartBtn'),
        cartItemCount: document.getElementById('cartItemCount'),
        preparationTimeEstimate: document.getElementById('preparationTimeEstimate'),
        estimatedMinutesSpan: document.getElementById('estimatedMinutes'),
        pendingOrdersCountSpan: document.getElementById('pendingOrdersCount'),
        cartModal: document.getElementById('cartModal'),
        closeButton: document.querySelector('.close-button'),
        cartItemsList: document.getElementById('cartItems'),
        cartTotalSpan: document.getElementById('cartTotal'),
        clearCartBtn: document.getElementById('clearCartBtn'),
        checkoutBtn: document.getElementById('checkoutBtn'),
        orderNotesInput: document.getElementById('orderNotes'),
    };

    // --- 2. Variáveis de Estado ---
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    let allProducts = [];

    // --- 3. Constantes ---
    const ESTIMATED_TIME_PER_ORDER_BLOCK = 8;
    const ORDERS_PER_BLOCK = 2;
    const REFRESH_INTERVAL_MS = 30000;

    // --- 4. Funções de Renderização e DOM ---

    function updateCartCount() {
        const count = MenuLogic.getCartItemCount(cart);
        DOM.cartItemCount.textContent = count;
    }

    function renderCart() {
        DOM.cartItemsList.innerHTML = '';
        if (cart.length === 0) {
            DOM.cartItemsList.innerHTML = '<li class="empty-cart-message">Seu carrinho está vazio.</li>';
            DOM.checkoutBtn.disabled = true;
        } else {
            cart.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${item.name} (R$ ${item.price.toFixed(2)})</span>
                    <div class="cart-item-controls">
                        <button class="quantity-btn decrease-quantity" data-id="${item.id}">-</button>
                        <span class="quantity">${item.quantity}</span>
                        <button class="quantity-btn increase-quantity" data-id="${item.id}">+</button>
                        <button class="remove-from-cart-btn btn-danger" data-id="${item.id}">Remover</button>
                    </div>
                `;
                DOM.cartItemsList.appendChild(li);
            });
            DOM.checkoutBtn.disabled = false;
        }
        const total = MenuLogic.getCartTotal(cart);
        DOM.cartTotalSpan.textContent = total.toFixed(2);
    }

    function createProductCard(product) {
        const productCard = document.createElement('div');
        productCard.classList.add('product-card');
        productCard.innerHTML = `
            <div class="product-header">
                <h3>${product.name}</h3>
                <span class="product-category">${product.category}</span>
            </div>
            <p class="product-description">${product.description || 'Sem descrição.'}</p>
            <p class="product-price">R$ ${product.price.toFixed(2)}</p>
            <button class="add-to-cart-btn btn-primary" data-id="${product.id}">Adicionar ao Carrinho</button>
        `;
        return productCard;
    }

    function renderProducts(products) {
        Object.values(DOM.categoryColumns).forEach(col => col.innerHTML = '');
        Object.values(DOM.categoryCounts).forEach(count => count.textContent = ' (0)');

        const groupedProducts = MenuLogic.groupProductsByCategory(products);

        for (const category in groupedProducts) {
            const column = DOM.categoryColumns[category];
            const countSpan = DOM.categoryCounts[category];
            if (column && countSpan) {
                groupedProducts[category].forEach(product => {
                    column.appendChild(createProductCard(product));
                });
                countSpan.textContent = ` (${groupedProducts[category].length})`;
            }
        }
    }

    // --- 5. Funções de Lógica de Aplicação (API, etc.) ---

    async function loadProducts() {
        DOM.loadingMessage.style.display = 'block';
        DOM.noProductsMessage.style.display = 'none';
        try {
            const result = await fetchData('/api/v1/products/', { method: 'GET' });
            if (result) {
                allProducts = result.items;
                renderProducts(allProducts);
            } else {
                DOM.noProductsMessage.textContent = 'Erro ao carregar produtos.';
                DOM.noProductsMessage.style.display = 'block';
            }
        } catch (error) {
            DOM.noProductsMessage.textContent = 'Não foi possível conectar ao servidor.';
            DOM.noProductsMessage.style.display = 'block';
        } finally {
            DOM.loadingMessage.style.display = 'none';
        }
    }

    async function displayEstimatedTime() {
        try {
            const queryParams = new URLSearchParams({ status: 'PENDING', status: 'PROCESSING' });
            const result = await fetchData(`/api/v1/orders/?${queryParams.toString()}`, { method: 'GET' });
            if (result) {
                const pendingCount = result.orders.length;
                const estimatedTime = MenuLogic.calculateEstimatedTime(pendingCount, ESTIMATED_TIME_PER_ORDER_BLOCK, ORDERS_PER_BLOCK);
                DOM.estimatedMinutesSpan.textContent = estimatedTime;
                DOM.pendingOrdersCountSpan.textContent = pendingCount;
                DOM.preparationTimeEstimate.style.display = 'block';
            }
        } catch (error) {
            console.error('Erro ao buscar estimativa de tempo:', error);
        }
    }

    async function checkout() {
        if (cart.length === 0) return alert('Seu carrinho está vazio!');
        
        const orderPayload = {
            items: cart.map(item => ({ product_id: item.id, quantity: item.quantity, price: item.price })),
            notes: DOM.orderNotesInput.value.trim()
        };

        try {
            const result = await fetchData('/api/v1/orders/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            });
            if (result) {
                alert(`Pedido #${result.id.substring(0, 8)} criado com sucesso!`);
                cart = [];
                localStorage.removeItem('cart');
                updateCartCount();
                renderCart();
                DOM.cartModal.style.display = 'none';
                DOM.orderNotesInput.value = '';
                displayEstimatedTime();
            } else {
                alert(`Erro ao finalizar pedido: ${result.detail || 'Não foi possível conectar ao servidor para finalizar o pedido.'}`);
            }
        } catch (error) {
            alert('Não foi possível conectar ao servidor para finalizar o pedido.');
        }
    }

    // --- 6. Event Listeners ---
    DOM.logoutBtn.addEventListener('click', (e) => { e.preventDefault(); redirectToLoginAndClearStorage(); });
    DOM.viewCartBtn.addEventListener('click', () => { renderCart(); DOM.cartModal.style.display = 'block'; });
    DOM.closeButton.addEventListener('click', () => DOM.cartModal.style.display = 'none');
    window.addEventListener('click', (e) => { if (e.target === DOM.cartModal) DOM.cartModal.style.display = 'none'; });
    DOM.checkoutBtn.addEventListener('click', checkout);

    DOM.productsBoard.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-to-cart-btn')) {
            const product = allProducts.find(p => p.id === e.target.dataset.id);
            if (product) {
                cart = MenuLogic.addToCart(cart, product);
                localStorage.setItem('cart', JSON.stringify(cart));
                updateCartCount();
            }
        }
    });

    DOM.cartItemsList.addEventListener('click', (e) => {
        const productId = e.target.dataset.id;
        if (e.target.classList.contains('decrease-quantity')) {
            cart = MenuLogic.updateCartItemQuantity(cart, productId, -1);
        } else if (e.target.classList.contains('increase-quantity')) {
            cart = MenuLogic.updateCartItemQuantity(cart, productId, 1);
        } else if (e.target.classList.contains('remove-from-cart-btn')) {
            cart = MenuLogic.removeFromCart(cart, productId);
        }
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        renderCart();
    });

    DOM.clearCartBtn.addEventListener('click', () => {
        if (confirm('Tem certeza que deseja limpar o carrinho?')) {
            cart = [];
            localStorage.removeItem('cart');
            updateCartCount();
            renderCart();
            DOM.orderNotesInput.value = '';
        }
    });

    // --- 7. Inicialização ---
    if (!localStorage.getItem('accessToken')) {
        redirectToLoginAndClearStorage();
        return;
    }
    if (!isUserAdmin(localStorage.getItem('userRole'))) {
        DOM.adminOnlyLinks.forEach(link => link.style.display = 'none');
    }

    updateCartCount();
    loadProducts();
    displayEstimatedTime();
    setInterval(displayEstimatedTime, REFRESH_INTERVAL_MS);
});