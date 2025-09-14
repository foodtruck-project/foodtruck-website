async function handleLogin(username, password, fetchFunc) {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
        const response = await fetchFunc(`${API_BASE_URL}/api/v1/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('accessToken', data.access_token);
            const userRole = data.user?.role;
            localStorage.setItem('userRole', userRole);

            let redirectUrl = '';
            if (userRole === 'attendant') {
                redirectUrl = '../public/atendente/menu.html'; 
            } else if (userRole === 'kitchen') {
                redirectUrl = '../public/chapeiro/preparar_pedidos.html'; 
            } else if (userRole === 'admin') {
                return { success: true, role: 'admin', message: 'Selecione o perfil para acessar.' };
            }

            if (redirectUrl) {
                return { success: true, redirectUrl: redirectUrl };
            }

            return { success: false, message: 'Tipo de usuário não reconhecido.' };
        } else {
            return { success: false, message: data.detail || data.message || 'Usuário ou senha inválidos.' };
        }
    } catch (error) {
        throw error;
    }
}

window.onload = function() {
    if (typeof mocha === 'undefined' || typeof chai === 'undefined') {
        console.error('Mocha ou Chai não foram carregados.');
        return;
    }

    mocha.setup('bdd');
    const expect = chai.expect;

    describe('Testes da Lógica de Login (handleLogin)', () => {

        beforeEach(() => {
            localStorage.clear();
        });

        it('deve retornar a URL de redirecionamento para o atendente', async () => {
            const mockFetch = async () => ({ ok: true, json: async () => ({ access_token: 'fake_token_atendente', user: { role: 'attendant' } }) });
            const result = await handleLogin('atendente', 'senha123', mockFetch);
            expect(result.success).to.be.true;
            expect(result.redirectUrl).to.equal('../public/atendente/menu.html');
        });

        it('deve retornar a URL de redirecionamento para o chapeiro', async () => {
            const mockFetch = async () => ({ ok: true, json: async () => ({ access_token: 'fake_token_chapeiro', user: { role: 'kitchen' } }) });
            const result = await handleLogin('chapeiro', 'senha123', mockFetch);
            expect(result.success).to.be.true;
            expect(result.redirectUrl).to.equal('../public/chapeiro/preparar_pedidos.html');
        });

        it('deve retornar o perfil de admin sem URL de redirecionamento', async () => {
            const mockFetch = async () => ({ ok: true, json: async () => ({ access_token: 'fake_token_admin', user: { role: 'admin' } }) });
            const result = await handleLogin('admin', 'senha123', mockFetch);
            expect(result.success).to.be.true;
            expect(result.role).to.equal('admin');
        });

        it('deve retornar uma mensagem de erro para credenciais inválidas', async () => {
            const mockFetch = async () => ({ ok: false, status: 401, json: async () => ({ detail: 'Usuário ou senha incorretos' }) });
            const result = await handleLogin('errado', 'errado', mockFetch);
            expect(result.success).to.be.false;
            expect(result.message).to.equal('Usuário ou senha incorretos');
        });

        it('deve falhar em caso de erro de rede', async () => {
            const mockFetch = async () => { throw new Error('Falha na rede'); };
            try {
                await handleLogin('teste', 'senha123', mockFetch);
                expect.fail('O erro de rede deveria ter sido lançado.');
            } catch (error) {
                expect(error.message).to.equal('Falha na rede');
            }
        });
    });

    mocha.run();
};