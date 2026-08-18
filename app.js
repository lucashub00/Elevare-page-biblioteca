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

    // 1. Entrar com E-mail (Conta já existente)
    document.getElementById('btn-entrar').addEventListener('click', () => {
        const email = document.getElementById('email-login').value;
        const senha = document.getElementById('senha-login').value;
        const msgErro = document.getElementById('mensagem-erro');
        
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

    // 2. Entrar com Google
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
// LÓGICA DA PÁGINA: CADASTRO.HTML
// ==========================================
if (document.body.classList.contains('page-cadastro')) {
    
    // 1. Cadastrar nova conta com E-mail
    document.getElementById('btn-cadastrar-novo').addEventListener('click', () => {
        const email = document.getElementById('email-cadastro').value;
        const senha = document.getElementById('senha-cadastro').value;
        const msgErro = document.getElementById('mensagem-erro-cadastro');
        
        msgErro.style.display = 'none';

        if(!email || !senha) {
            msgErro.textContent = "Preencha e-mail e senha para se cadastrar!";
            msgErro.style.display = 'block';
            return;
        }
        
        if(senha.length < 6) {
            msgErro.textContent = "A senha deve ter pelo menos 6 caracteres.";
            msgErro.style.display = 'block';
            return;
        }

        createUserWithEmailAndPassword(auth, email, senha)
            .then(() => {
                // Após cadastrar, joga direto pra plataforma
                window.location.href = "plataforma.html";
            })
            .catch((error) => {
                msgErro.textContent = "Erro ao criar conta. O e-mail já pode estar em uso.";
                msgErro.style.display = 'block';
                console.error(error);
            });
    });

    // 2. Cadastrar nova conta com Google
    document.getElementById('btn-google-cadastro').addEventListener('click', () => {
        const msgErro = document.getElementById('mensagem-erro-cadastro');
        msgErro.style.display = 'none';

        signInWithPopup(auth, googleProvider)
            .then(() => window.location.href = "plataforma.html")
            .catch((error) => {
                msgErro.textContent = "Erro ao cadastrar com o Google.";
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

            nomeElement.textContent = user.displayName || user.email.split('@')[0];

            if (user.photoURL) {
                fotoElement.src = user.photoURL;
            } else {
                fotoElement.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
            }
            fotoElement.style.display = "block";
        } else {
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

    // Trava de Segurança Anti-Cópia
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
// ===== NOVA LÓGICA: NAVEGAÇÃO DE ABAS =====
    const botoesNav = document.querySelectorAll('.nav-btn');
    const conteudosAba = document.querySelectorAll('.tab-content');

    botoesNav.forEach(botao => {
        botao.addEventListener('click', () => {
            // Remove a classe 'active' de todos os botões e abas
            botoesNav.forEach(btn => btn.classList.remove('active'));
            conteudosAba.forEach(aba => aba.classList.remove('active'));

            // Adiciona 'active' no botão clicado e na aba correspondente
            botao.classList.add('active');
            const targetId = botao.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });