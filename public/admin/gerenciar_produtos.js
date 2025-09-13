// public/admin/gerenciar_produtos.js
// Lógica para operações CRUD de produtos.

document.addEventListener('DOMContentLoaded', async () => {
    // --- Configurações e Referências ---   

    const ELEMENTS = {
        logoutBtn: document.getElementById('logoutBtn'),
        productsList: document.getElementById('productsList'),
        productsPaginationInfo: document.getElementById('productsPaginationInfo'),
        fetchProductsBtn: document.getElementById('fetchProductsBtn'),
        offsetInput: document.getElementById('offset'),
        limitInput: document.getElementById('limit'),
        prevPageBtn: document.getElementById('prevPageBtn'),
        nextPageBtn: document.getElementById('nextPageBtn'),

        createProductForm: document.getElementById('createProductForm'),
        createProductMessage: document.getElementById('createProductMessage'),
        createName: document.getElementById('createName'),
        createDescription: document.getElementById('createDescription'),
        createPrice: document.getElementById('createPrice'),
        createCategory: document.getElementById('createCategory'),

        getProductIdInput: document.getElementById('getProductId'),
        getProductBtn: document.getElementById('getProductBtn'),
        updateProductForm: document.getElementById('updateProductForm'),
        currentProductIdSpan: document.getElementById('currentProductId'),
        productDetailMessage: document.getElementById('productDetailMessage'),
        updateName: document.getElementById('updateName'),
        updateDescription: document.getElementById('updateDescription'),
        updatePrice: document.getElementById('updatePrice'),
        updateCategory: document.getElementById('updateCategory'),
        submitPatchButton: document.getElementById('submitPatchButton'),
        deleteProductBtn: document.getElementById('deleteProductBtn'),
    };

    const MESSAGES = {
        authRequired: 'Você precisa estar logado para acessar esta página.',
        sessionExpired: 'Sessão expirada ou acesso negado. Faça login novamente.',
        loadingProducts: 'Carregando produtos...',
        noProductsFound: 'Nenhum produto encontrado.',
        errorFetchingProducts: 'Erro ao carregar produtos.',
        serverConnectionError: 'Não foi possível conectar ao servidor.',
        nameRequired: 'O Nome do produto é obrigatório.',
        priceInvalid: 'O Preço deve ser um número válido maior que zero.',
        productCreatedSuccess: (name, id) => `Produto '${name}' (ID: ${id}) criado com sucesso!`,
        productCreatedSuccessNoId: 'Produto criado com sucesso! (ID não disponível na resposta da API)',
        errorCreatingProduct: 'Erro ao criar produto.',
        idRequired: 'Por favor, insira um ID de produto.',
        productLoadedForEdit: (name) => `Produto  ${name} carregado para edição.`,
        productNotFound: (id) => `Produto ID ${id} não encontrado.`,
        errorFetchingProduct: 'Erro ao buscar produto.',
        noFieldsToPatch: 'Nenhum campo para atualização parcial foi modificado.',
        productUpdatedSuccess: (name) => `Produto ${name} atualizado com sucesso!`,
        errorUpdatingProduct: 'Erro ao atualizar produto.',
        noProductSelected: 'Nenhum produto selecionado para ',
        confirmDelete: (id) => `Tem certeza que deseja deletar o produto ID ${id}?`,
        productDeletedSuccess: (name) => `Produto ID ${name} deletado com sucesso!`,
        errorDeletingProduct: 'Erro ao deletar produto.',
    };

    let currentEditProductId = null; // Para rastrear qual produto está sendo editado
    const accessToken = localStorage.getItem('accessToken');

    // --- Validação de Autenticação Inicial ---
    if (!accessToken) {
        alert(MESSAGES.authRequired);
        window.location.href = '../index.html'; // Redirecionar para a página de login
        return; // Impede que o restante do script seja executado sem o token
    }

    // --- Funções Auxiliares ---

    function displayMessage(element, message, type) {
        element.innerText = message;
        switch (type) {
            case 'success':
                element.style.color = 'green';
                break;
            case 'error':
                element.style.color = 'red';
                break;
            case 'warning':
                element.style.color = 'orange';
                break;
            default:
                element.style.color = 'black'; // Cor padrão
        }
    }

    function clearForm(form) {
        form.reset();
    }

    async function fetchData(url, options) {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `Bearer ${accessToken}`,
                    'accept': 'application/json'
                },
            });

            if (response.status === 401 || response.status === 403) {
                displayMessage(ELEMENTS.productDetailMessage, MESSAGES.sessionExpired, 'error');
                localStorage.removeItem('accessToken');
                window.location.href = '../index.html';
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
            displayMessage(ELEMENTS.productDetailMessage, MESSAGES.serverConnectionError, 'error');
            return null;
        }
    }

    // --- Lógica de Logout ---
    if (ELEMENTS.logoutBtn) {
        ELEMENTS.logoutBtn.addEventListener('click', (event) => {
            event.preventDefault();
            localStorage.removeItem('accessToken');
            window.location.href = '../index.html';
        });
    }

    // --- Operações CRUD de Produtos ---

    async function fetchProducts() {
        ELEMENTS.productsList.innerHTML = `<li>${MESSAGES.loadingProducts}</li>`;
        ELEMENTS.productsPaginationInfo.innerText = '';

        // Fetch all products to get total count (less efficient frontend workaround)
        const allProductsData = await fetchData(`${API_BASE_URL}/api/v1/products/?limit=10000`, { method: 'GET' });
        const total_count = allProductsData ? allProductsData.items.length : 0;

        const offset = ELEMENTS.offsetInput.value;
        const limit = ELEMENTS.limitInput.value;
        const queryParams = new URLSearchParams({ offset, limit });

        const data = await fetchData(`${API_BASE_URL}/api/v1/products/?${queryParams.toString()}`, {
            method: 'GET',
        });

        if (data) {
            ELEMENTS.productsList.innerHTML = '';
            const items = data.items;

            if (!items || items.length === 0) {
                ELEMENTS.productsList.innerHTML = `<li>${MESSAGES.noProductsFound}</li>`;
                ELEMENTS.prevPageBtn.disabled = true;
                ELEMENTS.nextPageBtn.disabled = true;
            } else {
                items.forEach(item => {
                    const listItem = document.createElement('li');
                    listItem.innerHTML = `
                        <strong>ID:</strong> ${item.id}<br>
                        <strong>Nome:</strong> ${item.name}<br>
                        <strong>Preço:</strong> R$ ${item.price ? item.price.toFixed(2) : 'N/A'}<br>
                         <strong>Descrição:</strong> ${item.description || 'N/A'}<br>
                        <strong>Categoria:</strong> ${item.category || 'N/A'}<br>
                    `;
                    listItem.style.cursor = 'pointer';
                    listItem.title = 'Clique para carregar este produto';
                    listItem.addEventListener('click', () => {
                        ELEMENTS.getProductIdInput.value = item.id;
                        ELEMENTS.getProductBtn.click();
                    });
                    ELEMENTS.productsList.appendChild(listItem);
                });
                
                const current_offset = parseInt(ELEMENTS.offsetInput.value, 10);
                const current_limit = parseInt(ELEMENTS.limitInput.value, 10);
                const page = Math.floor(current_offset / current_limit) + 1;
                const total_pages = Math.ceil(total_count / current_limit);

                ELEMENTS.productsPaginationInfo.innerText = `Página: ${page} de ${total_pages} (Total: ${total_count} items)`;

                // Handle button states
                ELEMENTS.prevPageBtn.disabled = current_offset === 0;
                ELEMENTS.nextPageBtn.disabled = page >= total_pages;
            }
        } else {
            ELEMENTS.productsList.innerHTML = `<li>${MESSAGES.errorFetchingProducts}</li>`;
            ELEMENTS.prevPageBtn.disabled = true;
            ELEMENTS.nextPageBtn.disabled = true;
        }
    }

    async function createProduct(event) {
        event.preventDefault();
        displayMessage(ELEMENTS.createProductMessage, '', 'default');

        const newProduct = {
            name: ELEMENTS.createName.value,
            description: ELEMENTS.createDescription.value,
            price: parseFloat(ELEMENTS.createPrice.value),
            category: ELEMENTS.createCategory.value,
        };

        if (!newProduct.name || newProduct.name.trim() === '') {
            displayMessage(ELEMENTS.createProductMessage, MESSAGES.nameRequired, 'error');
            return;
        }
        if (isNaN(newProduct.price) || newProduct.price <= 0) {
            displayMessage(ELEMENTS.createProductMessage, MESSAGES.priceInvalid, 'error');
            return;
        }

        const data = await fetchData(`${API_BASE_URL}/api/v1/products/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newProduct)
        });

        if (data) {
            if (data.id) {
                displayMessage(ELEMENTS.createProductMessage, MESSAGES.productCreatedSuccess(newProduct.name, data.id), 'success');
            } else {
                displayMessage(ELEMENTS.createProductMessage, MESSAGES.productCreatedSuccessNoId, 'warning');
            }
            clearForm(ELEMENTS.createProductForm);
            fetchProducts();
        } else {
            displayMessage(ELEMENTS.createProductMessage, MESSAGES.errorCreatingProduct, 'error');
        }
    }

    async function getProductById() {
        const productId = ELEMENTS.getProductIdInput.value.trim();
        displayMessage(ELEMENTS.productDetailMessage, '', 'default');
        ELEMENTS.updateProductForm.style.display = 'none';

        if (!productId) {
            displayMessage(ELEMENTS.productDetailMessage, MESSAGES.idRequired, 'error');
            return;
        }

        const data = await fetchData(`${API_BASE_URL}/api/v1/products/${productId}`, {
            method: 'GET',
        });

        if (data) {
            currentEditProductId = productId;
            ELEMENTS.currentProductIdSpan.innerText = productId;

            ELEMENTS.updateName.value = data.name || '';
            ELEMENTS.updateDescription.value = data.description || '';
            ELEMENTS.updatePrice.value = data.price || '';
            ELEMENTS.updateCategory.value = data.category || '';

            ELEMENTS.updateProductForm.style.display = 'block';
            displayMessage(ELEMENTS.productDetailMessage, MESSAGES.productLoadedForEdit(data.name), 'success');
        } else {
            if (productId && ELEMENTS.productDetailMessage.innerText === MESSAGES.serverConnectionError) {
                // If the error was from connection, the message is already there
            } else {
                displayMessage(ELEMENTS.productDetailMessage, MESSAGES.productNotFound(productId), 'warning');
            }
        }
    }

    async function updateProduct() {
        if (!currentEditProductId) {
            alert(`${MESSAGES.noProductSelected}atualização.`);
            return;
        }
        displayMessage(ELEMENTS.productDetailMessage, '', 'default');

        const productData = {};
        const name = ELEMENTS.updateName.value;
        const description = ELEMENTS.updateDescription.value;
        const price = parseFloat(ELEMENTS.updatePrice.value);
        const category = ELEMENTS.updateCategory.value;

        if (name) productData.name = name;
        if (description) productData.description = description;
        if (!isNaN(price) && price > 0) productData.price = price;
        if (category) productData.category = category;

        if (Object.keys(productData).length === 0) {
            displayMessage(ELEMENTS.productDetailMessage, MESSAGES.noFieldsToPatch, 'warning');
            return;
        }

        const data = await fetchData(`${API_BASE_URL}/api/v1/products/${currentEditProductId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });

        if (data) {
            displayMessage(ELEMENTS.productDetailMessage, MESSAGES.productUpdatedSuccess(productData.name), 'success');
            fetchProducts();
        } else {
            displayMessage(ELEMENTS.productDetailMessage, MESSAGES.errorUpdatingProduct, 'error');
        }
    }

    async function deleteProduct() {
        if (!currentEditProductId) {
            alert(`${MESSAGES.noProductSelected}exclusão.`);
            return;
        }
        displayMessage(ELEMENTS.productDetailMessage, '', 'default');

        if (!confirm(MESSAGES.confirmDelete(currentEditProductId))) {
            return;
        }

        const data = await fetchData(`${API_BASE_URL}/api/v1/products/${currentEditProductId}`, {
            method: 'DELETE',
        });

        if (data !== null) {
            displayMessage(ELEMENTS.productDetailMessage, MESSAGES.productDeletedSuccess(ELEMENTS.updateName.value), 'success');
            ELEMENTS.updateProductForm.style.display = 'none';
            currentEditProductId = null;
            ELEMENTS.getProductIdInput.value = '';
            fetchProducts();
        } else {
            displayMessage(ELEMENTS.productDetailMessage, MESSAGES.errorDeletingProduct, 'error');
        }
    }

    // --- Chamadas Iniciais e Event Listeners ---
    ELEMENTS.fetchProductsBtn.addEventListener('click', fetchProducts);
    ELEMENTS.createProductForm.addEventListener('submit', createProduct);
    ELEMENTS.getProductBtn.addEventListener('click', getProductById);
    ELEMENTS.submitPatchButton.addEventListener('click', updateProduct);
    ELEMENTS.deleteProductBtn.addEventListener('click', deleteProduct);

    ELEMENTS.prevPageBtn.addEventListener('click', () => {
        let offset = parseInt(ELEMENTS.offsetInput.value, 10);
        let limit = parseInt(ELEMENTS.limitInput.value, 10);
        offset = Math.max(0, offset - limit);
        ELEMENTS.offsetInput.value = offset;
        fetchProducts();
    });

    ELEMENTS.nextPageBtn.addEventListener('click', () => {
        let offset = parseInt(ELEMENTS.offsetInput.value, 10);
        let limit = parseInt(ELEMENTS.limitInput.value, 10);
        offset += limit;
        ELEMENTS.offsetInput.value = offset;
        fetchProducts();
    });

    // Carrega os produtos ao iniciar a página
    fetchProducts();
});