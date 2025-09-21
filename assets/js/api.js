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

        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            // Handle non-JSON responses (like HTML error pages from Cloudflare)
            const textData = await response.text();
            console.warn('Received non-JSON response:', textData);
            data = { message: textData || response.statusText };
        }

        console.log('Response Data:', data);
        if (!response.ok) {
            const errorMessage = data.detail || data.message || data.error || response.statusText;
            console.error(`Erro na requisição para ${url}:`, errorMessage, data);
            throw new Error(errorMessage);
        }
        return data;
    } catch (error) {
        console.error('Erro na requisição:', error);
        return null;
    }
}
