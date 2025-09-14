const MenuLogic = {
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

    removeFromCart: function(cart, productId) {
        return cart.filter(item => item.id !== productId);
    },

    getCartItemCount: function(cart) {
        if (!cart) return 0;
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    },

    getCartTotal: function(cart) {
        if (!cart) return 0;
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    },

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

    calculateEstimatedTime: function(pendingOrdersCount, timePerBlock, ordersPerBlock) {
        if (pendingOrdersCount < 0 || !timePerBlock || !ordersPerBlock) return 0;
        if (pendingOrdersCount === 0) {
            return timePerBlock; 
        }
        const blocks = Math.ceil((pendingOrdersCount + 1) / ordersPerBlock);
        return blocks * timePerBlock;
    }
};