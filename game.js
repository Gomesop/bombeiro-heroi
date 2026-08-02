/**
 * Controlador — Bombeiro Herói
 * www.horadaseguranca.com
 */

class BombeiroApp {
    constructor() {
        this.faseIndex = 0;
        this.pontos = 0;
        this.vidas = 3;
        this.itensTotal = 0;
        this.desviosTotal = 0;
        this.fasesVencidas = 0;
        this.quizAcertos = 0;
        this.quizTotal = 0;
        this.quizzesUsados = [];

        this.engine = null;
        this.dom();
        this.eventos();
    }

    dom() {
        this.telas = {
            welcome:  document.getElementById('screen-welcome'),
            briefing: document.getElementById('screen-briefing'),
            game:     document.getElementById('screen-game'),
            ad:       document.getElementById('screen-ad'),
            quiz:     document.getElementById('screen-quiz'),
            end:      document.getElementById('screen-end')
        };

        this.regName = document.getElementById('reg-name');
        this.regEmail = document.getElementById('reg-email');
        this.regCompany = document.getElementById('reg-company');
        this.setupError = document.getElementById('setup-error');

        this.canvas = document.getElementById('game-canvas');
        this.toast = document.getElementById('toast');
        this.countdown = document.getElementById('countdown');

        this.hudPhase = document.getElementById('hud-phase');
        this.hudScene = document.getElementById('hud-scene');
        this.hudTime = document.getElementById('hud-time');
        this.hudLives = document.getElementById('hud-lives');
        this.hudScore = document.getElementById('hud-score');
        this.timeFill = document.getElementById('time-fill');
    }

    eventos() {
        document.getElementById('form-register').addEventListener('submit', (e) => {
            e.preventDefault();
            this.cadastrar();
        });

        [this.regName, this.regEmail, this.regCompany].forEach(el => {
            el.addEventListener('input', () => {
                el.classList.remove('invalid');
                this.setupError.classList.add('hidden');
            });
        });

        document.getElementById('btn-start-phase').addEventListener('click', () => this.iniciarFase());
        document.getElementById('btn-skip-ad').addEventListener('click', () => this.depoisDoAnuncio());
        document.getElementById('btn-quiz-next').addEventListener('click', () => this.depoisDoQuiz());
        document.getElementById('btn-restart').addEventListener('click', () => this.reiniciar());

        const bs = document.getElementById('btn-sound');
        bs.addEventListener('click', () => {
            sons.enabled = !sons.enabled;
            bs.textContent = sons.enabled ? '🔊' : '🔇';
            bs.classList.toggle('muted', !sons.enabled);
        });

        window.addEventListener('resize', () => this.ajustarCanvas());
    }

    tela(nome) {
        Object.values(this.telas).forEach(t => t.classList.remove('active'));
        this.telas[nome].classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* ============================================================
       CADASTRO
       ============================================================ */

    erroCadastro(msg, campo) {
        [this.regName, this.regEmail, this.regCompany].forEach(el => el.classList.remove('invalid'));
        this.setupError.innerHTML = `⚠️ ${msg}`;
        this.setupError.classList.remove('hidden');
        if (campo) {
            campo.classList.add('invalid');
            campo.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => campo.focus(), 250);
        }
        sons.erro();
    }

    cadastrar() {
        const nome = this.regName.value.trim();
        const email = this.regEmail.value.trim();
        const empresa = this.regCompany.value.trim();

        if (nome.length < 3)       return this.erroCadastro('Informe o seu <strong>nome completo</strong>.', this.regName);
        if (!isEmailValido(email)) return this.erroCadastro('Informe um <strong>e-mail válido</strong>.', this.regEmail);
        if (empresa.length < 2)    return this.erroCadastro('Informe a <strong>empresa ou instituição</strong>.', this.regCompany);

        this.setupError.classList.add('hidden');
        this.participante = registro.inscrever(nome, email, empresa);

        this.faseIndex = 0;
        this.pontos = 0;
        this.vidas = 3;
        this.itensTotal = 0;
        this.desviosTotal = 0;
        this.fasesVencidas = 0;
        this.quizAcertos = 0;
        this.quizTotal = 0;
        this.quizzesUsados = [];

        sons.clique();
        this.mostrarBriefing();
    }

    /* ============================================================
       BRIEFING
       ============================================================ */

    mostrarBriefing() {
        const f = FASES[this.faseIndex];
        document.getElementById('brief-badge').textContent = `FASE ${f.n} DE ${FASES.length}`;
        document.getElementById('brief-ico').textContent = ['🏠', '🏭', '🌲', '⛽', '🏢', '🛢️'][this.faseIndex] || '🚒';
        document.getElementById('brief-title').textContent = f.nome;
        document.getElementById('brief-sub').textContent = f.subtitulo;
        document.getElementById('brief-text').textContent = f.briefing;
        document.getElementById('brief-dur').textContent = f.duracao;
        document.getElementById('brief-vel').textContent = (f.velocidade / FASES[0].velocidade).toFixed(1).replace('.0', '') + 'x';
        document.getElementById('brief-lives').textContent = '❤️'.repeat(this.vidas) || '—';
        this.tela('briefing');
    }

    /* ============================================================
       FASE
       ============================================================ */

    ajustarCanvas() {
        if (!this.canvas) return;
        const wrap = this.canvas.parentElement;
        const larg = Math.min(900, Math.max(320, wrap.clientWidth || 900));
        const alt = Math.round(Math.min(420, Math.max(240, larg * 0.47)));
        if (this.canvas.width !== larg || this.canvas.height !== alt) {
            this.canvas.width = larg;
            this.canvas.height = alt;
            if (this.engine) {
                this.engine.W = larg;
                this.engine.H = alt;
                this.engine.chaoY = alt - 64;
                this.engine.heroX = Math.max(90, larg * 0.16);
            }
        }
    }

    iniciarFase() {
        const f = FASES[this.faseIndex];
        this.tela('game');
        this.ajustarCanvas();

        this.hudPhase.textContent = `Fase ${f.n}/${FASES.length}`;
        this.hudScene.textContent = f.nome;

        if (this.engine) this.engine.destruir();

        this.engine = new BombeiroEngine(this.canvas, {
            som: (t) => {
                if (t === 'pulo') sons.pulo();
                if (t === 'coleta') sons.coleta();
                if (t === 'batida') sons.batida();
            },
            onHud: (h) => {
                this.hudTime.textContent = h.tempo;
                this.hudLives.textContent = '❤️'.repeat(Math.max(0, h.vidas)) || '💀';
                this.hudScore.textContent = this.pontos + h.pontos;
                this.timeFill.style.width = `${Math.min(100, h.progresso * 100)}%`;
            },
            onPickup: (item) => this.aviso(`${item.icone} +${item.pontos} ${item.nome}`, 'ok'),
            onHit: (obs) => this.aviso(`💥 ${obs.nome}!`, 'ruim'),
            onEnd: (r) => this.fimDaFase(r)
        });

        this.engine.carregarFase(f, this.vidas);
        this.engine.bindToque(document.getElementById('btn-jump'), document.getElementById('btn-duck'));

        this.contagem(3, () => this.engine.iniciar());
    }

    contagem(n, pronto) {
        const el = this.countdown;
        el.classList.remove('hidden');
        let i = n;
        const passo = () => {
            el.textContent = i > 0 ? i : 'VAI!';
            el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
            sons.clique();
            if (i < 0) { el.classList.add('hidden'); pronto(); return; }
            i--;
            setTimeout(passo, 700);
        };
        passo();
    }

    aviso(texto, tipo) {
        this.toast.textContent = texto;
        this.toast.className = `toast ${tipo}`;
        clearTimeout(this._toastT);
        this._toastT = setTimeout(() => this.toast.classList.add('hidden'), 1100);
    }

    fimDaFase(r) {
        this.pontos += r.pontos;
        this.itensTotal += r.coletados;
        this.desviosTotal += r.desviados;
        this.vidas = r.vidas;

        if (r.motivo === 'perdeu') {
            sons.derrota();
            this.vidas = 3;
            setTimeout(() => {
                if (confirm('Suas vidas acabaram nesta fase.\n\nDeseja tentar a mesma fase novamente?')) {
                    this.mostrarBriefing();
                } else {
                    this.finalizar(false);
                }
            }, 400);
            return;
        }

        // fase vencida
        sons.faseOk();
        this.fasesVencidas++;

        if (this.faseIndex >= FASES.length - 1) {
            this.finalizar(true);
            return;
        }

        this.mostrarAnuncio();
    }

    /* ============================================================
       PUBLICIDADE
       ============================================================ */

    /* Abre o link em aba nova por window.open. Isso importa: uma aba criada por
       target="_blank" NÃO pode se fechar sozinha (o navegador bloqueia
       window.close), e o "voltar ao jogo" de lá acabava recarregando o index e
       recomeçando a partida. Aberta por script, a aba consegue se fechar.
       Só vale para páginas do próprio site — link de terceiro segue com
       noopener, sem dar acesso à janela do jogo. */
    abrirEmAbaNova(el) {
        if (!el || el._aberturaLigada) return;
        el._aberturaLigada = true;
        el.addEventListener('click', (ev) => {
            const url = el.getAttribute('href') || '';
            const externo = /^https?:\/\//i.test(url) && !url.startsWith(location.origin);
            if (externo) return;                  // deixa o target="_blank" agir
            ev.preventDefault();
            const w = window.open(url, '_blank');  // sem noopener: a aba precisa do opener para se fechar
            if (!w) window.open(url, '_blank', 'noopener');   // popup bloqueado: tenta do jeito comum
        });
    }

    mostrarAnuncio() {
        const a = ANUNCIOS[this.faseIndex % ANUNCIOS.length];
        const card = document.getElementById('ad-card');

        card.style.background =
            `radial-gradient(circle at 88% 8%, ${a.cor3}55 0%, transparent 55%), linear-gradient(150deg, ${a.cor1} 0%, ${a.cor2} 100%)`;

        // Logotipo desenhado em SVG: escudo com as iniciais + ícone do segmento.
        // (marca tipográfica provisória — substituída pelo logo oficial do anunciante)
        document.getElementById('ad-logo').innerHTML = `
            <svg viewBox="0 0 100 100" width="100%" height="100%" aria-label="${a.marca}">
                <defs>
                    <linearGradient id="adg" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stop-color="${a.cor3}"/>
                        <stop offset="1" stop-color="${a.cor1}"/>
                    </linearGradient>
                </defs>
                <path d="M50 6 L88 20 V50c0 22-16 36-38 44C28 86 12 72 12 50V20Z" fill="url(#adg)"/>
                <path d="M50 15 L79 26 V50c0 17-12 28-29 34C33 78 21 67 21 50V26Z" fill="#ffffff" opacity=".93"/>
                <text x="50" y="52" text-anchor="middle" font-family="Outfit, sans-serif"
                      font-size="30" font-weight="900" fill="${a.cor1}">${a.iniciais}</text>
                <text x="50" y="74" text-anchor="middle" font-size="19">${a.icone || '★'}</text>
            </svg>`;
        document.getElementById('ad-name').textContent = a.marca;
        document.getElementById('ad-segment').textContent = a.segmento;
        document.getElementById('ad-tagline').textContent = a.tagline;
        document.getElementById('ad-claim').textContent = a.claim;

        document.getElementById('ad-chips').innerHTML =
            a.beneficios.map(b => `<span class="ad-chip">${b}</span>`).join('');

        // O CTA SEMPRE abre em nova aba: se navegasse na mesma, o jogador
        // perderia a partida em andamento e voltaria para o cadastro.
        const cta = document.getElementById('ad-cta');
        cta.textContent = a.cta;
        cta.href = a.url;
        cta.target = '_blank';
        cta.rel = 'noopener noreferrer';
        this.abrirEmAbaNova(cta);

        const nota = document.getElementById('ad-demo-note');
        if (a.demonstracao) {
            nota.innerHTML = 'Marca fictícia, usada só para demonstrar este espaço. ' +
                '<a href="anuncie.html" target="_blank" rel="noopener noreferrer">Quer anunciar aqui?</a>';
            nota.classList.remove('hidden');
            this.abrirEmAbaNova(nota.querySelector('a'));
        } else {
            nota.classList.add('hidden');
        }

        // libera o botão em 5s
        // (o conteúdo é reconstruído a cada exibição: ao liberar, o <span> do
        //  contador é substituído e precisa existir de novo na próxima fase)
        const btn = document.getElementById('btn-skip-ad');
        btn.innerHTML = 'Continuar em <span id="ad-count">5</span>s';
        const cont = document.getElementById('ad-count');
        btn.disabled = true;
        let s = 5;
        cont.textContent = s;
        clearInterval(this._adT);
        this._adT = setInterval(() => {
            s--;
            if (s <= 0) {
                clearInterval(this._adT);
                btn.disabled = false;
                btn.innerHTML = 'Continuar ➔';
            } else {
                cont.textContent = s;
            }
        }, 1000);

        this.tela('ad');
    }

    depoisDoAnuncio() {
        sons.clique();
        this.mostrarQuiz();
    }

    /* ============================================================
       QUIZ — ARRASTAR E SOLTAR
       ============================================================ */

    mostrarQuiz() {
        // escolhe um quiz ainda não usado
        let disponiveis = QUIZZES.filter((q, i) => !this.quizzesUsados.includes(i));
        if (!disponiveis.length) { this.quizzesUsados = []; disponiveis = QUIZZES; }
        const idx = QUIZZES.indexOf(disponiveis[Math.floor(Math.random() * disponiveis.length)]);
        this.quizzesUsados.push(idx);
        this.quizAtual = QUIZZES[idx];

        const q = this.quizAtual;
        document.getElementById('quiz-title').textContent = q.titulo;
        document.getElementById('quiz-text').textContent = q.enunciado;
        document.getElementById('quiz-feedback').classList.add('hidden');
        document.getElementById('btn-quiz-next').classList.add('hidden');

        const pool = document.getElementById('quiz-pool');
        const alvos = document.getElementById('quiz-targets');
        pool.innerHTML = '';
        alvos.innerHTML = '';

        this.quizRestantes = q.itens.length;
        this.quizCertos = 0;
        this.selecionado = null;

        embaralhar(q.itens).forEach(item => {
            const el = document.createElement('div');
            el.className = 'q-item';
            el.draggable = true;
            el.dataset.id = item.id;
            el.dataset.cat = item.cat;
            el.innerHTML = `<span class="qi-ico">${item.icone}</span><span class="qi-txt">${item.rotulo}</span>`;

            el.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.id);
                el.classList.add('dragging');
            });
            el.addEventListener('dragend', () => el.classList.remove('dragging'));

            // toque / clique: seleciona e depois escolhe o destino
            el.addEventListener('click', () => {
                if (this.selecionado === el) { el.classList.remove('selected'); this.selecionado = null; return; }
                pool.querySelectorAll('.q-item').forEach(x => x.classList.remove('selected'));
                el.classList.add('selected');
                this.selecionado = el;
                sons.clique();
            });

            pool.appendChild(el);
        });

        embaralhar(q.categorias).forEach(cat => {
            const alvo = document.createElement('div');
            alvo.className = 'q-target';
            alvo.dataset.cat = cat.id;
            alvo.innerHTML = `
                <div class="qt-head"><strong>${cat.nome}</strong><span>${cat.desc}</span></div>
                <div class="qt-drop"></div>
            `;

            alvo.addEventListener('dragover', (e) => { e.preventDefault(); alvo.classList.add('over'); });
            alvo.addEventListener('dragleave', () => alvo.classList.remove('over'));
            alvo.addEventListener('drop', (e) => {
                e.preventDefault();
                alvo.classList.remove('over');
                const id = e.dataTransfer.getData('text/plain');
                const el = pool.querySelector(`.q-item[data-id="${id}"]`);
                if (el) this.soltarItem(el, alvo);
            });

            alvo.addEventListener('click', () => {
                if (this.selecionado) this.soltarItem(this.selecionado, alvo);
            });

            alvos.appendChild(alvo);
        });

        this.tela('quiz');
    }

    soltarItem(el, alvo) {
        const certo = el.dataset.cat === alvo.dataset.cat;
        this.quizTotal++;

        el.classList.remove('selected', 'dragging');
        this.selecionado = null;

        if (certo) {
            this.quizCertos++;
            this.quizAcertos++;
            this.pontos += 25;
            sons.acerto();
            el.classList.add('ok');
            el.draggable = false;
            alvo.querySelector('.qt-drop').appendChild(el);
            alvo.classList.add('flash-ok');
            setTimeout(() => alvo.classList.remove('flash-ok'), 500);
            this.quizRestantes--;
            if (this.quizRestantes <= 0) this.quizConcluido();
        } else {
            sons.erro();
            el.classList.add('shake');
            alvo.classList.add('flash-bad');
            setTimeout(() => { el.classList.remove('shake'); alvo.classList.remove('flash-bad'); }, 450);
            this.pontos = Math.max(0, this.pontos - 5);
        }
    }

    quizConcluido() {
        const fb = document.getElementById('quiz-feedback');
        const tentativas = this.quizTotal;
        fb.innerHTML = `✅ <strong>Desafio concluído!</strong> Você classificou todos os itens corretamente.`;
        fb.classList.remove('hidden');
        document.getElementById('btn-quiz-next').classList.remove('hidden');
        sons.faseOk();
    }

    depoisDoQuiz() {
        sons.clique();
        this.faseIndex++;
        this.vidas = Math.min(3, this.vidas + 1);   // recupera uma vida entre fases
        this.mostrarBriefing();
    }

    /* ============================================================
       FIM
       ============================================================ */

    finalizar(venceu) {
        if (this.engine) { this.engine.destruir(); this.engine = null; }

        const precisao = this.quizTotal ? Math.round((this.quizAcertos / this.quizTotal) * 100) : 0;

        let rank, ico;
        if (venceu && this.pontos >= 1400)      { rank = 'Comandante de Operações'; ico = '🏅'; }
        else if (venceu && this.pontos >= 900)  { rank = 'Bombeiro Sênior';         ico = '🏆'; }
        else if (venceu)                        { rank = 'Bombeiro Habilitado';     ico = '🎖️'; }
        else if (this.fasesVencidas >= 3)       { rank = 'Brigadista em formação';  ico = '🧑‍🚒'; }
        else                                    { rank = 'Aspirante';               ico = '🚒'; }

        document.getElementById('end-ico').textContent = ico;
        document.getElementById('end-title').textContent = venceu ? 'Missão cumprida!' : 'Missão encerrada';
        document.getElementById('end-sub').textContent = venceu
            ? 'Você atravessou as seis fases e dominou o combate a incêndio.'
            : `Você venceu ${this.fasesVencidas} de ${FASES.length} fases. Treine mais e volte para concluir a missão.`;

        document.getElementById('end-score').textContent = this.pontos;
        document.getElementById('end-rank').textContent = rank;
        document.getElementById('m-phases').textContent = `${this.fasesVencidas}/${FASES.length}`;
        document.getElementById('m-items').textContent = this.itensTotal;
        document.getElementById('m-dodge').textContent = this.desviosTotal;
        document.getElementById('m-quiz').textContent = `${precisao}%`;

        registro.concluir(this.pontos, `${rank} — ${this.fasesVencidas}/${FASES.length} fases`);

        if (venceu) sons.vitoria(); else sons.derrota();
        this.tela('end');
    }

    reiniciar() {
        sons.clique();
        this.tela('welcome');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.bhApp = new BombeiroApp();
});
