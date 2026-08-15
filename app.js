import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    GoogleAuthProvider, 
    signInWithPopup, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBibGU7PuuezorXhncVgd6ElHMERprqltk",
    authDomain: "elevare-page-biblioteca.firebaseapp.com",
    projectId: "elevare-page-biblioteca",
    storageBucket: "elevare-page-biblioteca.firebasestorage.app",
    messagingSenderId: "870070120182",
    appId: "1:870070120182:web:dc75f4cc8ba694786186d7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ==========================================
// LÓGICA DA PÁGINA: INDEX.HTML
// ==========================================
if (document.body.classList.contains('page-index')) {
    
    // Rolagem Suave dos Botões "Quero Acessar"
    document.querySelectorAll('.action-bridge').forEach(botao => {
        botao.addEventListener('click', function(event) {
            event.preventDefault();
            document.getElementById('login-section').scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Função Compartilhada de Validação
    function getLoginData() {
        return {
            email: document.getElementById('email-login').value,
            senha: document.getElementById('senha-login').value,
            msgErro: document.getElementById('mensagem-erro')
        };
    }

    // 1. Entrar com E-mail (Conta já existente)
    document.getElementById('btn-entrar').addEventListener('click', () => {
        const { email, senha, msgErro } = getLoginData();
        msgErro.style.display = 'none';

        if(!email || !senha) {
            msgErro.textContent = "Preencha e-mail e senha!";
            msgErro.style.display = 'block';
            return;
        }

        signInWithEmailAndPassword(auth, email, senha)
            .then(() => window.location.href = "plataforma.html")
            .catch(() => {
                msgErro.textContent = "Erro: E-mail ou senha incorretos.";
                msgErro.style.display = 'block';
            });
    });

    // 2. CADASTRAR NOVA CONTA DE TESTE (Para desenvolvimento livre)
    document.getElementById('btn-cadastrar').addEventListener('click', () => {
        const { email, senha, msgErro } = getLoginData();
        msgErro.style.display = 'none';

        if(!email || !senha) {
            msgErro.textContent = "Crie um e-mail e senha para se cadastrar!";
            msgErro.style.display = 'block';
            return;
        }
        
        // Exige no mínimo 6 caracteres na senha (regra do Firebase)
        if(senha.length < 6) {
            msgErro.textContent = "A senha deve ter pelo menos 6 caracteres.";
            msgErro.style.display = 'block';
            return;
        }

        createUserWithEmailAndPassword(auth, email, senha)
            .then(() => {
                alert("Conta de teste criada e autenticada com sucesso! Bem-vindo(a).");
                window.location.href = "plataforma.html";
            })
            .catch((error) => {
                msgErro.textContent = "Erro ao criar conta. Talvez o e-mail já exista.";
                msgErro.style.display = 'block';
                console.error(error);
            });
    });

    // 3. Entrar com Google
    document.getElementById('btn-google').addEventListener('click', () => {
        const msgErro = document.getElementById('mensagem-erro');
        msgErro.style.display = 'none';

        signInWithPopup(auth, googleProvider)
            .then(() => window.location.href = "plataforma.html")
            .catch((error) => {
                msgErro.textContent = "Erro ao fazer login com o Google.";
                msgErro.style.display = 'block';
                console.error(error);
            });
    });
}

// ==========================================
// LÓGICA DA PÁGINA: PLATAFORMA.HTML
// ==========================================
if (document.body.classList.contains('page-plataforma')) {
    
    // Verifica Segurança e Carrega Dados do Usuário
    onAuthStateChanged(auth, (user) => {
        if (user) {
            const nomeElement = document.getElementById('user-nome');
            const fotoElement = document.getElementById('user-foto');

            // Se for login por Google, tem nome. Se foi pelo e-mail de teste, pega o começo do e-mail.
            nomeElement.textContent = user.displayName || user.email.split('@')[0];

            if (user.photoURL) {
                fotoElement.src = user.photoURL;
            } else {
                // Foto padrão caso crie com E-mail e Senha
                fotoElement.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
            }
            fotoElement.style.display = "block";
        } else {
            // Chuta o usuário para fora
            alert("Acesso Negado! Faça login primeiro.");
            window.location.href = "index.html"; 
        }
    });

    // Sair da Conta
    document.getElementById('btn-sair').addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = "index.html";
        });
    });

    // Trava de Segurança Anti-Cópia (Apenas dentro da plataforma)
    document.addEventListener('contextmenu', e => {
        e.preventDefault();
        alert('Aviso: O download ou cópia não autorizada deste conteúdo é proibido pelos termos de uso da Elevare Soluções.');
    });
    
    document.addEventListener('keydown', e => {
        if (e.key === 'F12' || (e.ctrlKey && ['s', 'u', 'i'].includes(e.key.toLowerCase()))) {
            e.preventDefault();
            alert('Ação bloqueada por motivos de segurança e direitos autorais.');
        }
    });
}