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
// FUNÇÕES AUXILIARES MÁGICAS
// ==========================================
function extrairLinkImagem(inputTexto) {
    if (!inputTexto) return "";
    let txt = inputTexto.trim();
    const matchDireto = txt.match(/https?:\/\/[^\s"'<>]+?\.(?:png|jpe?g|gif|webp)/i);
    if (matchDireto) return matchDireto[0];
    const matchSrc = txt.match(/src=["']?(https?:\/\/[^"'\s>]+)["']?/i);
    if (matchSrc) return matchSrc[1];
    return txt.replace(/['"]/g, '');
}

// Pega qualquer link do YouTube e tira só o ID do vídeo para rodar no site
function extrairIdYoutube(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regex);
    return match ? match[1] : "";
}

// ==========================================
// LÓGICA: INDEX E CADASTRO
// ==========================================
if (document.body.classList.contains('page-index')) {
    document.querySelectorAll('.action-bridge').forEach(btn => {
        btn.addEventListener('click', e => { e.preventDefault(); document.getElementById('login-section').scrollIntoView({ behavior: 'smooth' }); });
    });
    document.getElementById('btn-entrar').addEventListener('click', () => {
        const e = document.getElementById('email-login').value, s = document.getElementById('senha-login').value, m = document.getElementById('mensagem-erro');
        m.style.display = 'none';
        if(!e || !s) { m.textContent = "Preencha e-mail e senha!"; m.style.display = 'block'; return; }
        signInWithEmailAndPassword(auth, e, s).then(() => window.location.href = "plataforma.html").catch(() => { m.textContent = "Erro de login."; m.style.display = 'block'; });
    });
    document.getElementById('btn-google').addEventListener('click', () => {
        signInWithPopup(auth, googleProvider).then(() => window.location.href = "plataforma.html").catch(() => {});
    });
}

if (document.body.classList.contains('page-cadastro')) {
    document.getElementById('btn-cadastrar-novo').addEventListener('click', () => {
        const e = document.getElementById('email-cadastro').value, s = document.getElementById('senha-cadastro').value, m = document.getElementById('mensagem-erro-cadastro');
        m.style.display = 'none';
        if(!e || !s) { m.textContent = "Preencha tudo!"; m.style.display = 'block'; return; }
        createUserWithEmailAndPassword(auth, e, s).then(() => window.location.href = "plataforma.html").catch(() => { m.textContent = "Erro ao criar conta."; m.style.display = 'block'; });
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
    window.catalogoCursos = {};

    onAuthStateChanged(auth, (user) => {
        if (user) {
            usuarioAtualUid = user.uid; 
            document.getElementById('user-nome').textContent = user.displayName || user.email.split('@')[0];
            document.getElementById('user-uid').textContent = "ID Cliente: " + usuarioAtualUid;
            document.getElementById('user-foto').src = user.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
            document.getElementById('user-foto').style.display = "block";

            const isAdmin = admins.includes(user.email);
            if (isAdmin) {
                document.querySelectorAll('.btn-admin').forEach(btn => btn.style.display = 'block');
            }
            carregarEbooks(isAdmin, usuarioAtualUid);
            carregarCursos(isAdmin, usuarioAtualUid);
        } else {
            window.location.href = "index.html"; 
        }
    });

    // ===== 1. CARREGAR E-BOOKS =====
    async function carregarEbooks(isAdmin, uid) {
        const listaEbooks = document.getElementById('lista-ebooks');
        if(!listaEbooks) return;
        listaEbooks.innerHTML = '<p style="color: #94a3b8;">Carregando...</p>';
        try {
            let ebooksLiberados = [];
            if (!isAdmin) {
                const snap = await getDoc(doc(db, "acessos", uid));
                if (snap.exists()) ebooksLiberados = snap.data().produtos || [];
            }
            const querySnapshot = await getDocs(collection(db, "ebooks"));
            listaEbooks.innerHTML = ''; 
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data(), id = docSnap.id; 
                const fotoLimpa = extrairLinkImagem(data.fotoUrl);
                const hasAccess = isAdmin || ebooksLiberados.includes(id);
                let media = 0;
                if (data.ratings && data.ratings.length > 0) media = (data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length).toFixed(1);

                window.catalogoEbooks[id] = { ...data, id: id, fotoLimpa: fotoLimpa, media: media, hasAccess: hasAccess };

                const tagsHtml = data.hash ? data.hash.split(',').map(t => t.trim() !== "" ? `<span class="hashtag">#${t.trim()}</span>` : "").join('') : '';
                let estrelasHtml = '';
                for(let i = 1; i <= 5; i++) estrelasHtml += `<span class="star ${i <= Math.round(media) ? 'active' : ''}" data-value="${i}">★</span>`;

                const card = document.createElement('div');
                card.className = 'card-ebook';
                card.setAttribute('data-id', id);
                card.innerHTML = `
                    <button class="btn-delete-ebook" style="display: ${isAdmin ? 'flex' : 'none'};" title="Apagar">🗑️</button>
                    ${hasAccess ? '' : `<div class="badge-lock">🔒 Bloqueado</div>`}
                    <img src="${fotoLimpa}" alt="Capa" class="ebook-cover">
                    <div class="ebook-info">
                        ${isAdmin ? `<span class="admin-id-tag">ID Prod: ${id}</span>` : ''}
                        <div class="hashtags">${tagsHtml}</div>
                        <h3>${data.titulo}</h3>
                        <p class="desc-preview">${data.desc}</p>
                        <span class="ler-mais-txt">Ler mais...</span>
                        <div class="ebook-rating-interactive" style="display: flex; align-items: center; margin-top: 5px;">
                            <div class="stars-container" style="display: flex; gap: 4px; font-size: 24px; cursor: pointer; color: #334155;">
                                ${estrelasHtml}
                            </div>
                            <span class="score" style="margin-left: 10px; font-weight: bold; color: #fff; background: #334155; padding: 2px 8px; border-radius: 4px;">
                                ${media > 0 ? media : 'Novo'}
                            </span>
                        </div>
                    </div>
                `;
                listaEbooks.appendChild(card);
            });
        } catch(error) {}
    }

    // ===== 2. CARREGAR CURSOS =====
    async function carregarCursos(isAdmin, uid) {
        const lista = document.getElementById('lista-cursos');
        if(!lista) return;
        lista.innerHTML = '<p style="color: #94a3b8;">Carregando cursos...</p>';
        try {
            let cursosLiberados = [];
            if (!isAdmin) {
                const snap = await getDoc(doc(db, "acessos", uid));
                if (snap.exists()) cursosLiberados = snap.data().produtos || [];
            }
            const querySnapshot = await getDocs(collection(db, "cursos"));
            lista.innerHTML = ''; 
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data(), id = docSnap.id; 
                const fotoLimpa = extrairLinkImagem(data.fotoUrl);
                const videoId = extrairIdYoutube(data.ytUrl); // Pega só o ID pro iframe
                const hasAccess = isAdmin || cursosLiberados.includes(id);

                window.catalogoCursos[id] = { ...data, id: id, fotoLimpa: fotoLimpa, videoId: videoId, hasAccess: hasAccess };

                const card = document.createElement('div');
                card.className = 'card-curso card-item'; 
                card.setAttribute('data-id', id);
                card.innerHTML = `
                    <button class="btn-delete-curso" style="display: ${isAdmin ? 'flex' : 'none'}; position: absolute; top: 10px; right: 10px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; z-index: 10; font-size: 14px;">🗑️</button>
                    ${hasAccess ? '' : `<div class="badge-lock">🔒 Aula Demo Liberada</div>`}
                    <div class="curso-thumb">
                        <img src="${fotoLimpa}" alt="Thumb" style="width: 100%; aspect-ratio: 16/9; object-fit: cover;">
                        <div class="play-btn" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); color: white; width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; border: 3px solid #00b4d8; pointer-events: none;">▶</div>
                    </div>
                    <div class="curso-info" style="padding: 20px;">
                        ${isAdmin ? `<span class="admin-id-tag">ID Prod: ${id}</span>` : ''}
                        <h3>${data.titulo}</h3>
                        <p class="desc-preview">${data.desc}</p>
                        <span class="ler-mais-txt">Assistir Aula Demonstrativa</span>
                    </div>
                `;
                lista.appendChild(card);
            });
        } catch(error) {}
    }

    // Ações Gerais
    document.getElementById('btn-sair').addEventListener('click', () => { signOut(auth).then(() => { window.location.href = "index.html"; }); });
    document.querySelectorAll('.fechar-modal').forEach(btn => {
        btn.addEventListener('click', e => { e.target.closest('.modal-overlay').style.display = 'none'; });
    });
    
    const botoesNav = document.querySelectorAll('.nav-btn');
    const conteudosAba = document.querySelectorAll('.tab-content');
    botoesNav.forEach(botao => {
        botao.addEventListener('click', () => {
            botoesNav.forEach(b => b.classList.remove('active'));
            conteudosAba.forEach(a => a.classList.remove('active'));
            botao.classList.add('active');
            document.getElementById(botao.getAttribute('data-target')).classList.add('active');
        });
    });

    // ===== ADD E-BOOK =====
    if(document.getElementById('btn-add-ebook')) {
        document.getElementById('btn-add-ebook').addEventListener('click', () => document.getElementById('modal-add-ebook').style.display = 'flex');
        document.getElementById('btn-salvar-ebook').addEventListener('click', async () => {
            const f = extrairLinkImagem(document.getElementById('input-foto-ebook').value); 
            const p = document.getElementById('input-pdf-ebook').value;
            const t = document.getElementById('input-titulo-ebook').value;
            const d = document.getElementById('input-desc-ebook').value;
            const h = document.getElementById('input-hash-ebook').value;
            if(!f || !p || !t || !d) { alert("Preencha tudo!"); return; }
            await addDoc(collection(db, "ebooks"), { titulo: t, desc: d, hash: h, fotoUrl: f, pdfUrl: p, ratings: [] });
            document.getElementById('modal-add-ebook').style.display = 'none';
            carregarEbooks(true, usuarioAtualUid); 
        });
    }

    // ===== ADD CURSO =====
    if(document.getElementById('btn-add-curso')) {
        document.getElementById('btn-add-curso').addEventListener('click', () => document.getElementById('modal-add-curso').style.display = 'flex');
        document.getElementById('btn-salvar-curso').addEventListener('click', async () => {
            const f = extrairLinkImagem(document.getElementById('input-foto-curso').value); 
            const y = document.getElementById('input-yt-curso').value;
            const p = document.getElementById('input-pdf-curso').value;
            const t = document.getElementById('input-titulo-curso').value;
            const d = document.getElementById('input-desc-curso').value;
            if(!f || !y || !p || !t || !d) { alert("Preencha todos os links e textos!"); return; }
            await addDoc(collection(db, "cursos"), { titulo: t, desc: d, ytUrl: y, pdfUrl: p, fotoUrl: f });
            document.getElementById('modal-add-curso').style.display = 'none';
            carregarCursos(true, usuarioAtualUid); 
        });
    }

    // ===== GERENCIAR ACESSOS =====
    if(document.getElementById('btn-gerenciar-acessos')) {
        document.getElementById('btn-gerenciar-acessos').addEventListener('click', () => document.getElementById('modal-gerenciar-acessos').style.display = 'flex');
        document.getElementById('btn-liberar-acesso').addEventListener('click', async () => {
            const cId = document.getElementById('input-cliente-id').value.trim();
            const pId = document.getElementById('input-produto-id').value.trim();
            if(!cId || !pId) return;
            const ref = doc(db, "acessos", cId);
            const snap = await getDoc(ref);
            let prod = snap.exists() ? snap.data().produtos || [] : [];
            if(!prod.includes(pId)) { prod.push(pId); await setDoc(ref, { produtos: prod }, { merge: true }); alert("✅ Liberado!"); }
        });
        document.getElementById('btn-revogar-acesso').addEventListener('click', async () => {
            const cId = document.getElementById('input-cliente-id').value.trim();
            const pId = document.getElementById('input-produto-id').value.trim();
            if(!cId || !pId) return;
            const ref = doc(db, "acessos", cId);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                let prod = snap.data().produtos || [];
                await setDoc(ref, { produtos: prod.filter(id => id !== pId) }, { merge: true });
                alert("🚫 Removido!");
            }
        });
    }

    // ===== INTERAÇÃO E-BOOKS =====
    const listaEbooks = document.getElementById('lista-ebooks');
    if (listaEbooks) {
        listaEbooks.addEventListener('click', async (event) => {
            const card = event.target.closest('.card-ebook');
            if(!card) return;
            const ebookId = card.getAttribute('data-id');

            // Apagar
            if (event.target.closest('.btn-delete-ebook')) {
                if (confirm("Apagar E-book?")) { await deleteDoc(doc(db, "ebooks", ebookId)); card.remove(); }
                return;
            }

            // MÁGICA DO BUG DAS ESTRELAS: Para a execução aqui e não abre a janela!
            if (event.target.closest('.ebook-rating-interactive')) {
                if (event.target.classList.contains('star')) {
                    const valor = parseInt(event.target.getAttribute('data-value'));
                    const ref = doc(db, "ebooks", ebookId);
                    const snap = await getDoc(ref);
                    if (snap.exists()) {
                        const notas = snap.data().ratings || []; notas.push(valor); 
                        await updateDoc(ref, { ratings: notas }); carregarEbooks(admins.includes(auth.currentUser.email), usuarioAtualUid);
                    }
                }
                return; // <-- Isso impede de abrir o Modal de detalhes ao clicar na estrela!
            }

            // Abrir Detalhes E-book
            const ebook = window.catalogoEbooks[ebookId];
            if(!ebook) return;
            document.getElementById('detalhe-img').src = ebook.fotoLimpa;
            document.getElementById('detalhe-titulo').textContent = ebook.titulo;
            document.getElementById('detalhe-desc').textContent = ebook.desc;
            document.getElementById('detalhe-tags').innerHTML = ebook.hash.split(',').map(t => t.trim() !== "" ? `<span class="hashtag">#${t.trim()}</span>` : "").join('');
            
            const acaoContainer = document.getElementById('detalhe-acao');
            if(ebook.hasAccess) {
                 acaoContainer.innerHTML = `<a href="${ebook.pdfUrl}" target="_blank" class="btn-download-pdf">📖 Acessar Conteúdo (Abrir PDF)</a>`;
            } else {
                 const msgZap = encodeURIComponent(`Olá, quero garantir meu acesso ao E-book "${ebook.titulo}" (ID: ${ebookId}).\n\nMeu ID de Cliente é: ${usuarioAtualUid}\nO e-mail que uso no Google Drive é: [Digite seu e-mail aqui]`);
                 acaoContainer.innerHTML = `<a href="https://wa.me/${NUMERO_DO_ZAP}?text=${msgZap}" target="_blank" class="btn-wpp-buy">🔒 Clique aqui e garanta já seu acesso</a>`;
            }
            document.getElementById('modal-detalhes-ebook').style.display = 'flex';
        });
    }

    // ===== INTERAÇÃO CURSOS =====
    const listaCursos = document.getElementById('lista-cursos');
    if (listaCursos) {
        listaCursos.addEventListener('click', async (event) => {
            const card = event.target.closest('.card-curso');
            if(!card) return;
            const cursoId = card.getAttribute('data-id');

            // Apagar Curso
            if (event.target.closest('.btn-delete-curso')) {
                if (confirm("Apagar Curso?")) { await deleteDoc(doc(db, "cursos", cursoId)); card.remove(); }
                return;
            }

            // Abrir Detalhes Curso (Video)
            const curso = window.catalogoCursos[cursoId];
            if(!curso) return;

            document.getElementById('detalhe-curso-titulo').textContent = curso.titulo;
            document.getElementById('detalhe-curso-desc').textContent = curso.desc;
            
            // Injeta o vídeo do YouTube
            const iframe = document.getElementById('detalhe-curso-video');
            if (curso.videoId) {
                iframe.src = `https://www.youtube.com/embed/${curso.videoId}?autoplay=1`;
                iframe.style.display = 'block';
            } else {
                iframe.style.display = 'none';
            }

            const acaoContainer = document.getElementById('detalhe-curso-acao');
            if(curso.hasAccess) {
                 acaoContainer.innerHTML = `<a href="${curso.pdfUrl}" target="_blank" class="btn-download-pdf" style="background:#8b5cf6;">🚀 Acessar Treinamento Completo (Google Drive)</a>`;
            } else {
                 const msgZap = encodeURIComponent(`Olá, quero garantir meu acesso ao Treinamento "${curso.titulo}" (ID: ${cursoId}).\n\nMeu ID de Cliente é: ${usuarioAtualUid}\nO e-mail que uso no Google Drive é: [Digite seu e-mail aqui]`);
                 acaoContainer.innerHTML = `<a href="https://wa.me/${NUMERO_DO_ZAP}?text=${msgZap}" target="_blank" class="btn-wpp-buy">🔒 Clique aqui para destravar o curso completo</a>`;
            }

            document.getElementById('modal-detalhes-curso').style.display = 'flex';
        });

        // Quando fechar o modal do curso, parar de tocar o vídeo do YouTube no fundo
        document.querySelector('#modal-detalhes-curso .fechar-modal').addEventListener('click', () => {
            document.getElementById('detalhe-curso-video').src = "";
        });
    }
}