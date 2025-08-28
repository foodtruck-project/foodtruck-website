// public/atendente/relatorios.js
// Lógica para gerar relatórios de vendas com gráficos.

// --- Constantes para Mensagens e URLs ---
const MENSAGENS = {
    AUTENTICACAO_NECESSARIA: 'Você precisa estar logado para acessar esta página.',
    SESSAO_EXPIRADA: 'Sessão expirada ou acesso negado. Faça login novamente.',
    ERRO_CONFIGURACAO_API: 'Erro de configuração: API_BASE_URL não encontrada.',
    ERRO_CARREGAR_DADOS: 'Erro ao carregar dados do relatório:',
    ERRO_CONEXAO_SERVIDOR: 'Não foi possível conectar ao servidor.',
    ERRO_CARREGAR_PRODUTOS: 'Erro ao carregar lista de produtos.'
};

const URLS = {
    LOGIN: '../index.html'
};

// --- Variáveis de Estado e Referências Globais ---
let salesChart = null; // Instância do gráfico Chart.js de vendas
let productRevenueChart = null; // Nova instância para o gráfico de faturamento por produto
let productsCache = new Map(); // Cache para armazenar ID do produto -> { nome: '...', preco: '...' }

// --- Funções Auxiliares (reutilizadas de outros scripts) ---
const obterTokenAcesso = () => localStorage.getItem('accessToken');
const removerDadosSessao = () => { localStorage.removeItem('accessToken'); };
const redirecionarParaLogin = () => { window.location.href = URLS.LOGIN; };

function lidarComErroAutenticacao(resposta) {
    if (resposta.status === 401 || resposta.status === 403) {
        alert(MENSAGENS.SESSAO_EXPIRADA);
        removerDadosSessao();
        redirecionarParaLogin();
        return true;
    }
    return false;
}

/**
 * Carrega todos os produtos da API e preenche o productsCache.
 */
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
            return false;
        }

        const resultado = await resposta.json();

        if (resposta.ok && resultado.products) {
            productsCache.clear();
            resultado.products.forEach(product => {
                productsCache.set(product.id, { name: product.name, price: product.price });
            });
            console.log('Cache de produtos preenchido.');
            return true;
        } else {
            console.error(MENSAGENS.ERRO_CARREGAR_PRODUTOS, resultado.detail || resposta.statusText);
            return false;
        }
    } catch (error) {
        console.error('Erro na requisição de produtos:', error);
        return false;
    }
}

// --- Funções de Processamento de Dados ---

/**
 * Agrupa os pedidos por dia ou mês e calcula o faturamento total.
 * @param {Array<Object>} pedidos - Lista de pedidos concluídos.
 * @param {string} agrupamento - 'day' ou 'month'.
 * @returns {{labels: Array<string>, data: Array<number>}} Objeto com labels e dados para o gráfico.
 */
function processarDadosVendas(pedidos, agrupamento) {
    const dadosAgrupados = {};
    pedidos.forEach(pedido => {
        const data = new Date(pedido.created_at);
        let chave;
        if (agrupamento === 'month') {
            chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
        } else { // 'day'
            chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
        }

        if (!dadosAgrupados[chave]) {
            dadosAgrupados[chave] = 0;
        }
        dadosAgrupados[chave] += pedido.total;
    });

    const labels = Object.keys(dadosAgrupados).sort();
    const data = labels.map(label => dadosAgrupados[label]);
    return { labels, data };
}

/**
 * Calcula o faturamento total por produto.
 * @param {Array<Object>} pedidos - Lista de pedidos concluídos.
 * @returns {{labels: Array<string>, data: Array<number>}} Objeto com labels e dados para o gráfico.
 */
function processarFaturamentoPorProduto(pedidos) {
    const revenueByProduct = new Map();
    pedidos.forEach(pedido => {
        pedido.products.forEach(item => {
            const productId = item.product_id;
            const productInfo = productsCache.get(productId);

            if (productInfo) {
                const total = item.quantity * productInfo.price;
                const currentRevenue = revenueByProduct.get(productId) || 0;
                revenueByProduct.set(productId, currentRevenue + total);
            }
        });
    });

    const labels = [];
    const data = [];

    // Ordena por faturamento, do maior para o menor
    Array.from(revenueByProduct.entries())
         .sort(([, a], [, b]) => b - a)
         .forEach(([productId, totalRevenue]) => {
             const productName = productsCache.get(productId)?.name || `Produto Desconhecido (${productId})`;
             labels.push(productName);
             data.push(totalRevenue);
         });

    return { labels, data };
}


// --- Funções de Renderização na UI ---

function renderizarGrafico(labels, data) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    const tipoAgrupamento = document.getElementById('grouping').value;
    if (salesChart) { salesChart.destroy(); }
    salesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Faturamento (R$)',
                data: data,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: tipoAgrupamento,
                        tooltipFormat: tipoAgrupamento === 'day' ? 'dd/MM/yyyy' : 'MM/yyyy',
                        displayFormats: {
                            day: 'dd/MM',
                            month: 'MMM yyyy'
                        }
                    },
                    title: { display: true, text: 'Período' }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Faturamento (R$)' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) { label += ': '; }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function renderizarGraficoFaturamentoPorProduto(labels, data) {
    const ctx = document.getElementById('productRevenueChart').getContext('2d');
    const noDataMessage = document.getElementById('noProductRevenueDataMessage');

    if (data.length === 0) {
        noDataMessage.style.display = 'block';
        if (productRevenueChart) productRevenueChart.destroy();
        return;
    }

    noDataMessage.style.display = 'none';
    if (productRevenueChart) { productRevenueChart.destroy(); }
    
    // Cores dinâmicas para o gráfico
    const backgroundColors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#E7E9ED', '#8B4513', '#228B22', '#CD5C5C'
    ];
    
    productRevenueChart = new Chart(ctx, {
        type: 'doughnut', // Gráfico de rosca é bom para fatias de um todo
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors.slice(0, labels.length),
                hoverBackgroundColor: backgroundColors.slice(0, labels.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((sum, current) => sum + current, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : 0;
                            const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
                            return `${label}: ${formattedValue} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function atualizarResumo(pedidos) {
    const faturamentoTotal = pedidos.reduce((acc, pedido) => acc + pedido.total, 0);
    const totalPedidos = pedidos.length;
    document.getElementById('totalRevenue').textContent = `R$ ${faturamentoTotal.toFixed(2)}`;
    document.getElementById('totalOrders').textContent = totalPedidos;
}

// --- Funções de Lógica e Carregamento ---

async function carregarRelatorio() {
    const loadingMessage = document.getElementById('loadingMessage');
    const noDataMessage = document.getElementById('noDataMessage');
    const dateRangeSelect = document.getElementById('dateRange');
    const groupingSelect = document.getElementById('grouping');
    
    loadingMessage.style.display = 'block';
    noDataMessage.style.display = 'none';
    document.querySelector('.chart-container').style.display = 'none';
    document.getElementById('summary').style.display = 'none';
    document.getElementById('productRevenueChart').style.display = 'none';
    document.getElementById('noProductRevenueDataMessage').style.display = 'none';

    const agrupamento = groupingSelect.value;
    const selectedRange = dateRangeSelect.value;
    
    let startDate, endDate;

    if (selectedRange !== 'allTime') {
        const period = calcularPeriodo(selectedRange);
        startDate = period.startDate;
        endDate = period.endDate;
    }

    try {
        // Primeiro, carregue a lista de produtos
        const produtosCarregados = await carregarProdutos();
        if (!produtosCarregados) {
             loadingMessage.style.display = 'none';
             return;
        }

        // Em seguida, carregue os pedidos
        const resposta = await fetch(`${API_BASE_URL}/api/v1/orders/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${obterTokenAcesso()}`,
                'Accept': 'application/json'
            }
        });

        if (lidarComErroAutenticacao(resposta)) {
            loadingMessage.style.display = 'none';
            return;
        }

        const resultado = await resposta.json();
        loadingMessage.style.display = 'none';

        if (resposta.ok && resultado.orders?.length > 0) {
            let pedidosParaFiltrar = resultado.orders;

            if (selectedRange === 'allTime') {
                const minDate = new Date(Math.min(...pedidosParaFiltrar.map(p => new Date(p.created_at))));
                startDate = minDate.toISOString().split('T')[0];
                endDate = new Date().toISOString().split('T')[0];
            }

            const pedidosFiltrados = pedidosParaFiltrar.filter(pedido => {
                const pedidoData = new Date(pedido.created_at.split('T')[0]);
                const start = startDate ? new Date(startDate) : null;
                const end = endDate ? new Date(endDate) : null;
                
                const isWithinDateRange = (!start || pedidoData >= start) && (!end || pedidoData <= end);
                const isCompleted = pedido.status === 'COMPLETED';
                return isCompleted && isWithinDateRange;
            });
            

            if (pedidosFiltrados.length > 0) {
                // Faturamento por período (gráfico 1)
                const { labels, data } = processarDadosVendas(pedidosFiltrados, agrupamento);
                
                document.querySelector('.chart-container').style.display = 'block';
                document.getElementById('summary').style.display = 'block';
                document.getElementById('productRevenueChart').style.display = 'block';
                
                renderizarGrafico(labels, data);
                atualizarResumo(pedidosFiltrados);

                // Faturamento por produto (gráfico 2)
                const { labels: productLabels, data: productData } = processarFaturamentoPorProduto(pedidosFiltrados);
                renderizarGraficoFaturamentoPorProduto(productLabels, productData);
            } else {
                noDataMessage.style.display = 'block';
                if (salesChart) salesChart.destroy();
                if (productRevenueChart) productRevenueChart.destroy();
                atualizarResumo([]);
                document.getElementById('noProductRevenueDataMessage').style.display = 'block';
            }
        } else {
            noDataMessage.style.display = 'block';
            if (salesChart) salesChart.destroy();
            if (productRevenueChart) productRevenueChart.destroy();
            atualizarResumo([]);
            document.getElementById('noProductRevenueDataMessage').style.display = 'block';
        }
    } catch (error) {
        console.error(MENSAGENS.ERRO_CARREGAR_DADOS, error);
        loadingMessage.style.display = 'none';
        noDataMessage.textContent = MENSAGENS.ERRO_CONEXAO_SERVIDOR;
        noDataMessage.style.display = 'block';
        document.getElementById('noProductRevenueDataMessage').style.display = 'block';
    }
}

function calcularPeriodo(range) {
    const today = new Date();
    let startDate = new Date(today);
    let endDate = new Date(today);

    switch (range) {
        case 'last7days':
            startDate.setDate(today.getDate() - 7);
            break;
        case 'last30days':
            startDate.setDate(today.getDate() - 30);
            break;
        case 'last90days':
            startDate.setDate(today.getDate() - 90);
            break;
        case 'last180days':
            startDate.setDate(today.getDate() - 180);
            break;
        case 'currentMonth':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            break;
        case 'lastMonth':
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
        case 'currentYear':
            startDate = new Date(today.getFullYear(), 0, 1);
            break;
    }
    
    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
    };
}

// --- Lógica Principal: Executada quando o DOM está completamente carregado ---
document.addEventListener('DOMContentLoaded', () => {
    if (!obterTokenAcesso()) {
        alert(MENSAGENS.AUTENTICACAO_NECESSARIA);
        redirecionarParaLogin();
        return;
    }
    if (typeof API_BASE_URL === 'undefined') {
        alert(MENSAGENS.ERRO_CONFIGURACAO_API);
        return;
    }

    const logoutBtn = document.getElementById('logoutBtn');
    const dateRangeSelect = document.getElementById('dateRange');
    const groupingSelect = document.getElementById('grouping');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            removerDadosSessao();
            redirecionarParaLogin();
        });
    }

    dateRangeSelect.addEventListener('change', carregarRelatorio);
    groupingSelect.addEventListener('change', carregarRelatorio);

    carregarRelatorio();
});