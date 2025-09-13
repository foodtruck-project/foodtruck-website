// foodtruck-website/assets/js/api.js

// Define a base URL para a API.
const API_BASE_URL = 'http://foodtruck.docker.localhost'; // Exemplo: ajuste conforme a sua API
//const API_BASE_URL = 'http://localhost:8000/'; // Se estiver rodando localmente

window.API_BASE_URL = API_BASE_URL;
/**
 * Redireciona o usuário para a página de login e limpa o armazenamento local.
 */
function redirectToLoginAndClearStorage() {
    alert('Sessão expirada ou acesso negado. Faça login novamente.');
    localStorage.clear();
    window.location.href = '../index.html'; // Ajuste o caminho conforme necessário
}

/**
 * Função genérica para fazer requisições à API.
 * Lida com tokens de autenticação e erros comuns (401/403).
 * @param {string} endpoint - O endpoint da API (ex: '/api/v1/products').
 * @param {object} options - Opções para a requisição fetch (method, headers, body, etc.).
 * @returns {Promise<object|null>} Os dados da resposta JSON ou null em caso de erro.
 */
async function fetchData(endpoint, options = {}) {
    const accessToken = localStorage.getItem('accessToken');
    const url = `${API_BASE_URL}${endpoint}`;

    const headers = {
        'Accept': 'application/json',
        ...options.headers,
    };

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers: headers,
        });

        if (response.status === 401 || response.status === 403) {
            redirectToLoginAndClearStorage();
            return null;
        }

        const data = await response.json();

        if (!response.ok) {
            const errorMessage = data.detail || data.message || response.statusText;
            console.error(`Erro na requisição para ${url}:`, errorMessage, data);
            throw new Error(errorMessage);
        }
        return data;
    } catch (error) {
        console.error('Erro na requisição:', error);
        // Pode-se adicionar uma mensagem genérica de erro na UI aqui, se necessário
        return null;
    }
}
