// public/menu_ranking_publico/cardapio.js

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
let rankingTable;
let rankingTableBody;
let menuLoadingMessage;
let noMenuMessage;
let menuList;

let productsCache = new Map();
let allOrdersDataForRanking = [];

// Funções para a interface pública
async function carregarProdutosDoMenu() {
    menuLoadingMessage.style.display = 'block';
    noMenuMessage.style.display = 'none';
    menuList.innerHTML = '';
    
    try {
        // Chamando a nova rota pública
        const resposta = await fetch(`${API_BASE_URL}/api/v1/products/public`);
        
        if (!resposta.ok) {
            const resultado = await resposta.json();
            console.error(MENSAGENS_PUBLICO.ERRO_CARREGAR_PRODUTOS, resultado.detail || resultado.message || resposta.statusText);
            noMenuMessage.textContent = MENSAGENS_PUBLICO.ERRO_CARREGAR_PRODUTOS + ' ' + (resultado.detail || resposta.statusText);
            noMenuMessage.style.display = 'block';
            menuLoadingMessage.style.display = 'none';
            return;
        }
        
        const resultado = await resposta.json();
        
        if (resultado && resultado.length > 0) {
            productsCache.clear();
            const productList = document.createElement('ul');
            productList.className = 'product-list';
            resultado.forEach(product => {
                // A nova rota retorna nome e preço. O ID não está disponível aqui.
                const listItem = document.createElement('li');
                listItem.textContent = `${product.name} - R$ ${product.price.toFixed(2)}`;
                productList.appendChild(listItem);
            });
            menuList.appendChild(productList);
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
    rankingTable.style.display = 'none';
    allOrdersDataForRanking = [];

    try {
        const queryParams = new URLSearchParams();
        queryParams.append('status', 'COMPLETED');
        queryParams.append('limit', 1000);

        const resposta = await fetch(`${API_BASE_URL}/api/v1/orders/?${queryParams.toString()}`);

        if (!resposta.ok) {
            const resultado = await resposta.json();
            console.error(MENSAGENS_PUBLICO.ERRO_CARREGAR_PEDIDOS, resultado.detail || resultado.message || resposta.statusText);
            noRankingMessage.textContent = `Erro ao carregar ranking: ${resultado.detail || resultado.message || resposta.statusText}`;
            noRankingMessage.style.display = 'block';
            rankingLoadingMessage.style.display = 'none';
            return;
        }
        
        const resultado = await resposta.json();
        allOrdersDataForRanking = resultado.orders;
    } catch (error) {
        console.error('Erro na requisição de pedidos para ranking:', error);
        noRankingMessage.textContent = MENSAGENS_PUBLICO.ERRO_CONEXAO_SERVIDOR;
        noRankingMessage.style.display = 'block';
    } finally {
        rankingLoadingMessage.style.display = 'none';
    }
}

function calcularEExibirRanking() {
    rankingTableBody.innerHTML = '';

    const productStats = new Map();

    allOrdersDataForRanking.forEach(order => {
        if (order.status.toUpperCase() === 'COMPLETED' && order.rating !== undefined && order.rating !== null) {
            order.products.forEach(item => {
                const productId = item.product_id;
                if (!productStats.has(productId)) {
                    productStats.set(productId, { totalRating: 0, countRating: 0, salesCount: 0 });
                }
                const stats = productStats.get(productId);
                stats.totalRating += order.rating;
                stats.countRating++;
                stats.salesCount += item.quantity;
            });
        }
    });

    if (productStats.size === 0) {
        noRankingMessage.style.display = 'block';
        rankingTable.style.display = 'none';
        return;
    }

    const rankingArray = Array.from(productStats.entries()).map(([productId, stats]) => {
        const productName = productsCache.get(productId) || `Produto Desconhecido`;
        const averageRating = stats.countRating > 0 ? (stats.totalRating / stats.countRating) : 0;
        return {
            productId,
            productName,
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

    rankingArray.forEach(product => {
        const row = rankingTableBody.insertRow();
        const cell1 = row.insertCell(0);
        const cell2 = row.insertCell(1);
        const cell3 = row.insertCell(2);

        cell1.textContent = product.productName;
        cell2.textContent = product.salesCount;
        cell3.textContent = product.averageRating.toFixed(2);
    });

    rankingTable.style.display = 'table';
    noRankingMessage.style.display = 'none';
}

// Lógica de inicialização para a página pública
document.addEventListener('DOMContentLoaded', async () => {
    // Atribuições das referências DOM
    rankingLoadingMessage = document.getElementById('rankingLoadingMessage');
    noRankingMessage = document.getElementById('noRankingMessage');
    rankingTable = document.getElementById('rankingTable');
    rankingTableBody = document.getElementById('rankingTableBody');
    menuLoadingMessage = document.getElementById('menuLoadingMessage');
    noMenuMessage = document.getElementById('noMenuMessage');
    menuList = document.getElementById('menuList');
    
    if (typeof API_BASE_URL === 'undefined') {
        alert(MENSAGENS_PUBLICO.ERRO_CONFIGURACAO_API);
        return;
    }
    
    // Carrega produtos para o menu e para o cache do ranking
    await carregarProdutosDoMenu();
    
    // Carrega pedidos para o ranking
    await carregarTodosPedidosParaRanking();

    // Calcula e exibe o ranking se houver dados
    if (productsCache.size > 0 && allOrdersDataForRanking.length > 0) {
        calcularEExibirRanking();
    } else {
        noRankingMessage.style.display = 'block';
    }
});