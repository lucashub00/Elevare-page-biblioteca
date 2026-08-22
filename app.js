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
// FUNÇÃO INTELIGENTE: EXTRAIR LINK DA FOTO
// ==========================================
// Essa função garimpa o link puro não importa o código sujo que o ImgBB entregue
function extrairLinkImagem(inputTexto) {
    if (!inputTexto) return "";
    
    // Se o usuário copiou o código HTML inteiro (<a href...><img src="...">)
    const matchHtml = inputTexto.match(/src=["']?(https?:\/\/[^"'\s>]+)/);
    if (matchHtml && matchHtml[1]) return matchHtml[1].trim();

    // Se o usuário copiou o código BBCode ([img]...[/img])
    const matchBbcode = inputTexto.match(/\[img\](https?:\/\/[^\[]+)\[\/img\]/i);
    if (matchBbcode && matchBbcode[1]) return matchBbcode[1].trim();

    // Se ele já colou o link certinho, só tira espaços e aspas perdidas
    return inputTexto.replace(/['"]/g, '').trim();
}

// ==========================================
// LÓGICA: INDEX E CADASTRO
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
// LÓGICA DA PÁGINA: PLATAFORMA
// ==========================================
if (document.body.classList.contains('page-plataforma')) {
    
    const admins = ["pedroeliasm08@gmail.com", "suporteelevaresolucoes@gmail.com"];
    const NUMERO_DO_ZAP = "5532999999999"; 
    let usuarioAtualUid = "";

    window.catalogoEbooks = {};

    onAuthStateChanged(auth, (user) => {
        if (user) {
            usuarioAtualUid = user.uid; 
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

    async function carregarEbooks(isAdmin, uid) {
        const listaEbooks = document.getElementById('lista-ebooks');
        if(!listaEbooks) return;
        listaEbooks.innerHTML = '<p style="color: #94a3b8; font-size: 18px;">Carregando sua biblioteca...</p>';
        
        try {
            let ebooksLiberados = [];
            if (!isAdmin) {
                const acessoSnap = await getDoc(doc(db, "acessos", uid));
                if (acessoSnap.exists()) {
                    ebooksLiberados = acessoSnap.data().produtos || [];
                }
            }

            const querySnapshot = await getDocs(collection(db, "ebooks"));
            listaEbooks.innerHTML = ''; 
            
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const id = docSnap.id; 
                
                // MÁGICA DE LIMPEZA: Conserta as imagens antigas que estavam quebradas
                const fotoLimpa = extrairLinkImagem(data.fotoUrl);

                const hasAccess = isAdmin || ebooksLiberados.includes(id);
                let media = 0;
                if (data.ratings && data.ratings.length > 0) {
                    media = (data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length).toFixed(1);
                }

                window.catalogoEbooks[id] = {
                    ...data, id: id, fotoLimpa: fotoLimpa, media: media, hasAccess: hasAccess
                };

                const tagsHtml = data.hash.split(',').map(tag => tag.trim() !== "" ? `<span class="hashtag">#${tag.trim()}</span>` : "").join('');
                let estrelasHtml = '';
                for(let i = 1; i <= 5; i++) {
                    estrelasHtml += `<span class="star ${i <= Math.round(media) ? 'active' : ''}" data-value="${i}">★</span>`;
                }

                const displayDelete = isAdmin ? 'flex' : 'none';
                let cadeadoHtml = hasAccess ? '' : `<div class="badge-lock">🔒 Bloqueado</div>`;
                let adminIdLabel = isAdmin ? `<span class="admin-id-tag">ID Produto: ${id}</span>` : '';

                const card = document.createElement('div');
                card.className = 'card-ebook';
                card.setAttribute('data-id', id);
                card.innerHTML = `
                    <button class="btn-delete-ebook" style="display: ${displayDelete};" title="Apagar E-book">🗑️</button>
                    ${cadeadoHtml}
                    <img src="${fotoLimpa}" alt="Capa" class="ebook-cover">
                    <div class="ebook-info">
                        ${adminIdLabel}
                        <div class="hashtags">${tagsHtml}</div>
                        <h3>${data.titulo}</h3>
                        <p class="desc-preview">${data.desc}</p>
                        <span class="ler-mais-txt">Ler mais...</span>
                        
                        <div class="ebook-rating-interactive" style="display: flex; align-items: center; margin-top: 5px; position: relative; z-index: 10;">
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
            listaEbooks.innerHTML = '<p style="color: #ef4444;">Erro ao carregar a biblioteca.</p>';
        }
    }

    // Navegação
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

    // Adicionar E-book
    const modalEbook = document.getElementById('modal-add-ebook');
    if(document.getElementById('btn-add-ebook') && modalEbook) {
        document.getElementById('btn-add-ebook').addEventListener('click', () => modalEbook.style.display = 'flex');
        document.getElementById('btn-cancelar-ebook').addEventListener('click', () => modalEbook.style.display = 'none');

        document.getElementById('btn-salvar-ebook').addEventListener('click', async () => {
            // APLICA O FILTRO INTELIGENTE NO LINK QUE O USUÁRIO COLOU
            const inputCru = document.getElementById('input-foto-ebook').value;
            const fotoUrlLimpa = extrairLinkImagem(inputCru); 
            
            const pdfUrl = document.getElementById('input-pdf-ebook').value;
            const titulo = document.getElementById('input-titulo-ebook').value;
            const desc = document.getElementById('input-desc-ebook').value;
            const hash = document.getElementById('input-hash-ebook').value;

            if(!fotoUrlLimpa || !pdfUrl || !titulo || !desc) { alert("Preencha todos os links e textos!"); return; }

            try {
                await addDoc(collection(db, "ebooks"), {
                    titulo: titulo, desc: desc, hash: hash, fotoUrl: fotoUrlLimpa, pdfUrl: pdfUrl, ratings: []
                });
                modalEbook.style.display = 'none';
                document.getElementById('input-foto-ebook').value = '';
                document.getElementById('input-pdf-ebook').value = '';
                document.getElementById('input-titulo-ebook').value = '';
                document.getElementById('input-desc-ebook').value = '';
                document.getElementById('input-hash-ebook').value = '';
                carregarEbooks(true, usuarioAtualUid); 
            } catch (error) { alert("Erro ao salvar: " + error.message); }
        });
    }

    // Gerenciar Acessos
    const modalAcesso = document.getElementById('modal-gerenciar-acessos');
    if(document.getElementById('btn-gerenciar-acessos')) {
        document.getElementById('btn-gerenciar-acessos').addEventListener('click', () => modalAcesso.style.display = 'flex');
        document.getElementById('btn-fechar-acessos').addEventListener('click', () => modalAcesso.style.display = 'none');

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
                } else { alert("Este cliente já possui acesso a este material."); }
            } catch(e) { alert("Erro: " + e.message); }
        });

        document.getElementById('btn-revogar-acesso').addEventListener('click', async () => {
            const clienteId = document.getElementById('input-cliente-id').value.trim();
            const produtoId = document.getElementById('input-produto-id').value.trim();
            if(!clienteId || !produtoId) return;
            try {
                const acessoRef = doc(db, "acessos", clienteId);
                const acessoSnap = await getDoc(acessoRef);
                if (acessoSnap.exists()) {
                    let produtosLiberados = acessoSnap.data().produtos || [];
                    const novaLista = produtosLiberados.filter(id => id !== produtoId);
                    await setDoc(acessoRef, { produtos: novaLista }, { merge: true });
                    alert("🚫 Acesso Removido com sucesso!");
                }
            } catch(e) { alert("Erro: " + e.message); }
        });
    }

    // Cliques na Vitrine
    const listaEbooks = document.getElementById('lista-ebooks');
    const modalDetalhes = document.getElementById('modal-detalhes-ebook');

    if (listaEbooks) {
        listaEbooks.addEventListener('click', async (event) => {
            const card = event.target.closest('.card-ebook');
            if(!card) return;
            const ebookId = card.getAttribute('data-id');

            // 1. Apagar
            if (event.target.closest('.btn-delete-ebook')) {
                if (confirm("Deseja apagar este e-book definitivamente?")) {
                    await deleteDoc(doc(db, "ebooks", ebookId)); card.remove(); 
                }
                return;
            }

            // 2. Avaliar (Estrelas)
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
                return;
            }

            // 3. ABRIR DETALHES
            abrirDetalhesEbook(ebookId);
        });
    }

    if(document.getElementById('btn-fechar-detalhes')) {
        document.getElementById('btn-fechar-detalhes').addEventListener('click', () => {
            modalDetalhes.style.display = 'none';
        });
    }

    function abrirDetalhesEbook(id) {
        const ebook = window.catalogoEbooks[id];
        if(!ebook) return;

        document.getElementById('detalhe-img').src = ebook.fotoLimpa;
        document.getElementById('detalhe-titulo').textContent = ebook.titulo;
        document.getElementById('detalhe-desc').textContent = ebook.desc;

        document.getElementById('detalhe-tags').innerHTML = ebook.hash.split(',')
            .map(tag => tag.trim() !== "" ? `<span class="hashtag">#${tag.trim()}</span>` : "").join('');
        
        const mediaArr = Math.round(ebook.media);
        let estrelasDet = '';
        for(let i = 1; i <= 5; i++) {
            estrelasDet += `<span style="color: ${i <= mediaArr ? '#fbbf24' : '#334155'};">★</span>`;
        }
        document.getElementById('detalhe-rating').innerHTML = `${estrelasDet} <span style="font-size: 16px; color: #fff; margin-left: 10px; background: #334155; padding: 2px 8px; border-radius: 4px;">${ebook.media > 0 ? ebook.media : 'Novo'}</span>`;

        const acaoContainer = document.getElementById('detalhe-acao');
        if(ebook.hasAccess) {
             acaoContainer.innerHTML = `<a href="${ebook.pdfUrl}" target="_blank" class="btn-download-pdf">📖 Acessar Conteúdo (Abrir PDF)</a>`;
        } else {
             const msgZap = encodeURIComponent(`Olá, tenho interesse no E-book "${ebook.titulo}" (ID: ${id}). Meu ID de Cliente é: ${usuarioAtualUid}`);
             acaoContainer.innerHTML = `<a href="https://wa.me/${NUMERO_DO_ZAP}?text=${msgZap}" target="_blank" class="btn-wpp-buy">🔒 Comprar Acesso via WhatsApp</a>`;
        }

        modalDetalhes.style.display = 'flex';
    }
}