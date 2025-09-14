const MENSAGENS_PUBLICO = {
    ERRO_CARREGAR_PRODUTOS: 'Erro ao carregar menu:',
    ERRO_CARREGAR_PEDIDOS: 'Erro ao carregar dados para o ranking:',
    ERRO_CONEXAO_SERVIDOR: 'Não foi possível conectar ao servidor. Tente novamente mais tarde.',
    NENHUM_PRODUTO_MENU: 'Nenhum item disponível no menu no momento.',
    NENHUM_PRODUTO_RANKING: 'Nenhum produto avaliado ainda.',
    ERRO_CONFIGURACAO_API: 'Erro de configuração: API_BASE_URL não está definida.'
};

let rankingLoadingMessage;
let noRankingMessage;
let rankingList; 
let rankingColumn1; 
let rankingColumn2; 
let menuLoadingMessage;
let noMenuMessage;
let foodList;
let drinkList;

let productsCache = new Map();
let allOrdersDataForRanking = [];

async function carregarProdutosDoMenu() {
    menuLoadingMessage.style.display = 'block';
    noMenuMessage.style.display = 'none';
    foodList.innerHTML = '';
    drinkList.innerHTML = '';

    try {
        const resultado = await fetchData('/api/v1/public/products');

        if (resultado && resultado.length > 0) {
            productsCache.clear();
            const foodCardList = document.createElement('div');
            foodCardList.className = 'card-list';
            const drinkCardList = document.createElement('div');
            drinkCardList.className = 'card-list';

            resultado.forEach(product => {
                productsCache.set(product.id, { name: product.name, category: product.category });
                const card = document.createElement('div');
                card.className = 'card';

                const productName = document.createElement('h3');
                productName.textContent = product.name;

                const productPrice = document.createElement('p');
                productPrice.className = 'product-price';
                productPrice.textContent = `R$ ${product.price.toFixed(2)}`;

                card.appendChild(productName);
                card.appendChild(productPrice);

                if (product.category === 'FOOD') {
                    foodCardList.appendChild(card);
                } else if (product.category === 'DRINK') {
                    drinkCardList.appendChild(card);
                }
            });

            foodList.appendChild(foodCardList);
            drinkList.appendChild(drinkCardList);

        } else {
            noMenuMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Erro na requisição de produtos para o menu:', error);
        noMenuMessage.textContent = MENSAGENS_PUBLICO.ERRO_CONEXAO_SERVIDOR;
        noMenuMessage.style.display = 'block';
    } finally {
        menuLoadingMessage.style.display = 'none';
    }
}

async function carregarTodosPedidosParaRanking() {
    rankingLoadingMessage.style.display = 'block';
    noRankingMessage.style.display = 'none';
    rankingColumn1.innerHTML = ''; 
    rankingColumn2.innerHTML = ''; 
    allOrdersDataForRanking = [];

    try {
        const publicProductData = await fetchData('/api/v1/public/orders/');

        if (publicProductData && publicProductData.length > 0) {
            allOrdersDataForRanking = publicProductData;
        } else {
            noRankingMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Erro na requisição de dados para ranking:', error);
        noRankingMessage.textContent = MENSAGENS_PUBLICO.ERRO_CONEXAO_SERVIDOR;
        noRankingMessage.style.display = 'block';
    } finally {
        rankingLoadingMessage.style.display = 'none';
    }
}

function calcularEExibirRanking() {
    rankingColumn1.innerHTML = ''; 
    rankingColumn2.innerHTML = ''; 
    const productStats = new Map();

    allOrdersDataForRanking.forEach(item => {
        if (item.rating !== undefined && item.rating !== null) {
            const productId = item.product_id;
            if (!productStats.has(productId)) {
                productStats.set(productId, { totalRating: 0, countRating: 0, salesCount: 0 });
            }
            const stats = productStats.get(productId);
            stats.totalRating += item.rating;
            stats.countRating++;
            stats.salesCount += item.quantity;
        }
    });

    if (productStats.size === 0) {
        noRankingMessage.style.display = 'block';
        return;
    }

    const rankingArray = Array.from(productStats.entries()).map(([productId, stats]) => {
        const productInfo = productsCache.get(productId);
        const productName = productInfo ? productInfo.name : `Produto Desconhecido`;
        const productCategory = productInfo ? productInfo.category : `UNKNOWN`;
        const averageRating = stats.countRating > 0 ? (stats.totalRating / stats.countRating) : 0;
        return {
            productId,
            productName,
            productCategory,
            averageRating: parseFloat(averageRating.toFixed(2)),
            salesCount: stats.salesCount
        };
    });

    rankingArray.sort((a, b) => {
        if (b.averageRating !== a.averageRating) {
            return b.averageRating - a.averageRating;
        }
        return b.salesCount - a.salesCount;
    });

    const foodRankingArray = rankingArray.filter(product => product.productCategory === 'FOOD');
    const drinkRankingArray = rankingArray.filter(product => product.productCategory === 'DRINK');

    const rankingCardList1 = document.createElement('div');
    rankingCardList1.className = 'card-list';
    const rankingCardList2 = document.createElement('div');
    rankingCardList2.className = 'card-list';

    foodRankingArray.forEach(product => {
        const card = document.createElement('div');
        card.className = 'card ranking-card';

        const productName = document.createElement('h3');
        productName.textContent = product.productName;
        
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'ranking-details';

        const salesSpan = document.createElement('span');
        salesSpan.textContent = `Vendas: ${product.salesCount}`;
        
        const ratingSpan = document.createElement('span');
        ratingSpan.className = 'rating';
        ratingSpan.textContent = `Nota: ${product.averageRating.toFixed(2)} / 5`;

        detailsContainer.appendChild(salesSpan);
        detailsContainer.appendChild(ratingSpan);

        card.appendChild(productName);
        card.appendChild(detailsContainer);
        rankingCardList1.appendChild(card);
    });

    drinkRankingArray.forEach(product => {
        const card = document.createElement('div');
        card.className = 'card ranking-card';

        const productName = document.createElement('h3');
        productName.textContent = product.productName;
        
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'ranking-details';

        const salesSpan = document.createElement('span');
        salesSpan.textContent = `Vendas: ${product.salesCount}`;
        
        const ratingSpan = document.createElement('span');
        ratingSpan.className = 'rating';
        ratingSpan.textContent = `Nota: ${product.averageRating.toFixed(2)} / 5`;

        detailsContainer.appendChild(salesSpan);
        detailsContainer.appendChild(ratingSpan);

        card.appendChild(productName);
        card.appendChild(detailsContainer);
        rankingCardList2.appendChild(card);
    });

    rankingColumn1.appendChild(rankingCardList1);
    rankingColumn2.appendChild(rankingCardList2);
    noRankingMessage.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', async () => {
    rankingLoadingMessage = document.getElementById('rankingLoadingMessage');
    noRankingMessage = document.getElementById('noRankingMessage');
    rankingColumn1 = document.getElementById('rankingColumn1'); 
    rankingColumn2 = document.getElementById('rankingColumn2'); 
    menuLoadingMessage = document.getElementById('menuLoadingMessage');
    noMenuMessage = document.getElementById('noMenuMessage');
    foodList = document.getElementById('foodList');
    drinkList = document.getElementById('drinkList');
    
    if (typeof API_BASE_URL === 'undefined') {
        alert(MENSAGENS_PUBLICO.ERRO_CONFIGURACAO_API);
        return;
    }
    
    await carregarProdutosDoMenu();
    
    await carregarTodosPedidosParaRanking();

    if (productsCache.size > 0 && allOrdersDataForRanking.length > 0) {
        calcularEExibirRanking();
    } else {
        noRankingMessage.style.display = 'block';
    }
});