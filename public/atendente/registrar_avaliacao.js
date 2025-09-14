const MENSAGENS_AVALIAR = {
    AUTENTICACAO_NECESSARIA: 'Você precisa estar logado para acessar esta página.',
    SESSAO_EXPIRADA: 'Sessão expirada ou acesso negado. Faça login novamente.',
    ERRO_CONFIGURACAO_API: 'Erro de configuração: API_BASE_URL não encontrada.',
    ERRO_CARREGAR_PEDIDOS_AVALIAR: 'Erro ao carregar pedidos para avaliação:',
    NENHUM_PEDIDO_AVALIAR: 'Nenhum pedido concluído disponível para avaliação no momento.',
    ERRO_CARREGAR_PEDIDOS_AVALIADOS: 'Erro ao carregar pedidos já avaliados:',
    NENHUM_PEDIDO_AVALIADO: 'Nenhum pedido foi avaliado ainda.',
    ERRO_ATRIBUIR_NOTA: 'Erro ao atribuir/atualizar nota do pedido:',
    NOTA_SUCESSO: (locator) => `Nota de #${locator} atualizada com sucesso!`,
    ERRO_CONEXAO_SERVIDOR: 'Não foi possível conectar ao servidor.',
    ERRO_CARREGAR_PRODUTOS: 'Erro ao carregar produtos para ranking:',
    ERRO_CARREGAR_PEDIDOS_RANKING: 'Erro ao carregar pedidos para ranking:',
};

const URLS_AVALIAR = {
    LOGIN: '../index.html'
};

let logoutBtn;

let evalOrdersLoading;
let noEvalOrdersMessage;
let ordersToEvaluateList;
let ratingInputCard;
let selectedOrderLocator;
let selectedOrderStatus;
let selectedOrderTotal;
let selectedOrderCreatedAt;
let orderRatingInput;
let submitRatingBtn;
let evaluationMessage;

let evaluatedOrdersLoading;
let noEvaluatedOrdersMessage;
let evaluatedOrdersList;

let rankingLoadingMessage;
let noRankingMessage;
let rankingList;

let currentSelectedOrderId = null; 
let currentSelectedOrderLocator = null; 
let productsCache = new Map(); 
let allOrdersDataForRanking = []; 

const obterTokenAcesso = () => localStorage.getItem('accessToken');

const removerDadosSessao = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('currentOrder');
};

const redirecionarParaLogin = () => {
    window.location.href = URLS_AVALIAR.LOGIN;
};

function lidarComErroAutenticacao(resposta) {
    if (resposta.status === 401 || resposta.status === 403) {
        alert(MENSAGENS_AVALIAR.SESSAO_EXPIRADA);
        removerDadosSessao();
        redirecionarParaLogin();
        return true;
    }
    return false;
}

const formatarDataCriacao = (dataString) => {
    let dataParaParsear = dataString;
    if (!dataString.endsWith('Z') && !dataString.includes('+') && !dataString.includes('-')) {
        dataParaParsear = dataString + 'Z';
    }
    const dataCriacaoPedido = new Date(dataParaParsear);
    
    return dataCriacaoPedido.toLocaleString('pt-BR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo' 
    });
};

const showMainEvaluationMessage = (msg, type) => {
    evaluationMessage.textContent = msg;
    evaluationMessage.className = `message ${type}`;
    evaluationMessage.style.display = 'block';
};

const clearMainEvaluationMessage = () => {
    evaluationMessage.style.display = 'none';
    evaluationMessage.textContent = '';
    evaluationMessage.className = 'message';
};

const showCardMessage = (cardElement, msg, type) => {
    let msgElement = cardElement.querySelector('.card-message');
    if (!msgElement) {
        msgElement = document.createElement('p');
        msgElement.className = 'message card-message';
        cardElement.appendChild(msgElement);
    }
    msgElement.textContent = msg;
    msgElement.className = `message card-message ${type}`;
    msgElement.style.display = 'block';
};

const clearCardMessage = (cardElement) => {
    const msgElement = cardElement.querySelector('.card-message');
    if (msgElement) {
        msgElement.style.display = 'none';
        msgElement.textContent = '';
        msgElement.className = 'message card-message';
    }
};

function renderOrderProducts(products) {
    if (!products || products.length === 0) {
        return '<p>Nenhum produto listado.</p>';
    }
    const productItems = products.map(item => {
        const productName = productsCache.get(item.product_id) || `Produto Desconhecido (ID: ${item.product_id})`;
        return `<li>${item.quantity}x ${productName}</li>`;
    }).join('');
    return `<ul class="order-products-list">${productItems}</ul>`;
}

async function carregarProdutos() {
    try {
        const resposta = await fetch(`${API_BASE_URL}/api/v1/products/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${obterTokenAcesso()}`,
                'Accept': 'application/json'
            }
        });

        if (lidarComErroAutenticacao(resposta)) {
            return;
        }

        const resultado = await resposta.json();

        if (resposta.ok && resultado.items) {
            productsCache.clear();
            resultado.items.forEach(product => {
                productsCache.set(product.id, product.name);
            });
            console.log('Cache de produtos preenchido:', productsCache);
        } else {
            console.error(MENSAGENS_AVALIAR.ERRO_CARREGAR_PRODUTOS, resultado.detail || resultado.message || resposta.statusText);
        }
    } catch (error) {
        console.error('Erro na requisição de produtos:', error);
    }
}

async function carregarPedidosParaAvaliar() {
    evalOrdersLoading.style.display = 'block';
    noEvalOrdersMessage.style.display = 'none';
    ordersToEvaluateList.innerHTML = ''; 
    ratingInputCard.style.display = 'none'; 
    clearMainEvaluationMessage();

    try {
        const queryParams = new URLSearchParams();
        queryParams.append('status', 'COMPLETED'); 
        queryParams.append('limit', 500); 

        const accessToken = obterTokenAcesso();
        const resposta = await fetch(`${API_BASE_URL}/api/v1/orders/?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (lidarComErroAutenticacao(resposta)) {
            evalOrdersLoading.style.display = 'none';
            return;
        }

        const resultado = await resposta.json();

        if (resposta.ok && resultado.orders) {
            let pedidosSemNota = resultado.orders.filter(order => 
                order.status.toUpperCase() === 'COMPLETED' && (order.rating === undefined || order.rating === null)
            );

            if (pedidosSemNota.length > 0) {
                const itemFetchPromises = pedidosSemNota.map(async pedido => {
                    try {
                        const respostaItens = await fetch(`${API_BASE_URL}/api/v1/orders/${pedido.id}/items`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Accept': 'application/json'
                            }
                        });

                        if (lidarComErroAutenticacao(respostaItens)) {
                            pedido.items = [];
                            return pedido;
                        }

                        const resultadoItens = await respostaItens.json();
                        if (respostaItens.ok && resultadoItens.order_items) {
                            pedido.items = resultadoItens.order_items;
                        } else {
                            pedido.items = [];
                        }
                    } catch (error) {
                        pedido.items = [];
                    }
                    return pedido;
                });
                pedidosSemNota = await Promise.all(itemFetchPromises);
            }
            
            if (pedidosSemNota.length === 0) {
                noEvalOrdersMessage.style.display = 'block';
            }
            else {
                pedidosSemNota.forEach(pedido => {
                    const orderCard = document.createElement('div');
                    orderCard.className = 'order-to-evaluate-card';
                    orderCard.dataset.orderId = pedido.id; 
                    orderCard.innerHTML = `
                        <h4>Pedido: ${pedido.locator}</h4>
                        <p>Total: <strong>R$ ${pedido.total ? pedido.total.toFixed(2) : '0.00'}</strong></p>
                        <p>Criado em: <strong>${formatarDataCriacao(pedido.created_at)}</strong></p>
                        ${renderOrderProducts(pedido.items)} `;
                    orderCard.addEventListener('click', () => selectOrderForRating(pedido));
                    ordersToEvaluateList.appendChild(orderCard);
                });
            }
        } else {
            console.error(MENSAGENS_AVALIAR.ERRO_CARREGAR_PEDIDOS_AVALIAR, resultado.detail || resultado.message || resposta.statusText);
            noEvalOrdersMessage.textContent = MENSAGENS_AVALIAR.ERRO_CARREGAR_PEDIDOS_AVALIAR + ' ' + (resultado.detail || resposta.statusText);
            noEvalOrdersMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Erro na requisição de pedidos para avaliação:', error);
        noEvalOrdersMessage.textContent = MENSAGENS_AVALIAR.ERRO_CONEXAO_SERVIDOR;
        noEvalOrdersMessage.style.display = 'block';
    } finally {
        evalOrdersLoading.style.display = 'none';
    }
}

function selectOrderForRating(pedido) {
    document.querySelectorAll('.order-to-evaluate-card').forEach(card => {
        card.classList.remove('selected');
    });

    const selectedCard = document.querySelector(`.order-to-evaluate-card[data-order-id="${pedido.id}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }

    currentSelectedOrderId = pedido.id;
    currentSelectedOrderLocator = pedido.locator;
    
    selectedOrderLocator.textContent = pedido.locator;
    selectedOrderStatus.textContent = pedido.status.toUpperCase(); 
    selectedOrderTotal.textContent = pedido.total ? pedido.total.toFixed(2) : '0.00';
    selectedOrderCreatedAt.textContent = formatarDataCriacao(pedido.created_at);
    
    orderRatingInput.value = ''; 
    ratingInputCard.style.display = 'block'; 
    submitRatingBtn.disabled = false;
    clearMainEvaluationMessage();
}

async function updateOrderRating(orderId, orderLocator, rating, messageElement = null) {
    clearMainEvaluationMessage(); 
    if (messageElement) clearCardMessage(messageElement.closest('.evaluated-order-card')); 

    if (isNaN(rating) || rating < 0 || rating > 5) {
        if (messageElement) {
            showCardMessage(messageElement.closest('.evaluated-order-card'), 'Nota inválida (0-5).', 'error');
        } else {
            showMainEvaluationMessage('Por favor, insira uma nota válida entre 0 e 5.', 'error');
        }
        return false;
    }

    try {
        const resposta = await fetch(`${API_BASE_URL}/api/v1/orders/${orderId}`, {
            method: 'PATCH', 
            headers: {
                'Authorization': `Bearer ${obterTokenAcesso()}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ rating: rating }),
        });

        if (lidarComErroAutenticacao(resposta)) return false;

        const resultado = await resposta.json();

        if (resposta.ok) {
            if (messageElement) {
                showCardMessage(messageElement.closest('.evaluated-order-card'), MENSAGENS_AVALIAR.NOTA_SUCESSO(orderLocator), 'success');
            } else {
                showMainEvaluationMessage(MENSAGENS_AVALIAR.NOTA_SUCESSO(orderLocator), 'success');
            }
            
            await carregarPedidosParaAvaliar(); 
            await carregarPedidosAvaliados();
            await carregarTodosPedidosParaRanking(); 
            calcularEExibirRanking();

            if (!messageElement) { 
                ratingInputCard.style.display = 'none';
                orderRatingInput.value = '';
                currentSelectedOrderId = null;
                currentSelectedOrderLocator = null;
            }
            return true;
        } else {
            const errorMsg = `${MENSAGENS_AVALIAR.ERRO_ATRIBUIR_NOTA} ${resultado.detail || resultado.message || resposta.statusText}`;
            if (messageElement) {
                showCardMessage(messageElement.closest('.evaluated-order-card'), errorMsg, 'error');
            } else {
                showMainEvaluationMessage(errorMsg, 'error');
            }
            console.error('Erro ao atribuir nota:', resultado);
            return false;
        }
    } catch (error) {
        console.error('Erro na requisição de atribuição de nota:', error);
        if (messageElement) {
            showCardMessage(messageElement.closest('.evaluated-order-card'), MENSAGENS_AVALIAR.ERRO_CONEXAO_SERVIDOR, 'error');
        } else {
            showMainEvaluationMessage(MENSAGENS_AVALIAR.ERRO_CONEXAO_SERVIDOR, 'error');
        }
        return false;
    }
}

async function handleSubmitNewRating() {
    await updateOrderRating(currentSelectedOrderId, currentSelectedOrderLocator, parseInt(orderRatingInput.value));
}

async function carregarPedidosAvaliados() {
    evaluatedOrdersLoading.style.display = 'block';
    noEvaluatedOrdersMessage.style.display = 'none';
    evaluatedOrdersList.innerHTML = ''; 

    try {
        const queryParams = new URLSearchParams();
        queryParams.append('status', 'COMPLETED'); 
        queryParams.append('limit', 500); 

        const accessToken = obterTokenAcesso();
        const resposta = await fetch(`${API_BASE_URL}/api/v1/orders/?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (lidarComErroAutenticacao(resposta)) {
            evaluatedOrdersLoading.style.display = 'none';
            return;
        }

        const resultado = await resposta.json();

        if (resposta.ok && resultado.orders) {
            let pedidosComNota = resultado.orders.filter(order => 
                order.status.toUpperCase() === 'COMPLETED' && (order.rating !== undefined && order.rating !== null)
            );

            if (pedidosComNota.length > 0) {
                const itemFetchPromises = pedidosComNota.map(async pedido => {
                    try {
                        const respostaItens = await fetch(`${API_BASE_URL}/api/v1/orders/${pedido.id}/items`, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Accept': 'application/json'
                            }
                        });

                        if (lidarComErroAutenticacao(respostaItens)) {
                            pedido.items = [];
                            return pedido;
                        }

                        const resultadoItens = await respostaItens.json();
                        if (respostaItens.ok && resultadoItens.order_items) {
                            pedido.items = resultadoItens.order_items;
                        } else {
                            pedido.items = [];
                        }
                    } catch (error) {
                        pedido.items = [];
                    }
                    return pedido;
                });
                pedidosComNota = await Promise.all(itemFetchPromises);
            }
            
            if (pedidosComNota.length === 0) {
                noEvaluatedOrdersMessage.style.display = 'block';
            } else {
                pedidosComNota.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); 
                pedidosComNota.forEach(pedido => {
                    const orderCard = document.createElement('div');
                    orderCard.className = 'evaluated-order-card';
                    orderCard.dataset.orderId = pedido.id; 
                    orderCard.innerHTML = `
                        <h4>Pedido: ${pedido.locator}</h4>
                        <p>Total: <strong>R$ ${pedido.total ? pedido.total.toFixed(2) : '0.00'}</strong></p>
                        <p>Criado em: <strong>${formatarDataCriacao(pedido.created_at)}</strong></p>
                        ${renderOrderProducts(pedido.items)} <div class="current-rating">Nota Atual: <strong>${pedido.rating.toFixed(1)}</strong></div>
                        <div class="rating-edit-group">
                            <label for="editRating-${pedido.id}">Nova Nota:</label>
                            <input type="number" id="editRating-${pedido.id}" min="0" max="5" step="1" value="${pedido.rating}">
                            <button class="btn-secondary update-evaluated-rating-btn" data-order-id="${pedido.id}" data-order-locator="${pedido.locator}">Atualizar</button>
                        </div>
                    `;
                    evaluatedOrdersList.appendChild(orderCard);
                });

                document.querySelectorAll('.update-evaluated-rating-btn').forEach(button => {
                    button.addEventListener('click', async (event) => {
                        const orderId = event.target.dataset.orderId;
                        const orderLocator = event.target.dataset.orderLocator;
                        const ratingInput = document.getElementById(`editRating-${orderId}`);
                        const newRating = parseInt(ratingInput.value);
                        await updateOrderRating(orderId, orderLocator, newRating, event.target); 
                    });
                });
            }
        } else {
            console.error(MENSAGENS_AVALIAR.ERRO_CARREGAR_PEDIDOS_AVALIADOS, resultado.detail || resultado.message || resposta.statusText);
            noEvaluatedOrdersMessage.textContent = MENSAGENS_AVALIAR.ERRO_CARREGAR_PEDIDOS_AVALIADOS + ' ' + (resultado.detail || resposta.statusText);
            noEvaluatedOrdersMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Erro na requisição de pedidos avaliados:', error);
        noEvaluatedOrdersMessage.textContent = MENSAGENS_AVALIAR.ERRO_CONEXAO_SERVIDOR;
        noEvaluatedOrdersMessage.style.display = 'block';
    } finally {
        evaluatedOrdersLoading.style.display = 'none';
    }
}

async function carregarTodosPedidosParaRanking() {
    rankingLoadingMessage.style.display = 'block';
    noRankingMessage.style.display = 'none';
    rankingList.style.display = 'none';
    allOrdersDataForRanking = []; 

    try {
        const queryParams = new URLSearchParams();
        queryParams.append('status', 'COMPLETED'); 
        queryParams.append('limit', 1000); 

        const accessToken = obterTokenAcesso();
        const resposta = await fetch(`${API_BASE_URL}/api/v1/orders/?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (lidarComErroAutenticacao(resposta)) {
            rankingLoadingMessage.style.display = 'none';
            return;
        }

        const resultado = await resposta.json();

        if (resposta.ok && resultado.orders) {
            let pedidos = resultado.orders;

            const itemFetchPromises = pedidos.map(async pedido => {
                try {
                    const respostaItens = await fetch(`${API_BASE_URL}/api/v1/orders/${pedido.id}/items`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Accept': 'application/json'
                        }
                    });

                    if (lidarComErroAutenticacao(respostaItens)) {
                        pedido.items = [];
                        return pedido;
                    }

                    const resultadoItens = await respostaItens.json();
                    if (respostaItens.ok && resultadoItens.order_items) {
                        pedido.items = resultadoItens.order_items; 
                    } else {
                        console.error(`Erro ao carregar itens do pedido ${pedido.id}:`, resultadoItens.detail || resultadoItens.message || respostaItens.statusText);
                        pedido.items = []; 
                    }
                } catch (error) {
                    console.error(`Erro na requisição de itens para o pedido ${pedido.id}:`, error);
                    pedido.items = []; 
                }
                return pedido; 
            });

            allOrdersDataForRanking = await Promise.all(itemFetchPromises);
            console.log('Pedidos carregados para ranking:', allOrdersDataForRanking.length);
        } else {
            console.error(MENSAGENS_AVALIAR.ERRO_CARREGAR_PEDIDOS_RANKING, resultado.detail || resultado.message || resposta.statusText);
            noRankingMessage.textContent = `Erro ao carregar ranking: ${resultado.detail || resultado.message || resposta.statusText}`;
            noRankingMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Erro na requisição de pedidos para ranking:', error);
        noRankingMessage.textContent = MENSAGENS_AVALIAR.ERRO_CONEXAO_SERVIDOR;
        noRankingMessage.style.display = 'block';
    } finally {
        rankingLoadingMessage.style.display = 'none';
    }
}

function calcularEExibirRanking() {
    rankingList.innerHTML = ''; 

    const productStats = new Map(); 

    allOrdersDataForRanking.forEach(order => {
        if (order.status.toUpperCase() === 'COMPLETED' && order.rating !== undefined && order.rating !== null) {
            order.items.forEach(item => { 
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
        rankingList.style.display = 'none';
        return;
    }

    const rankingArray = Array.from(productStats.entries()).map(([productId, stats]) => {
        const productName = productsCache.get(productId) || `Produto Desconhecido (ID: ${productId})`;
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
        const card = document.createElement('div');
        card.className = 'ranking-card';
        card.innerHTML = `
            <h4>${product.productName}</h4>
            <div class="ranking-details">
                <p>Vendas Avaliadas: <strong>${product.salesCount}</strong></p>
            </div>
            <div class="average-rating">${product.averageRating.toFixed(2)}</div>
        `;
        rankingList.appendChild(card);
    });

    rankingList.style.display = 'grid';
    noRankingMessage.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', async () => {
    logoutBtn = document.getElementById('logoutBtn');

    evalOrdersLoading = document.getElementById('evalOrdersLoading');
    noEvalOrdersMessage = document.getElementById('noEvalOrdersMessage');
    ordersToEvaluateList = document.getElementById('ordersToEvaluateList');
    ratingInputCard = document.getElementById('ratingInputCard');
    selectedOrderLocator = document.getElementById('selectedOrderLocator');
    selectedOrderStatus = document.getElementById('selectedOrderStatus');
    selectedOrderTotal = document.getElementById('selectedOrderTotal');
    selectedOrderCreatedAt = document.getElementById('selectedOrderCreatedAt');
    orderRatingInput = document.getElementById('orderRatingInput');
    submitRatingBtn = document.getElementById('submitRatingBtn');
    evaluationMessage = document.getElementById('evaluationMessage');

    evaluatedOrdersLoading = document.getElementById('evaluatedOrdersLoading');
    noEvaluatedOrdersMessage = document.getElementById('noEvaluatedOrdersMessage');
    evaluatedOrdersList = document.getElementById('evaluatedOrdersList');

    rankingLoadingMessage = document.getElementById('rankingLoadingMessage');
    noRankingMessage = document.getElementById('noRankingMessage');
    rankingList = document.getElementById('rankingList');

    const accessToken = obterTokenAcesso();

    if (!accessToken) {
        alert(MENSAGENS_AVALIAR.AUTENTICACAO_NECESSARIA);
        redirecionarParaLogin();
        return;
    }

    if (typeof API_BASE_URL === 'undefined') {
        console.error(MENSAGENS_AVALIAR.ERRO_CONFIGURACAO_API.replace('API_BASE_URL não encontrada.', 'API_BASE_URL não está definida. Verifique common.js ou seu escopo.'));
        alert(MENSAGENS_AVALIAR.ERRO_CONFIGURACAO_API);
        return;
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (evento) => {
            evento.preventDefault();
            removerDadosSessao();
            redirecionarParaLogin();
        });
    }

    if (submitRatingBtn) {
        submitRatingBtn.addEventListener('click', handleSubmitNewRating);
    }
    
    await carregarProdutos(); 
    await carregarPedidosParaAvaliar(); 
    await carregarPedidosAvaliados();
    await carregarTodosPedidosParaRanking(); 

    if (productsCache.size > 0 && allOrdersDataForRanking.length > 0) {
        calcularEExibirRanking();
    } else {
        noRankingMessage.style.display = 'block';
    }
});