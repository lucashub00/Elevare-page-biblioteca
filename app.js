import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { 
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
    GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, getDocs, doc, deleteDoc, getDoc, updateDoc, setDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

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
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ==========================================
// LÓGICA: INDEX E CADASTRO (MANTIDO)
// ==========================================
if (document.body.classList.contains('page-index')) {
    document.querySelectorAll('.action-bridge').forEach(botao => {
        botao.addEventListener('click', function(event) {
            event.preventDefault(); document.getElementById('login-section').scrollIntoView({ behavior: 'smooth' });
        });
    });

    document.getElementById('btn-entrar').addEventListener('click', () => {
        const email = document.getElementById('email-login').value;
        const senha = document.getElementById('senha-login').value;
        const msgErro = document.getElementById('mensagem-erro');
        msgErro.style.display = 'none';

        if(!email || !senha) { msgErro.textContent = "Preencha e-mail e senha!"; msgErro.style.display = 'block'; return; }

        signInWithEmailAndPassword(auth, email, senha)
            .then(() => window.location.href = "plataforma.html")
            .catch(() => { msgErro.textContent = "Erro: E-mail ou senha incorretos."; msgErro.style.display = 'block'; });
    });

    document.getElementById('btn-google').addEventListener('click', () => {
        signInWithPopup(auth, googleProvider).then(() => window.location.href = "plataforma.html").catch(() => {});
    });
}

if (document.body.classList.contains('page-cadastro')) {
    document.getElementById('btn-cadastrar-novo').addEventListener('click', () => {
        const email = document.getElementById('email-cadastro').value;
        const senha = document.getElementById('senha-cadastro').value;
        const msgErro = document.getElementById('mensagem-erro-cadastro');
        msgErro.style.display = 'none';

        if(!email || !senha) { msgErro.textContent = "Preencha e-mail e senha!"; msgErro.style.display = 'block'; return; }
        if(senha.length < 6) { msgErro.textContent = "Senha mínima de 6 caracteres."; msgErro.style.display = 'block'; return; }

        createUserWithEmailAndPassword(auth, email, senha)
            .then(() => window.location.href = "plataforma.html")
            .catch(() => { msgErro.textContent = "Erro ao criar conta. E-mail já em uso."; msgErro.style.display = 'block'; });
    });

    document.getElementById('btn-google-cadastro').addEventListener('click', () => {
        signInWithPopup(auth, googleProvider).then(() => window.location.href = "plataforma.html").catch(() => {});
    });
}

// ==========================================
// LÓGICA DA PÁGINA: PLATAFORMA (NOVA)
// ==========================================
if (document.body.classList.contains('page-plataforma')) {
    
    const admins = ["pedroeliasm08@gmail.com", "suporteelevaresolucoes@gmail.com"];
    
    // AQUI VOCÊ COLOCA O NÚMERO DE TELEFONE COM DDD PARA AS VENDAS!
    const NUMERO_DO_ZAP = "5532999999999"; 
    
    let usuarioAtualUid = "";

    // Autenticação
    onAuthStateChanged(auth, (user) => {
        if (user) {
            usuarioAtualUid = user.uid; // ID ÚNICO DO CLIENTE
            
            document.getElementById('user-nome').textContent = user.displayName || user.email.split('@')[0];
            document.getElementById('user-uid').textContent = "ID Cliente: " + usuarioAtualUid;
            
            const fotoElement = document.getElementById('user-foto');
            fotoElement.src = user.photoURL ? user.photoURL : "https://cdn-icons-png.flaticon.com/512/149/149071.png";
            fotoElement.style.display = "block";

            const isAdmin = admins.includes(user.email);
            if (isAdmin) {
                document.getElementById('btn-add-ebook').style.display = 'block';
                document.getElementById('btn-gerenciar-acessos').style.display = 'block';
            }

            carregarEbooks(isAdmin, usuarioAtualUid);

        } else {
            window.location.href = "index.html"; 
        }
    });

    // Função Carregar Ebooks (Com Trava de Segurança)
    async function carregarEbooks(isAdmin, uid) {
        const listaEbooks = document.getElementById('lista-ebooks');
        if(!listaEbooks) return;
        listaEbooks.innerHTML = '<p style="color: #94a3b8; font-size: 18px;">Carregando sua biblioteca...</p>';
        
        try {
            // 1. Puxa os acessos que esse cliente comprou
            let ebooksLiberados = [];
            if (!isAdmin) {
                const acessoSnap = await getDoc(doc(db, "acessos", uid));
                if (acessoSnap.exists()) {
                    ebooksLiberados = acessoSnap.data().produtos || [];
                }
            }

            // 2. Puxa todos os E-books do banco
            const querySnapshot = await getDocs(collection(db, "ebooks"));
            listaEbooks.innerHTML = ''; 
            
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const id = docSnap.id; // ID ÚNICO DO PRODUTO
                
                // Checa se o cara tem o produto ou se é admin
                const hasAccess = isAdmin || ebooksLiberados.includes(id);

                let media = 0;
                if (data.ratings && data.ratings.length > 0) {
                    media = (data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length).toFixed(1);
                }

                const tagsHtml = data.hash.split(',').map(tag => tag.trim() !== "" ? `<span class="hashtag">#${tag.trim()}</span>` : "").join('');
                let estrelasHtml = '';
                for(let i = 1; i <= 5; i++) {
                    estrelasHtml += `<span class="star ${i <= Math.round(media) ? 'active' : ''}" data-value="${i}">★</span>`;
                }

                const displayDelete = isAdmin ? 'flex' : 'none';
                
                // Renderização condicional do Botão e Cadeado
                let cadeadoHtml = '';
                let botaoAcaoHtml = '';
                let adminIdLabel = isAdmin ? `<span class="admin-id-tag">ID Produto: ${id}</span>` : '';

                if (hasAccess) {
                    botaoAcaoHtml = `<a href="${data.pdfUrl}" target="_blank" class="btn-download-pdf">📖 Acessar Conteúdo</a>`;
                } else {
                    cadeadoHtml = `
                        <div class="padlock-overlay">
                            <span class="icon">🔒</span>
                            <span class="texto">Conteúdo Bloqueado</span>
                        </div>
                    `;
                    
                    const msgZap = encodeURIComponent(`Olá, quero comprar o E-book "${data.titulo}" (ID Prod: ${id}). Meu ID de Cliente é: ${uid}`);
                    botaoAcaoHtml = `<a href="https://wa.me/${NUMERO_DO_ZAP}?text=${msgZap}" target="_blank" class="btn-wpp-buy">Comprar via WhatsApp</a>`;
                }

                const card = document.createElement('div');
                card.className = 'card-ebook';
                card.setAttribute('data-id', id);
                card.innerHTML = `
                    <button class="btn-delete-ebook" style="display: ${displayDelete};" title="Apagar E-book">🗑️</button>
                    ${cadeadoHtml}
                    <img src="${data.fotoUrl}" alt="Capa" class="ebook-cover">
                    <div class="ebook-info">
                        ${adminIdLabel}
                        <div class="hashtags">${tagsHtml}</div>
                        <h3>${data.titulo}</h3>
                        <p>${data.desc}</p>
                        ${botaoAcaoHtml}
                        <div class="ebook-rating-interactive" style="display: flex; align-items: center; margin-top: 15px; position: relative; z-index: 10;">
                            <div class="stars-container" style="display: flex; gap: 4px; font-size: 24px; cursor: pointer; color: #334155;">
                                ${estrelasHtml}
                            </div>
                            <span class="score" style="margin-left: 10px; font-weight: bold; color: #fff; font-size: 16px; background: #334155; padding: 2px 8px; border-radius: 4px;">
                                ${media > 0 ? media : 'Novo'}
                            </span>
                        </div>
                    </div>
                `;
                listaEbooks.appendChild(card);
            });
        } catch(error) {
            console.error(error);
            listaEbooks.innerHTML = '<p style="color: #ef4444;">Erro ao carregar a biblioteca.</p>';
        }
    }

    // Ações Básicas e Navegação
    document.getElementById('btn-sair').addEventListener('click', () => { signOut(auth).then(() => { window.location.href = "index.html"; }); });
    const botoesNav = document.querySelectorAll('.nav-btn');
    const conteudosAba = document.querySelectorAll('.tab-content');
    botoesNav.forEach(botao => {
        botao.addEventListener('click', () => {
            botoesNav.forEach(btn => btn.classList.remove('active'));
            conteudosAba.forEach(aba => aba.classList.remove('active'));
            botao.classList.add('active');
            document.getElementById(botao.getAttribute('data-target')).classList.add('active');
        });
    });

    // ===== ADICIONAR E-BOOK =====
    const btnAddEbook = document.getElementById('btn-add-ebook');
    const modalEbook = document.getElementById('modal-add-ebook');
    if(btnAddEbook && modalEbook) {
        btnAddEbook.addEventListener('click', () => modalEbook.style.display = 'flex');
        document.getElementById('btn-cancelar-ebook').addEventListener('click', () => modalEbook.style.display = 'none');

        document.getElementById('btn-salvar-ebook').addEventListener('click', async () => {
            const fotoUrl = document.getElementById('input-foto-ebook').value;
            const pdfUrl = document.getElementById('input-pdf-ebook').value;
            const titulo = document.getElementById('input-titulo-ebook').value;
            const desc = document.getElementById('input-desc-ebook').value;
            const hash = document.getElementById('input-hash-ebook').value;

            if(!fotoUrl || !pdfUrl || !titulo || !desc) { alert("Preencha todos os links e textos!"); return; }

            try {
                await addDoc(collection(db, "ebooks"), {
                    titulo: titulo, desc: desc, hash: hash, fotoUrl: fotoUrl, pdfUrl: pdfUrl, ratings: []
                });
                modalEbook.style.display = 'none';
                carregarEbooks(true, usuarioAtualUid); 
            } catch (error) { alert("Erro ao salvar: " + error.message); }
        });
    }

    // ===== PAINEL DO ADMIN: GERENCIAR ACESSOS =====
    const btnGerenciar = document.getElementById('btn-gerenciar-acessos');
    const modalAcesso = document.getElementById('modal-gerenciar-acessos');
    
    if(btnGerenciar) {
        btnGerenciar.addEventListener('click', () => modalAcesso.style.display = 'flex');
        document.getElementById('btn-fechar-acessos').addEventListener('click', () => modalAcesso.style.display = 'none');

        // LIBERAR ACESSO
        document.getElementById('btn-liberar-acesso').addEventListener('click', async () => {
            const clienteId = document.getElementById('input-cliente-id').value.trim();
            const produtoId = document.getElementById('input-produto-id').value.trim();

            if(!clienteId || !produtoId) { alert("Preencha os dois IDs!"); return; }

            try {
                const acessoRef = doc(db, "acessos", clienteId);
                const acessoSnap = await getDoc(acessoRef);
                
                let produtosLiberados = [];
                if (acessoSnap.exists()) { produtosLiberados = acessoSnap.data().produtos || []; }
                
                if(!produtosLiberados.includes(produtoId)) {
                    produtosLiberados.push(produtoId);
                    await setDoc(acessoRef, { produtos: produtosLiberados }, { merge: true });
                    alert("✅ Acesso Liberado com Sucesso para o cliente!");
                } else {
                    alert("Este cliente já possui acesso a este material.");
                }
            } catch(e) { alert("Erro: " + e.message); }
        });

        // REVOGAR / BLOQUEAR ACESSO
        document.getElementById('btn-revogar-acesso').addEventListener('click', async () => {
            const clienteId = document.getElementById('input-cliente-id').value.trim();
            const produtoId = document.getElementById('input-produto-id').value.trim();
            if(!clienteId || !produtoId) { alert("Preencha os dois IDs!"); return; }

            try {
                const acessoRef = doc(db, "acessos", clienteId);
                const acessoSnap = await getDoc(acessoRef);
                if (acessoSnap.exists()) {
                    let produtosLiberados = acessoSnap.data().produtos || [];
                    const novaLista = produtosLiberados.filter(id => id !== produtoId);
                    await setDoc(acessoRef, { produtos: novaLista }, { merge: true });
                    alert("🚫 Acesso Bloqueado/Removido com sucesso!");
                }
            } catch(e) { alert("Erro: " + e.message); }
        });
    }

    // ===== LIXEIRA E AVALIAÇÕES =====
    const listaEbooks = document.getElementById('lista-ebooks');
    if (listaEbooks) {
        listaEbooks.addEventListener('click', async (event) => {
            const card = event.target.closest('.card-ebook');
            if(!card) return;
            const ebookId = card.getAttribute('data-id');

            if (event.target.closest('.btn-delete-ebook')) {
                if (confirm("Deseja apagar este e-book definitivamente?")) {
                    await deleteDoc(doc(db, "ebooks", ebookId)); card.remove(); 
                }
            }

            if (event.target.classList.contains('star')) {
                const valor = parseInt(event.target.getAttribute('data-value'));
                try {
                    const ebookRef = doc(db, "ebooks", ebookId);
                    const docSnap = await getDoc(ebookRef);
                    if (docSnap.exists()) {
                        const notas = docSnap.data().ratings || [];
                        notas.push(valor); 
                        await updateDoc(ebookRef, { ratings: notas });
                        carregarEbooks(admins.includes(auth.currentUser.email), usuarioAtualUid);
                    }
                } catch (e) { console.error(e); }
            }
        });
    }
}