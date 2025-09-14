const STATUS_PEDIDO = {
    PENDENTE: 'PENDING',
    EM_PREPARACAO: 'PROCESSING',
    CONCLUIDO: 'COMPLETED',
    CANCELADO: 'CANCELLED'
};

const MENSAGENS = {
    AUTENTICACAO_NECESSARIA: 'Você precisa estar logado para acessar esta página.',
    SESSAO_EXPIRADA: 'Sessão expirada ou acesso negado. Faça login novamente.',
    ERRO_CONFIGURACAO_API: 'Erro de configuração: API_BASE_URL não encontrada.',
    ERRO_CARREGAR_PEDIDOS: 'Erro ao carregar pedidos:',
    ERRO_CONEXAO_SERVIDOR: 'Não foi possível conectar ao servidor.',
    CONFIRMACAO_ATUALIZACAO: (locator, novoStatus) => `Deseja realmente mudar o status do pedido #${locator} para "${novoStatus}"?`,
    ERRO_ATUALIZAR_STATUS: 'Erro ao atualizar status do pedido. Verifique as transições permitidas no backend.',
    ERRO_CARREGAR_PRODUTOS: 'Erro ao carregar produtos:'
};

let isFilteredByToday = true; 
let productsCache = new Map(); 

let pendingOrdersList;
let processingOrdersList;
let completedOrdersList;
let cancelledOrdersList;

let countPending;
let countProcessing;
let countCompleted;
let countCancelled;

let loadingMessage;
let noOrdersMessage;
let logoutBtn;
let toggleFilterBtn; 

const gerarHtmlItensPedido = (itensPedido) => {
    console.log('Itens do pedido:', itensPedido); 

    if (!itensPedido || itensPedido.length === 0) {
        return '<li>Nenhum item detalhado disponível.</li>';
    }
    return itensPedido.map(item => {
        const productName = productsCache.get(item.product_id) || `(ID: ${item.product_id})`;
        return `
            <li>
                ${productName}
                <span class="item-quantity">x${item.quantity}</span>
                <span class="item-price">R$ ${item.price ? item.price.toFixed(2) : '0.00'}</span>
            </li>`;
    }).join('');
};

async function carregarProdutos() {
    try {
        const resultado = await fetchData('/api/v1/products/', { method: 'GET' });

        if (resultado && resultado.items) {
            productsCache.clear(); 
            resultado.items.forEach(product => {
                productsCache.set(product.id, product.name);
            });
            console.log('Cache de produtos preenchido:', productsCache);
        } else {
            console.error(MENSAGENS.ERRO_CARREGAR_PRODUTOS, resultado.detail || resultado.message || 'Erro desconhecido');
            alert(`${MENSAGENS.ERRO_CARREGAR_PRODUTOS} ${resultado.detail || resultado.message || 'Erro desconhecido'}`);
        }
    } catch (error) {
        console.error('Erro na requisição de produtos:', error);
        alert(MENSAGENS.ERRO_CONEXAO_SERVIDOR);
    }
}

async function carregarTodosPedidos() {
    loadingMessage.style.display = 'block';
    noOrdersMessage.style.display = 'none';

    pendingOrdersList.innerHTML = '';
    processingOrdersList.innerHTML = '';
    completedOrdersList.innerHTML = '';
    cancelledOrdersList.innerHTML = '';

    let contagens = {
        [STATUS_PEDIDO.PENDENTE]: 0,
        [STATUS_PEDIDO.EM_PREPARACAO]: 0,
        [STATUS_PEDIDO.CONCLUIDO]: 0,
        [STATUS_PEDIDO.CANCELADO]: 0
    };

    try {
        const queryParams = new URLSearchParams();
        Object.values(STATUS_PEDIDO).forEach(status => queryParams.append('status', status));

        const resultado = await fetchData(`/api/v1/orders/?${queryParams.toString()}`, { method: 'GET' });

        if (resultado) {
            let pedidos = resultado.orders; 
            loadingMessage.style.display = 'none';

            if (isFilteredByToday && pedidos?.length) {
                const hojeString = formatDateTimeBR(new Date().toISOString()).split(' ')[0]; 

                pedidos = pedidos.filter(pedido => {
                    const dataPedidoString = formatDateTimeBR(pedido.created_at).split(' ')[0];
                    return dataPedidoString === hojeString;
                });
            }

            if (!pedidos?.length) {
                noOrdersMessage.style.display = 'block';
            } else {
                const itemFetchPromises = pedidos.map(async pedido => {
                    try {
                        const resultadoItens = await fetchData(`/api/v1/orders/${pedido.id}/items`, { method: 'GET' });

                        if (resultadoItens && resultadoItens.order_items) {
                            pedido.products = resultadoItens.order_items; 
                        } else {
                            console.error(`Erro ao carregar itens do pedido ${pedido.id}:`, resultadoItens.detail || resultadoItens.message || 'Erro desconhecido');
                            pedido.products = []; 
                        }
                    } catch (error) {
                        console.error(`Erro na requisição de itens para o pedido ${pedido.id}:`, error);
                        pedido.products = []; 
                    }
                    return pedido; 
                });

                pedidos = await Promise.all(itemFetchPromises);

                pedidos.forEach(pedido => {
                    const { id, locator, status, products, notes, total, created_at } = pedido; 
                    
                    const statusExibicao = status.toUpperCase();

                    const cartaoPedido = document.createElement('div');
                    cartaoPedido.classList.add('order-card', statusExibicao.toLowerCase());

                    const htmlItens = gerarHtmlItensPedido(products); 

                    const transicoesStatus = {
                        [STATUS_PEDIDO.PENDENTE]: [STATUS_PEDIDO.EM_PREPARACAO, STATUS_PEDIDO.CANCELADO],
                        [STATUS_PEDIDO.EM_PREPARACAO]: [STATUS_PEDIDO.CONCLUIDO, STATUS_PEDIDO.CANCELADO],
                        [STATUS_PEDIDO.CONCLUIDO]: [],
                        [STATUS_PEDIDO.CANCELADO]: [STATUS_PEDIDO.PENDENTE]
                    };

                    const proximoStatusPermitido = transicoesStatus[statusExibicao] || [];

                    let htmlOpcoesStatus = `
                        <select class="status-select" data-order-id="${id}">
                            <option value="${statusExibicao}" selected disabled>${statusExibicao}</option>
                            ${proximoStatusPermitido.map(s => `<option value="${s}">${s}</option>`).join('')}
                        </select>
                        <button class="update-status-btn btn-primary" data-order-id="${id}" data-order-locator="${locator}" disabled>Atualizar</button>
                        `;

                    const dataFormatadaCriacao = formatDateTimeBR(created_at);

                    cartaoPedido.innerHTML = `
                        <div class="order-header">
                            <h3>Pedido: ${locator || 'N/A'}</h3>
                        </div>
                        <p class="order-status-display">Status: <span class="status-badge ${statusExibicao.toLowerCase()}">${statusExibicao}</span></p>
                        <div class="order-details">
                            <h4>Itens:</h4>
                            <ul class="order-items-list">${htmlItens}</ul>
                            <p class="order-notes">Observações: ${notes || 'N/A'}</p>
                            <p class="order-total">Total: <strong>R$ ${total ? total.toFixed(2) : '0.00'}</strong></p>
                            <p class="order-created-at">Criado em: ${dataFormatadaCriacao}</p>
                        </div>
                        <div class="order-actions">
                            ${htmlOpcoesStatus}
                        </div>
                        <div class="order-footer-id">
                            <span class="order-id-display">ID: ${id.substring(0, 8)}...</span>
                        </div>
                    `;
                    switch (statusExibicao) {
                        case STATUS_PEDIDO.PENDENTE:
                            pendingOrdersList.appendChild(cartaoPedido);
                            contagens.PENDING++;
                            break;
                        case STATUS_PEDIDO.EM_PREPARACAO:
                            processingOrdersList.appendChild(cartaoPedido);
                            contagens.PROCESSING++;
                            break;
                        case STATUS_PEDIDO.CONCLUIDO:
                            completedOrdersList.appendChild(cartaoPedido);
                            contagens.COMPLETED++;
                            break;
                        case STATUS_PEDIDO.CANCELADO:
                            cancelledOrdersList.appendChild(cartaoPedido);
                            contagens.CANCELLED++;
                            break;
                        default:
                            console.warn('Status desconhecido:', status);
                    }
                });

                countPending.textContent = ` (${contagens.PENDING})`;
                countProcessing.textContent = ` (${contagens.PROCESSING})`;
                countCompleted.textContent = ` (${contagens.CONCLUIDO})`;
                countCancelled.textContent = ` (${contagens.CANCELADO})`;
            }
        } else {
            loadingMessage.style.display = 'none';
            noOrdersMessage.textContent = `${MENSAGENS.ERRO_CARREGAR_PEDIDOS} ${resultado.detail || resultado.message || 'Erro desconhecido'}`;
            noOrdersMessage.style.display = 'block';
            console.error(MENSAGENS.ERRO_CARREGAR_PEDIDOS, resultado.detail || resultado.message || 'Erro desconhecido');
        }
    } catch (error) {
        console.error(MENSAGENS.ERRO_CARREGAR_PEDIDOS, error);
        loadingMessage.style.display = 'none';
        noOrdersMessage.textContent = `${MENSAGENS.ERRO_CARREGAR_PEDIDOS} ${error.message || 'Erro desconhecido'}`;
        noOrdersMessage.style.display = 'block';
    }
}

function updateFilterButtonState() {
    if (isFilteredByToday) {
        toggleFilterBtn.textContent = 'Ver Pedidos de Outros Dias';
        toggleFilterBtn.classList.add('active'); 
    } else {
        toggleFilterBtn.textContent = 'Ver Pedidos de Hoje';
        toggleFilterBtn.classList.remove('active'); 
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    pendingOrdersList = document.getElementById('pendingOrdersList');
    processingOrdersList = document.getElementById('processingOrdersList');
    completedOrdersList = document.getElementById('completedOrdersList');
    cancelledOrdersList = document.getElementById('cancelledOrdersList');

    countPending = document.getElementById('count-pending');
    countProcessing = document.getElementById('count-processing');
    countCompleted = document.getElementById('count-completed');
    countCancelled = document.getElementById('count-cancelled');

    loadingMessage = document.getElementById('loadingMessage');
    noOrdersMessage = document.getElementById('noOrdersMessage');
    logoutBtn = document.getElementById('logoutBtn');
    toggleFilterBtn = document.getElementById('toggleFilterBtn'); 

    if (!localStorage.getItem('accessToken')) {
        alert(MENSAGENS.AUTENTICACAO_NECESSARIA);
        redirectToLoginAndClearStorage();
        return; 
    }

    if (typeof API_BASE_URL === 'undefined') {
        console.error(MENSAGENS.ERRO_CONFIGURACAO_API.replace('API_BASE_URL não encontrada.', 'API_BASE_URL não está definida. Verifique api.js ou seu escopo.'));
        alert(MENSAGENS.ERRO_CONFIGURACAO_API);
        return; 
    }

    await carregarProdutos(); 

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (evento) => {
            evento.preventDefault(); 
            redirectToLoginAndClearStorage();
        });
    }

    if (toggleFilterBtn) {
        toggleFilterBtn.addEventListener('click', () => {
            isFilteredByToday = !isFilteredByToday; 
            updateFilterButtonState(); 
            carregarTodosPedidos(); 
        });
    }

    const ordersBoard = document.querySelector('.orders-board');

    ordersBoard.addEventListener('change', (evento) => {
        if (evento.target.classList.contains('status-select')) {
            const elementoSelecao = evento.target;
            const botaoAtualizar = elementoSelecao.nextElementSibling; 

            const valorSelecionado = elementoSelecao.value;
            const statusAtualReal = elementoSelecao.querySelector('option[selected][disabled]').value;

            botaoAtualizar.disabled = (valorSelecionado === statusAtualReal);
        }
    });

    ordersBoard.addEventListener('click', async (evento) => {
        if (evento.target.classList.contains('update-status-btn')) {
            const botao = evento.target;
            const idPedido = botao.dataset.orderId; 
            const elementoSelecao = botao.previousElementSibling;
            const novoStatus = elementoSelecao.value;

            const locatorPedido = botao.dataset.orderLocator;

            const confirmarAtualizacao = confirm(MENSAGENS.CONFIRMACAO_ATUALIZACAO(locatorPedido, novoStatus));
            if (!confirmarAtualizacao) {
                return; 
            }

            try {
                const resultado = await fetchData(`/api/v1/orders/${idPedido}`, {
                    method: 'PATCH', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ status: novoStatus }), 
                });

                if (resultado) {
                    carregarTodosPedidos();
                } else {
                    alert(resultado.detail || resultado.message || MENSAGENS.ERRO_ATUALIZAR_STATUS);
                    console.error('Erro ao atualizar status:', resultado);
                }
            } catch (error) {
                console.error('Erro na requisição de atualização de status:', error);
                alert(MENSAGENS.ERRO_CONEXAO_SERVIDOR);
            }
        }
    });

    updateFilterButtonState(); 
    carregarTodosPedidos();
});