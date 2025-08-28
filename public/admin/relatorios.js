// public/atendente/relatorios.js
// Lógica para gerar relatórios de vendas com gráficos.

// --- Constantes para Mensagens e URLs ---
const MENSAGENS = {
    AUTENTICACAO_NECESSARIA: 'Você precisa estar logado para acessar esta página.',
    SESSAO_EXPIRADA: 'Sessão expirada ou acesso negado. Faça login novamente.',
    ERRO_CONFIGURACAO_API: 'Erro de configuração: API_BASE_URL não encontrada.',
    ERRO_CARREGAR_DADOS: 'Erro ao carregar dados do relatório:',
    ERRO_CONEXAO_SERVIDOR: 'Não foi possível conectar ao servidor.',
    PERIODO_INVALIDO: 'A data de início não pode ser posterior à data de fim.'
};

const URLS = {
    LOGIN: '../index.html'
};

// --- Variáveis de Estado e Referências Globais ---
let salesChart = null; // Instância do gráfico Chart.js

// --- Funções Auxiliares (reutilizadas de outros scripts) ---

/**
 * Obtém o token de acesso do localStorage.
 * @returns {string|null} O token de acesso ou null se não existir.
 */
const obterTokenAcesso = () => localStorage.getItem('accessToken');

/**
 * Remove os dados de sessão do localStorage.
 */
const removerDadosSessao = () => {
    localStorage.removeItem('accessToken');
};

/**
 * Redireciona o usuário para a página de login.
 */
const redirecionarParaLogin = () => {
    window.location.href = URLS.LOGIN;
};

/**
 * Lida com erros de autenticação ou autorização da API.
 * @param {Response} resposta - A resposta da requisição fetch.
 * @returns {boolean} True se um erro foi tratado, false caso contrário.
 */
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
            // Chave no formato 'AAAA-MM'
            chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
        } else { // 'day'
            // Chave no formato 'AAAA-MM-DD'
            chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
        }

        if (!dadosAgrupados[chave]) {
            dadosAgrupados[chave] = 0;
        }
        dadosAgrupados[chave] += pedido.total;
    });

    // Ordena as chaves (datas) e prepara os dados para o gráfico
    const labels = Object.keys(dadosAgrupados).sort();
    const data = labels.map(label => dadosAgrupados[label]);

    return { labels, data };
}

// --- Funções de Renderização na UI ---

/**
 * Renderiza ou atualiza o gráfico de vendas.
 * @param {Array<string>} labels - As labels para o eixo X.
 * @param {Array<number>} data - Os valores para o eixo Y.
 */
function renderizarGrafico(labels, data) {
    const ctx = document.getElementById('salesChart').getContext('2d');
    const tipoAgrupamento = document.getElementById('grouping').value;

    if (salesChart) {
        salesChart.destroy(); // Destrói o gráfico antigo antes de criar um novo
    }

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
                    title: {
                        display: true,
                        text: 'Período'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Faturamento (R$)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
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

/**
 * Atualiza os cartões de resumo com o faturamento total e o número de pedidos.
 * @param {Array<Object>} pedidos - A lista de pedidos filtrada.
 */
function atualizarResumo(pedidos) {
    const faturamentoTotal = pedidos.reduce((acc, pedido) => acc + pedido.total, 0);
    const totalPedidos = pedidos.length;

    document.getElementById('totalRevenue').textContent = `R$ ${faturamentoTotal.toFixed(2)}`;
    document.getElementById('totalOrders').textContent = totalPedidos;
}

// --- Função Principal de Carregamento de Dados ---

/**
 * Busca os pedidos concluídos da API dentro de um intervalo de datas e atualiza a UI.
 */
async function carregarRelatorio() {
    const loadingMessage = document.getElementById('loadingMessage');
    const noDataMessage = document.getElementById('noDataMessage');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const groupingSelect = document.getElementById('grouping');

    loadingMessage.style.display = 'block';
    noDataMessage.style.display = 'none';
    document.querySelector('.chart-container').style.display = 'none';
    document.getElementById('summary').style.display = 'none';

    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    const agrupamento = groupingSelect.value;

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        alert(MENSAGENS.PERIODO_INVALIDO);
        loadingMessage.style.display = 'none';
        return;
    }

    try {
        const queryParams = new URLSearchParams({
            status: 'COMPLETED'
        });
        if (startDate) queryParams.append('start_date', startDate);
        if (endDate) queryParams.append('end_date', `${endDate}T23:59:59`); // Inclui o dia todo

        const resposta = await fetch(`${API_BASE_URL}/api/v1/orders/?${queryParams.toString()}`, {
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
            // **CORREÇÃO AQUI: Adicionar filtragem no lado do cliente**
            const pedidosConcluidos = resultado.orders.filter(pedido => pedido.status === 'COMPLETED');

            if (pedidosConcluidos.length > 0) {
                const { labels, data } = processarDadosVendas(pedidosConcluidos, agrupamento);
                
                document.querySelector('.chart-container').style.display = 'block';
                document.getElementById('summary').style.display = 'block';
                
                renderizarGrafico(labels, data);
                atualizarResumo(pedidosConcluidos);
            } else {
                noDataMessage.style.display = 'block';
                if (salesChart) salesChart.destroy();
                atualizarResumo([]);
            }
        } else {
            noDataMessage.style.display = 'block';
            if (salesChart) salesChart.destroy();
            atualizarResumo([]); // Limpa o resumo
        }

    } catch (error) {
        console.error(MENSAGENS.ERRO_CARREGAR_DADOS, error);
        loadingMessage.style.display = 'none';
        noDataMessage.textContent = MENSAGENS.ERRO_CONEXAO_SERVIDOR;
        noDataMessage.style.display = 'block';
    }
}

// --- Lógica Principal: Executada quando o DOM está completamente carregado ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Validação de Autenticação e Configuração ---
    if (!obterTokenAcesso()) {
        alert(MENSAGENS.AUTENTICACAO_NECESSARIA);
        redirecionarParaLogin();
        return;
    }

    if (typeof API_BASE_URL === 'undefined') {
        alert(MENSAGENS.ERRO_CONFIGURACAO_API);
        return;
    }

    // --- Referências DOM e Configuração Inicial ---
    const logoutBtn = document.getElementById('logoutBtn');
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    // Define o período padrão para os últimos 30 dias
    const hoje = new Date();
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);

    endDateInput.value = hoje.toISOString().split('T')[0];
    startDateInput.value = trintaDiasAtras.toISOString().split('T')[0];

    // --- Event Listeners ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            removerDadosSessao();
            redirecionarParaLogin();
        });
    }

    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', carregarRelatorio);
    }

    // --- Carregamento Inicial ---
    carregarRelatorio();
});