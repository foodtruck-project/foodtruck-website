const API_BASE_URL = 'https://api-foodtruck.bentomachado.dev';


window.API_BASE_URL = API_BASE_URL;
function redirectToLoginAndClearStorage() {
    alert('Sessão expirada ou acesso negado. Faça login novamente.');
    localStorage.clear();
    window.location.href = '../index.html';
}

async function fetchData(endpoint, options = {}) {
    const accessToken = localStorage.getItem('accessToken');
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('Fetching URL:', url);
    console.log('Options:', options);
    const headers = {
        'Accept': 'application/json',
        ...options.headers,
    };
    console.log('Access Token:', accessToken);
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
        console.log('Response Data:', data);
        if (!response.ok) {
            const errorMessage = data.detail || data.message || response.statusText;
            console.error(`Erro na requisição para ${url}:`, errorMessage, data);
            throw new Error(errorMessage);
        }
        return data;
    } catch (error) {
        console.error('Erro na requisição:', error);
        return null;
    }
}
