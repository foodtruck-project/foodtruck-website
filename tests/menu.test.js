window.onload = function() {
    if (typeof mocha === 'undefined' || typeof chai === 'undefined' || typeof MenuLogic === 'undefined' || typeof isUserAdmin === 'undefined') {
        console.error('Mocha, Chai, MenuLogic ou isUserAdmin não foram carregados.');
        return;
    }

    mocha.setup('bdd');
    const expect = chai.expect;

    const mockProducts = [
        { id: '1', name: 'Hambúrguer', category: 'FOOD', price: 25.50 },
        { id: '2', name: 'Refrigerante', category: 'DRINK', price: 5.00 },
        { id: '3', name: 'Batata Frita', category: 'SNACK', price: 12.00 },
        { id: '4', name: 'Pudim', category: 'DESSERT', price: 8.00 },
        { id: '5', name: 'X-Bacon', category: 'FOOD', price: 28.00 },
    ];

    describe('Testes da Lógica do Menu (MenuLogic)', () => {

        describe('Gerenciamento do Carrinho', () => {
            let cart;

            beforeEach(() => {
                cart = [];
            });

            it('deve adicionar um novo item a um carrinho vazio', () => {
                cart = MenuLogic.addToCart(cart, mockProducts[0]);
                expect(cart).to.have.lengthOf(1);
                expect(cart[0]).to.deep.equal({ ...mockProducts[0], quantity: 1 });
            });

            it('deve incrementar a quantidade de um item existente', () => {
                cart = MenuLogic.addToCart(cart, mockProducts[0]);
                cart = MenuLogic.addToCart(cart, mockProducts[0]); 
                expect(cart).to.have.lengthOf(1);
                expect(cart[0].quantity).to.equal(2);
            });

            it('deve diminuir a quantidade de um item', () => {
                cart = MenuLogic.addToCart(cart, mockProducts[0]);
                cart = MenuLogic.addToCart(cart, mockProducts[0]); 
                cart = MenuLogic.updateCartItemQuantity(cart, '1', -1);
                expect(cart[0].quantity).to.equal(1);
            });

            it('deve remover um item se a quantidade for zero ou menos', () => {
                cart = MenuLogic.addToCart(cart, mockProducts[0]);
                cart = MenuLogic.updateCartItemQuantity(cart, '1', -1);
                expect(cart).to.be.an('array').that.is.empty;
            });

            it('deve remover um item específico do carrinho', () => {
                cart = MenuLogic.addToCart(cart, mockProducts[0]);
                cart = MenuLogic.addToCart(cart, mockProducts[1]);
                cart = MenuLogic.removeFromCart(cart, '1');
                expect(cart).to.have.lengthOf(1);
                expect(cart[0].id).to.equal('2');
            });

            it('deve calcular corretamente o número de itens no carrinho', () => {
                cart = MenuLogic.addToCart(cart, mockProducts[0]);
                cart = MenuLogic.addToCart(cart, mockProducts[0]);
                cart = MenuLogic.addToCart(cart, mockProducts[1]);
                const count = MenuLogic.getCartItemCount(cart);
                expect(count).to.equal(3); 
            });

            it('deve calcular o valor total do carrinho', () => {
                cart = MenuLogic.addToCart(cart, mockProducts[0]); 
                cart = MenuLogic.addToCart(cart, mockProducts[1]); 
                cart = MenuLogic.addToCart(cart, mockProducts[1]); 
                const total = MenuLogic.getCartTotal(cart);
                expect(total).to.equal(35.50);
            });
        });

        describe('Lógica de Produtos e Tempo', () => {
            it('deve agrupar produtos por categoria corretamente', () => {
                const grouped = MenuLogic.groupProductsByCategory(mockProducts);
                expect(grouped.FOOD).to.have.lengthOf(2);
                expect(grouped.DRINK).to.have.lengthOf(1);
                expect(grouped.SNACK).to.have.lengthOf(1);
                expect(grouped.DESSERT).to.have.lengthOf(1);
                expect(grouped.FOOD[1].name).to.equal('X-Bacon');
            });

            it('deve calcular o tempo de preparo estimado corretamente', () => {
                const timePerBlock = 8;
                const ordersPerBlock = 2;
                expect(MenuLogic.calculateEstimatedTime(0, timePerBlock, ordersPerBlock)).to.equal(8); 
                expect(MenuLogic.calculateEstimatedTime(1, timePerBlock, ordersPerBlock)).to.equal(8); 
                expect(MenuLogic.calculateEstimatedTime(2, timePerBlock, ordersPerBlock)).to.equal(16); 
                expect(MenuLogic.calculateEstimatedTime(3, timePerBlock, ordersPerBlock)).to.equal(16); 
            });

            it('deve identificar um usuário admin', () => {
                expect(isUserAdmin('admin')).to.be.true;
                expect(isUserAdmin('attendant')).to.be.false;
                expect(isUserAdmin(null)).to.be.false;
            });
        });
    });

    mocha.run();
};