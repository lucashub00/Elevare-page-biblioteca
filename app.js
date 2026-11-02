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
// FUNÇÕES AUXILIARES MÁGICAS E BLINDADAS
// ==========================================
function extrairLinkImagem(inputTexto) {
    if (!inputTexto) return "";
    let txt = String(inputTexto).trim();
    const matchDireto = txt.match(/https?:\/\/[^\s"'<>]+?\.(?:png|jpe?g|gif|webp)/i);
    if (matchDireto) return matchDireto[0];
    const matchSrc = txt.match(/src=["']?(https?:\/\/[^"'\s>]+)["']?/i);
    if (matchSrc) return matchSrc[1];
    return txt.replace(/['"]/g, '');
}

function extrairIdYoutube(url) {
    if (!url) return "";
    let txt = String(url).trim();
    if (txt.length === 11) return txt;

    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = txt.match(regex);
    return match ? match[1] : "";
}

async function lerAcessosComTimeout(uid) {
    try {
        const snap = await Promise.race([
            getDoc(doc(db, "acessos", uid)),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout Firebase")), 3500))
        ]);
        return (snap && snap.exists()) ? (snap.data().produtos || []) : [];
    } catch (error) { return []; }
}

// ==========================================
// LÓGICA: INDEX E CADASTRO
// ==========================================
if (document.body.classList.contains('page-index')) {
    getDoc(doc(db, "config", "geral")).then(snap => {
        if (snap.exists() && snap.data().videoUrl) {
            document.getElementById('iframe-video-vendas').src = `https://www.youtube.com/embed/${snap.data().videoUrl}?rel=0&modestbranding=1`;
        }
    }).catch(e => console.log("Sem vídeo configurado."));

    document.querySelectorAll('.action-bridge').forEach(btn => {
        btn.addEventListener('click', e => { e.preventDefault(); document.getElementById('login-section').scrollIntoView({ behavior: 'smooth' }); });
    });

    document.getElementById('btn-entrar').addEventListener('click', () => {
        const e = document.getElementById('email-login').value, s = document.getElementById('senha-login').value, m = document.getElementById('mensagem-erro');
        m.style.display = 'none';
        if (!e || !s) { m.textContent = "Preencha e-mail e senha!"; m.style.display = 'block'; return; }
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
        if (!e || !s) { m.textContent = "Preencha tudo!"; m.style.display = 'block'; return; }
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

    // FORÇAR ADMIN TEMPORÁRIO (Mude para false quando terminar os testes)
    const forcarAdmin = true;
    const admins = ["suporteelevaresolucoes@gmail.com"];

    let NUMERO_DO_ZAP = "5532999999999";
    let EMAIL_SUPORTE = "";
    let usuarioAtualUid = "";
    let statusAdminAtual = false;

    window.catalogoEbooks = {};
    window.catalogoCursos = {};

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                usuarioAtualUid = user.uid || "SemID";
                const emailUsuario = user.email || "";
                const nomeUsuario = user.displayName || (emailUsuario ? emailUsuario.split('@')[0] : "Visitante");

                document.getElementById('user-nome').textContent = nomeUsuario;
                document.getElementById('user-uid').textContent = "ID Cliente: " + usuarioAtualUid;
                document.getElementById('user-foto').src = user.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png";
                document.getElementById('user-foto').style.display = "block";

                // Verifica se o e-mail está na lista OU se o modo forçado está ativo
                statusAdminAtual = admins.includes(emailUsuario) || forcarAdmin;
                if (statusAdminAtual) {
                    document.querySelectorAll('.btn-admin').forEach(btn => btn.style.display = 'inline-block');
                }

                await carregarConfiguracoesGerais();
                carregarEbooks(statusAdminAtual, usuarioAtualUid);
                carregarCursos(statusAdminAtual, usuarioAtualUid);
            } catch (err) {
                console.error("Erro no cabeçalho:", err);
            }
        } else {
            window.location.href = "index.html";
        }
    });

    // ===== CARREGAR CENTRAL DE COMANDOS =====
    async function carregarConfiguracoesGerais() {
        try {
            const configSnap = await getDoc(doc(db, "config", "geral"));
            if (configSnap.exists()) {
                const cfg = configSnap.data();

                if (cfg.telefone) NUMERO_DO_ZAP = cfg.telefone;
                if (cfg.email) EMAIL_SUPORTE = cfg.email;
                if (cfg.logoUrl) document.getElementById('logo-plataforma').src = cfg.logoUrl;
                const btnZapAtendimento = document.getElementById('link-zap-atendimento');
                if (btnZapAtendimento) btnZapAtendimento.href = `https://wa.me/${NUMERO_DO_ZAP}?text=Ol%C3%A1,%20preciso%20de%20ajuda%20na%20plataforma.`;

                const btnEmailAtendimento = document.getElementById('link-email-atendimento');
                if (btnEmailAtendimento && EMAIL_SUPORTE) btnEmailAtendimento.href = `mailto:${EMAIL_SUPORTE}`;
                if (document.getElementById('cfg-zap')) document.getElementById('cfg-zap').value = NUMERO_DO_ZAP;
                if (document.getElementById('cfg-email')) document.getElementById('cfg-email').value = EMAIL_SUPORTE;
                if (document.getElementById('cfg-logo') && cfg.logoUrl) document.getElementById('cfg-logo').value = cfg.logoUrl;

                if (document.getElementById('cfg-video') && cfg.videoUrl) document.getElementById('cfg-video').value = `https://youtu.be/${cfg.videoUrl}`;
            }
        } catch (e) { console.error("Erro config:", e); }
    }

    // ===== SALVAR CENTRAL DE COMANDOS =====
    if (document.getElementById('btn-central-admin')) {
        const modalCentral = document.getElementById('modal-central-admin');
        document.getElementById('btn-central-admin').addEventListener('click', () => modalCentral.style.display = 'flex');

        document.getElementById('btn-salvar-config').addEventListener('click', async () => {
            const zapVal = document.getElementById('cfg-zap').value.replace(/\D/g, '');
            const emailVal = document.getElementById('cfg-email').value;
            const logoVal = extrairLinkImagem(document.getElementById('cfg-logo').value);

            const videoInput = document.getElementById('cfg-video').value;
            const videoVal = extrairIdYoutube(videoInput);

            if (videoInput && !videoVal) {
                alert("⚠️ O link do YouTube parece inválido! Cole o link correto para funcionar.");
                return;
            }
            try {
                await setDoc(doc(db, "config", "geral"), {
                    telefone: zapVal,
                    email: emailVal,
                    logoUrl: logoVal,
                    videoUrl: videoVal
                }, { merge: true });

                alert("✅ Configurações Globais atualizadas com sucesso!");
                window.location.reload();
            } catch (e) {
                alert("Erro ao salvar: " + e.message);
            }
        });
    }

    // ===== 1. CARREGAR E-BOOKS =====
    async function carregarEbooks(isAdmin, uid) {
        const listaEbooks = document.getElementById('lista-ebooks');
        if (!listaEbooks) return;
        listaEbooks.innerHTML = '<p style="color: #94a3b8; font-size: 18px;">Carregando e-books...</p>';
        try {
            let ebooksLiberados = isAdmin ? [] : await lerAcessosComTimeout(uid);
            const querySnapshot = await getDocs(collection(db, "ebooks"));
            listaEbooks.innerHTML = '';

            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data(), id = docSnap.id;
                const fotoLimpa = extrairLinkImagem(data.fotoUrl);
                const hasAccess = isAdmin || ebooksLiberados.includes(id);
                let media = 0;
                if (data.ratings && data.ratings.length > 0) media = (data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length).toFixed(1);
                window.catalogoEbooks[id] = { ...data, id: id, fotoLimpa: fotoLimpa, media: media, hasAccess: hasAccess };
                const tagsHtml = data.hash ? String(data.hash).split(',').map(t => t.trim() !== "" ? `<span class="hashtag">#${t.trim()}</span>` : "").join('') : '';
                let estrelasHtml = '';
                for (let i = 1; i <= 5; i++) estrelasHtml += `<span class="star ${i <= Math.round(media) ? 'active' : ''}" data-value="${i}">★</span>`;
                
                const card = document.createElement('div');
                card.className = 'card-ebook';
                card.setAttribute('data-id', id);
                card.innerHTML = `
                    <button class="btn-delete-ebook" style="display: ${isAdmin ? 'flex' : 'none'};" title="Apagar E-book">🗑️</button>
                    <button class="btn-edit-ebook" style="display: ${isAdmin ? 'flex' : 'none'}; position: absolute; top: 10px; right: 50px; background: #f59e0b; color: #0f172a; border: none; width: 34px; height: 34px; border-radius: 50%; align-items: center; justify-content: center; cursor: pointer; z-index: 10; font-size: 16px; box-shadow: 0 4px 10px rgba(0,0,0,0.4);" title="Editar E-book">✏️</button>
                    ${hasAccess ? '' : `<div class="badge-lock">🔒 Bloqueado</div>`}
                    <img src="${fotoLimpa}" alt="Capa" class="ebook-cover">
                    <div class="ebook-info">
                        ${isAdmin ? `<span class="admin-id-tag">ID Prod: ${id}</span>` : ''}
                        <div class="hashtags">${tagsHtml}</div>
                        <h3>${data.titulo || 'Sem Título'}</h3>
                        <p class="desc-preview">${data.desc || ''}</p>
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
        } catch (error) {
            listaEbooks.innerHTML = '<p style="color: #ef4444;">Erro ao carregar e-books.</p>';
        }
    }

    // ===== 2. CARREGAR CURSOS =====
    async function carregarCursos(isAdmin, uid) {
        const lista = document.getElementById('lista-cursos');
        if (!lista) return;
        lista.innerHTML = '<p style="color: #94a3b8; font-size: 18px;">Carregando cursos...</p>';
        try {
            let cursosLiberados = isAdmin ? [] : await lerAcessosComTimeout(uid);
            const querySnapshot = await getDocs(collection(db, "cursos"));
            lista.innerHTML = '';

            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data(), id = docSnap.id;
                const fotoLimpa = extrairLinkImagem(data.fotoUrl);
                const videoId = extrairIdYoutube(data.ytUrl);
                const hasAccess = isAdmin || cursosLiberados.includes(id);
                let media = 0;
                if (data.ratings && data.ratings.length > 0) media = (data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length).toFixed(1);
                window.catalogoCursos[id] = { ...data, id: id, fotoLimpa: fotoLimpa, videoId: videoId, hasAccess: hasAccess };
                let estrelasHtml = '';
                for (let i = 1; i <= 5; i++) estrelasHtml += `<span class="star ${i <= Math.round(media) ? 'active' : ''}" data-value="${i}">★</span>`;
                
                const card = document.createElement('div');
                card.className = 'card-ebook card-curso';
                card.setAttribute('data-id', id);
                card.innerHTML = `
                    <button class="btn-delete-curso" style="display: ${isAdmin ? 'flex' : 'none'};" title="Apagar Curso">🗑️</button>
                    <button class="btn-edit-curso" style="display: ${isAdmin ? 'flex' : 'none'}; position: absolute; top: 10px; right: 50px; background: #f59e0b; color: #0f172a; border: none; width: 34px; height: 34px; border-radius: 50%; align-items: center; justify-content: center; cursor: pointer; z-index: 10; font-size: 16px; box-shadow: 0 4px 10px rgba(0,0,0,0.4);" title="Editar Guia">✏️</button>
                    ${hasAccess ? '' : `<div class="badge-lock">🔒 Bloqueado</div>`}
                    <img src="${fotoLimpa}" alt="Capa" class="ebook-cover">
                    <div class="ebook-info">
                        ${isAdmin ? `<span class="admin-id-tag">ID Prod: ${id}</span>` : ''}
                        <h3>${data.titulo || 'Sem Título'}</h3>
                        <p class="desc-preview">${data.desc || ''}</p>
                        <span class="ler-mais-txt">Assistir Aula Demo...</span>
                        
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
                lista.appendChild(card);
            });
        } catch (error) {
            lista.innerHTML = '<p style="color: #ef4444;">Erro ao carregar cursos.</p>';
        }
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

    // ===== ADD E-BOOK (Apenas Criação) =====
    if (document.getElementById('btn-add-ebook')) {
        document.getElementById('btn-add-ebook').addEventListener('click', () => document.getElementById('modal-add-ebook').style.display = 'flex');
        document.getElementById('btn-salvar-ebook').addEventListener('click', async () => {
            const f = extrairLinkImagem(document.getElementById('input-foto-ebook').value);
            const p = document.getElementById('input-pdf-ebook').value;
            const t = document.getElementById('input-titulo-ebook').value;
            const d = document.getElementById('input-desc-ebook').value;
            const h = document.getElementById('input-hash-ebook').value;
            if (!f || !p || !t || !d) { alert("Preencha tudo!"); return; }
            const novoId = Math.floor(1000000 + Math.random() * 9000000).toString();
            await setDoc(doc(db, "ebooks", novoId), { titulo: t, desc: d, hash: h, fotoUrl: f, pdfUrl: p, ratings: [] });
            document.getElementById('modal-add-ebook').style.display = 'none';
            carregarEbooks(statusAdminAtual, usuarioAtualUid);
        });
    }

    // ===== SALVAR EDIÇÃO DE E-BOOK (Separado) =====
    if (document.getElementById('btn-confirmar-edit-ebook')) {
        document.getElementById('btn-confirmar-edit-ebook').addEventListener('click', async () => {
            const id = document.getElementById('edit-id-ebook').value;
            const f = extrairLinkImagem(document.getElementById('edit-foto-ebook').value);
            const p = document.getElementById('edit-pdf-ebook').value.trim();
            const t = document.getElementById('edit-titulo-ebook').value.trim();
            const d = document.getElementById('edit-desc-ebook').value.trim();
            const h = document.getElementById('edit-hash-ebook').value.trim();
            if (!id || !f || !p || !t || !d) { alert("Preencha todos os campos obrigatórios!"); return; }
            try {
                await updateDoc(doc(db, "ebooks", id), {
                    fotoUrl: f,
                    pdfUrl: p,
                    titulo: t,
                    desc: d,
                    hash: h
                });
                alert("✅ E-book atualizado com sucesso!");
                document.getElementById('modal-edit-ebook').style.display = 'none';
                carregarEbooks(statusAdminAtual, usuarioAtualUid);
            } catch (err) {
                alert("Erro ao atualizar e-book: " + err.message);
            }
        });
    }

    // ===== ADD CURSO (Apenas Criação) =====
    if (document.getElementById('btn-add-curso')) {
        document.getElementById('btn-add-curso').addEventListener('click', () => document.getElementById('modal-add-curso').style.display = 'flex');
        document.getElementById('btn-salvar-curso').addEventListener('click', async () => {
            const f = extrairLinkImagem(document.getElementById('input-foto-curso').value);
            const y = document.getElementById('input-yt-curso').value;
            const p = document.getElementById('input-pdf-curso').value;
            const t = document.getElementById('input-titulo-curso').value;
            const d = document.getElementById('input-desc-curso').value;
            if (!f || !y || !p || !t || !d) { alert("Preencha todos os links e textos!"); return; }

            const novoId = Math.floor(1000000 + Math.random() * 9000000).toString();
            await setDoc(doc(db, "cursos", novoId), { titulo: t, desc: d, ytUrl: y, pdfUrl: p, fotoUrl: f, ratings: [] });
            document.getElementById('modal-add-curso').style.display = 'none';
            carregarCursos(statusAdminAtual, usuarioAtualUid);
        });
    }

    // ===== SALVAR EDIÇÃO DE CURSO (Separado) =====
    if (document.getElementById('btn-confirmar-edit-curso')) {
        document.getElementById('btn-confirmar-edit-curso').addEventListener('click', async () => {
            const id = document.getElementById('edit-id-curso').value;
            const f = extrairLinkImagem(document.getElementById('edit-foto-curso').value);
            const y = document.getElementById('edit-yt-curso').value.trim();
            const p = document.getElementById('edit-pdf-curso').value.trim();
            const t = document.getElementById('edit-titulo-curso').value.trim();
            const d = document.getElementById('edit-desc-curso').value.trim();
            if (!id || !f || !y || !p || !t || !d) { alert("Preencha todos os campos!"); return; }
            try {
                await updateDoc(doc(db, "cursos", id), {
                    fotoUrl: f,
                    ytUrl: y,
                    pdfUrl: p,
                    titulo: t,
                    desc: d
                });
                alert("✅ Guia em vídeo atualizado com sucesso!");
                document.getElementById('modal-edit-curso').style.display = 'none';
                carregarCursos(statusAdminAtual, usuarioAtualUid);
            } catch (err) {
                alert("Erro ao atualizar guia: " + err.message);
            }
        });
    }

    // ===== GERENCIAR ACESSOS UNIVERSAL =====
    const modalAcesso = document.getElementById('modal-gerenciar-acessos');
    document.querySelectorAll('.btn-abrir-gerenciador').forEach(btn => {
        btn.addEventListener('click', () => modalAcesso.style.display = 'flex');
    });
    if (document.getElementById('btn-liberar-acesso')) {
        document.getElementById('btn-liberar-acesso').addEventListener('click', async () => {
            const cId = document.getElementById('input-cliente-id').value.trim();
            const pId = document.getElementById('input-produto-id').value.trim();
            if (!cId || !pId) return;
            const ref = doc(db, "acessos", cId);
            const snap = await getDoc(ref);
            let prod = snap.exists() ? snap.data().produtos || [] : [];
            if (!prod.includes(pId)) {
                prod.push(pId); await setDoc(ref, { produtos: prod }, { merge: true }); alert("✅ Acesso Liberado!");
            } else { alert("O cliente já possui acesso."); }
        });
        document.getElementById('btn-revogar-acesso').addEventListener('click', async () => {
            const cId = document.getElementById('input-cliente-id').value.trim();
            const pId = document.getElementById('input-produto-id').value.trim();
            if (!cId || !pId) return;
            const ref = doc(db, "acessos", cId);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                let prod = snap.data().produtos || [];
                await setDoc(ref, { produtos: prod.filter(id => id !== pId) }, { merge: true });
                alert("🚫 Acesso Removido!");
            }
        });
    }

    // ===== INTERAÇÃO E-BOOKS =====
    const listaEbooks = document.getElementById('lista-ebooks');
    if (listaEbooks) {
        listaEbooks.addEventListener('click', async (event) => {
            const card = event.target.closest('.card-ebook');
            if (!card) return;
            const ebookId = card.getAttribute('data-id');

            // Botão Apagar
            if (event.target.closest('.btn-delete-ebook')) {
                if (confirm("Apagar E-book?")) { await deleteDoc(doc(db, "ebooks", ebookId)); card.remove(); }
                return;
            }

            // Botão Editar no Cartão
            if (event.target.closest('.btn-edit-ebook')) {
                const eb = window.catalogoEbooks[ebookId];
                if (!eb) return;
                document.getElementById('edit-id-ebook').value = ebookId;
                document.getElementById('edit-foto-ebook').value = eb.fotoUrl || '';
                document.getElementById('edit-pdf-ebook').value = eb.pdfUrl || '';
                document.getElementById('edit-titulo-ebook').value = eb.titulo || '';
                document.getElementById('edit-desc-ebook').value = eb.desc || '';
                document.getElementById('edit-hash-ebook').value = eb.hash || '';
                document.getElementById('modal-edit-ebook').style.display = 'flex';
                return;
            }

            // Avaliação por Estrelas
            if (event.target.closest('.ebook-rating-interactive')) {
                if (event.target.classList.contains('star')) {
                    const valor = parseInt(event.target.getAttribute('data-value'));
                    const ref = doc(db, "ebooks", ebookId);
                    const snap = await getDoc(ref);
                    if (snap.exists()) {
                        const notas = snap.data().ratings || []; notas.push(valor);
                        await updateDoc(ref, { ratings: notas }); carregarEbooks(statusAdminAtual, usuarioAtualUid);
                    }
                }
                return;
            }

            const ebook = window.catalogoEbooks[ebookId];
            if (!ebook) return;
            document.getElementById('detalhe-img').src = ebook.fotoLimpa;
            document.getElementById('detalhe-titulo').textContent = ebook.titulo;
            document.getElementById('detalhe-desc').textContent = ebook.desc;
            document.getElementById('detalhe-tags').innerHTML = ebook.hash ? String(ebook.hash).split(',').map(t => t.trim() !== "" ? `<span class="hashtag">#${t.trim()}</span>` : "").join('') : '';

            const acaoContainer = document.getElementById('detalhe-acao');
            if (ebook.hasAccess) {
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
            if (!card) return;
            const cursoId = card.getAttribute('data-id');

            // Botão Apagar
            if (event.target.closest('.btn-delete-curso')) {
                if (confirm("Apagar Curso?")) { await deleteDoc(doc(db, "cursos", cursoId)); card.remove(); }
                return;
            }

            // Botão Editar no Cartão
            if (event.target.closest('.btn-edit-curso')) {
                const cur = window.catalogoCursos[cursoId];
                if (!cur) return;
                document.getElementById('edit-id-curso').value = cursoId;
                document.getElementById('edit-foto-curso').value = cur.fotoUrl || '';
                document.getElementById('edit-yt-curso').value = cur.ytUrl || '';
                document.getElementById('edit-pdf-curso').value = cur.pdfUrl || '';
                document.getElementById('edit-titulo-curso').value = cur.titulo || '';
                document.getElementById('edit-desc-curso').value = cur.desc || '';
                document.getElementById('modal-edit-curso').style.display = 'flex';
                return;
            }

            // Avaliação por Estrelas
            if (event.target.closest('.ebook-rating-interactive')) {
                if (event.target.classList.contains('star')) {
                    const valor = parseInt(event.target.getAttribute('data-value'));
                    const ref = doc(db, "cursos", cursoId);
                    const snap = await getDoc(ref);
                    if (snap.exists()) {
                        const notas = snap.data().ratings || []; notas.push(valor);
                        await updateDoc(ref, { ratings: notas }); carregarCursos(statusAdminAtual, usuarioAtualUid);
                    }
                }
                return;
            }

            const curso = window.catalogoCursos[cursoId];
            if (!curso) return;
            document.getElementById('detalhe-curso-titulo').textContent = curso.titulo;
            document.getElementById('detalhe-curso-desc').textContent = curso.desc;

            const iframe = document.getElementById('detalhe-curso-video');
            if (curso.videoId) {
                iframe.src = `https://www.youtube.com/embed/${curso.videoId}?autoplay=1`;
                iframe.style.display = 'block';
            } else {
                iframe.style.display = 'none';
            }
            const acaoContainer = document.getElementById('detalhe-curso-acao');
            if (curso.hasAccess) {
                acaoContainer.innerHTML = `<a href="${curso.pdfUrl}" target="_blank" class="btn-download-pdf" style="background:#8b5cf6;">🚀 Desbloqueie o tutorial completo ao adquirir o e-book</a>`;
            } else {
                const msgZap = encodeURIComponent(`Olá, quero garantir meu acesso ao Guia "${curso.titulo}" (ID: ${cursoId}).\n\nMeu ID de Cliente é: ${usuarioAtualUid}\nO e-mail que uso no Google Drive é: [Digite seu e-mail aqui]`);
                acaoContainer.innerHTML = `<a href="https://wa.me/${NUMERO_DO_ZAP}?text=${msgZap}" target="_blank" class="btn-wpp-buy">🔒 Desbloqueie o tutorial completo ao adquirir o e-book</a>`;
            }
            document.getElementById('modal-detalhes-curso').style.display = 'flex';
        });

        const btnFecharCurso = document.querySelector('#modal-detalhes-curso .fechar-modal');
        if (btnFecharCurso) {
            btnFecharCurso.addEventListener('click', () => {
                document.getElementById('detalhe-curso-video').src = "";
            });
        }
    }
}