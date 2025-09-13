// public/atendente/menu.logic.js

// Este arquivo contém a lógica de negócio pura, separada da manipulação do DOM,
// para que possa ser testada de forma isolada.

const MenuLogic = {
    /**
     * Adiciona um produto ao carrinho ou aumenta sua quantidade se já existir.
     * @param {Array} cart - O array do carrinho atual.
     * @param {object} product - O objeto do produto a ser adicionado.
     * @returns {Array} O novo estado do carrinho.
     */
    addToCart: function(cart, product) {
        const newCart = [...cart];
        const existingItem = newCart.find(item => item.id === product.id);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            newCart.push({ ...product, quantity: 1 });
        }
        return newCart;
    },

    /**
     * Atualiza a quantidade de um item no carrinho.
     * @param {Array} cart - O array do carrinho atual.
     * @param {string} productId - O ID do produto.
     * @param {number} change - O valor a ser adicionado/removido da quantidade (ex: 1, -1).
     * @returns {Array} O novo estado do carrinho.
     */
    updateCartItemQuantity: function(cart, productId, change) {
        let newCart = [...cart];
        const itemIndex = newCart.findIndex(item => item.id === productId);
        if (itemIndex > -1) {
            newCart[itemIndex].quantity += change;
            if (newCart[itemIndex].quantity <= 0) {
                newCart = newCart.filter(item => item.id !== productId);
            }
        }
        return newCart;
    },

    /**
     * Remove um produto completamente do carrinho.
     * @param {Array} cart - O array do carrinho atual.
     * @param {string} productId - O ID do produto a ser removido.
     * @returns {Array} O novo estado do carrinho.
     */
    removeFromCart: function(cart, productId) {
        return cart.filter(item => item.id !== productId);
    },

    /**
     * Calcula o número total de itens no carrinho.
     * @param {Array} cart - O array do carrinho.
     * @returns {number} O número total de itens.
     */
    getCartItemCount: function(cart) {
        if (!cart) return 0;
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    },

    /**
     * Calcula o valor total do carrinho.
     * @param {Array} cart - O array do carrinho.
     * @returns {number} O valor total.
     */
    getCartTotal: function(cart) {
        if (!cart) return 0;
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    },

    /**
     * Agrupa uma lista de produtos por sua categoria.
     * @param {Array} products - A lista de produtos da API.
     * @returns {object} Um objeto onde as chaves são as categorias e os valores são arrays de produtos.
     */
    groupProductsByCategory: function(products) {
        if (!products) return {};
        return products.reduce((acc, product) => {
            const category = product.category.toUpperCase();
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(product);
            return acc;
        }, {});
    },

    /**
     * Calcula a estimativa de tempo de preparo baseada no número de pedidos pendentes/em preparo.
     * @param {number} pendingOrdersCount - Número de pedidos com status PENDING ou PROCESSING.
     * @param {number} timePerBlock - O tempo base em minutos por bloco de pedidos.
     * @param {number} ordersPerBlock - O número de pedidos em cada bloco de tempo.
     * @returns {number} O tempo estimado em minutos.
     */
    calculateEstimatedTime: function(pendingOrdersCount, timePerBlock, ordersPerBlock) {
        if (pendingOrdersCount < 0 || !timePerBlock || !ordersPerBlock) return 0;
        if (pendingOrdersCount === 0) {
            return timePerBlock; // Se não há pedidos na fila, o primeiro leva o tempo base
        }
        const blocks = Math.ceil((pendingOrdersCount + 1) / ordersPerBlock);
        return blocks * timePerBlock;
    }
};