// public/atendente/relatorios.js
// Lógica para gerar relatórios de vendas com gráficos.

// --- Constantes para Mensagens e URLs ---
const MENSAGENS = {
    AUTENTICACAO_NECESSARIA: 'Você precisa estar logado para acessar esta página.',
    SESSAO_EXPIRADA: 'Sessão expirada ou acesso negado. Faça login novamente.',
    ERRO_CONFIGURACAO_API: 'Erro de configuração: API_BASE_URL não encontrada.',
    ERRO_CARREGAR_DADOS: 'Erro ao carregar dados do relatório:',
    ERRO_CONEXAO_SERVIDOR: 'Não foi possível conectar ao servidor.'
};

const URLS = {
    LOGIN: '../index.html'
};

// --- Variáveis de Estado e Referências Globais ---
let salesChart = null; // Instância do gráfico Chart.js

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

    const agrupamento = groupingSelect.value;
    const selectedRange = dateRangeSelect.value;
    
    let startDate, endDate;

    // Se a opção "Todo o período" for selecionada, não calculamos a data inicial ainda.
    if (selectedRange !== 'allTime') {
        const period = calcularPeriodo(selectedRange);
        startDate = period.startDate;
        endDate = period.endDate;
    }

    try {
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

            // **Nova lógica para a opção "Todo o período"**
            if (selectedRange === 'allTime') {
                // Encontra a data mais antiga dos pedidos
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
                const { labels, data } = processarDadosVendas(pedidosFiltrados, agrupamento);
                
                document.querySelector('.chart-container').style.display = 'block';
                document.getElementById('summary').style.display = 'block';
                
                renderizarGrafico(labels, data);
                atualizarResumo(pedidosFiltrados);
            } else {
                noDataMessage.style.display = 'block';
                if (salesChart) salesChart.destroy();
                atualizarResumo([]);
            }
        } else {
            noDataMessage.style.display = 'block';
            if (salesChart) salesChart.destroy();
            atualizarResumo([]);
        }

    } catch (error) {
        console.error(MENSAGENS.ERRO_CARREGAR_DADOS, error);
        loadingMessage.style.display = 'none';
        noDataMessage.textContent = MENSAGENS.ERRO_CONEXAO_SERVIDOR;
        noDataMessage.style.display = 'block';
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