/**
 * Motor do runner — Bombeiro Herói
 * www.horadaseguranca.com
 */

class BombeiroEngine {
    constructor(canvas, opts = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.onHud = opts.onHud || (() => {});
        this.onEnd = opts.onEnd || (() => {});
        this.onPickup = opts.onPickup || (() => {});
        this.onHit = opts.onHit || (() => {});
        this.som = opts.som || (() => {});

        this.W = canvas.width;
        this.H = canvas.height;
        this.chaoY = this.H - 64;

        this.fase = FASES[0];
        this.running = false;

        this.bindInput();
    }

    /* ============================================================
       CICLO
       ============================================================ */

    carregarFase(fase, vidas) {
        this.fase = fase;
        this.tempoTotal = fase.duracao;
        this.tempoRestante = fase.duracao;
        this.velocidade = fase.velocidade;

        this.vidas = vidas != null ? vidas : 3;
        this.pontos = 0;
        this.coletados = 0;
        this.desviados = 0;
        this.batidas = 0;

        // herói
        this.heroX = Math.max(90, this.W * 0.16);
        this.heroY = this.chaoY;
        this.vy = 0;
        this.noChao = true;
        this.agachado = false;
        this.correndo = 0;
        this.invuln = 0;
        this.piscar = 0;

        this.objetos = [];
        this.particulas = [];
        this.spawnTimer = 1.0;
        this.mundoX = 0;
        this.shake = 0;
        this.ultimoTs = 0;

        // parallax
        this.camadas = [0, 0, 0];

        this.desenhar();
    }

    iniciar() {
        this.running = true;
        this.ultimoTs = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    parar() { this.running = false; }

    destruir() {
        this.running = false;
        window.removeEventListener('keydown', this._kd);
        window.removeEventListener('keyup', this._ku);
    }

    loop(ts) {
        if (!this.running) return;
        const dt = Math.min(0.05, (ts - this.ultimoTs) / 1000);
        this.ultimoTs = ts;
        this.atualizar(dt);
        this.desenhar();
        requestAnimationFrame((t) => this.loop(t));
    }

    /* ============================================================
       ENTRADA
       ============================================================ */

    bindInput() {
        this._kd = (e) => {
            if (!this.running) return;
            const k = e.key.toLowerCase();
            if (k === ' ' || k === 'arrowup' || k === 'w') { this.pular(); e.preventDefault(); }
            if (k === 'arrowdown' || k === 's') { this.agachado = true; e.preventDefault(); }
        };
        this._ku = (e) => {
            const k = e.key.toLowerCase();
            if (k === 'arrowdown' || k === 's') this.agachado = false;
        };
        window.addEventListener('keydown', this._kd);
        window.addEventListener('keyup', this._ku);
    }

    bindToque(btnPular, btnAgachar) {
        if (btnPular) {
            btnPular.addEventListener('pointerdown', (e) => { e.preventDefault(); this.pular(); });
        }
        if (btnAgachar) {
            const on = (e) => { e.preventDefault(); this.agachado = true; };
            const off = (e) => { e.preventDefault(); this.agachado = false; };
            btnAgachar.addEventListener('pointerdown', on);
            btnAgachar.addEventListener('pointerup', off);
            btnAgachar.addEventListener('pointerleave', off);
            btnAgachar.addEventListener('pointercancel', off);
        }
        // toque direto no canvas: metade de cima pula, metade de baixo agacha
        this.canvas.addEventListener('pointerdown', (e) => {
            if (!this.running) return;
            e.preventDefault();
            const r = this.canvas.getBoundingClientRect();
            const y = (e.clientY - r.top) / r.height;
            if (y > 0.68) { this.agachado = true; setTimeout(() => this.agachado = false, 600); }
            else this.pular();
        });
    }

    pular() {
        if (this.noChao) {
            this.vy = -640;
            this.noChao = false;
            this.agachado = false;
            this.som('pulo');
        }
    }

    /* ============================================================
       ATUALIZAÇÃO
       ============================================================ */

    atualizar(dt) {
        this.tempoRestante -= dt;
        if (this.tempoRestante <= 0) { this.finalizar('completou'); return; }

        const vel = this.velocidade;
        this.mundoX += vel * dt;
        this.camadas[0] += vel * 0.15 * dt;
        this.camadas[1] += vel * 0.35 * dt;
        this.camadas[2] += vel * 0.7 * dt;
        this.correndo += dt * (vel / 40);

        // física do herói
        this.vy += 1750 * dt;
        this.heroY += this.vy * dt;
        if (this.heroY >= this.chaoY) {
            this.heroY = this.chaoY;
            this.vy = 0;
            this.noChao = true;
        }

        if (this.invuln > 0) this.invuln -= dt;
        if (this.shake > 0) this.shake -= dt;

        // spawn
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.gerar();
            const [a, b] = this.fase.intervalo;
            this.spawnTimer = a + Math.random() * (b - a);
        }

        // objetos
        const hb = this.hitboxHeroi();
        for (const o of this.objetos) {
            o.x -= vel * dt;
            o.fase = (o.fase || 0) + dt;

            if (o.pego || o.x < -160) continue;

            if (this.colide(hb, this.hitboxObjeto(o))) {
                if (o.tipo === 'item') {
                    o.pego = true;
                    this.pontos += o.dados.pontos;
                    this.coletados++;
                    this.som('coleta');
                    this.faisca(o.x, o.y, '#fbbf24');
                    this.onPickup(o.dados);
                } else if (this.invuln <= 0) {
                    this.bater(o);
                }
            }

            if (!o.contado && o.x + 60 < this.heroX && o.tipo === 'obstaculo') {
                o.contado = true;
                this.desviados++;
                this.pontos += 5;
            }
        }
        this.objetos = this.objetos.filter(o => o.x > -180 && !(o.pego && o.fase > 0.6));

        // partículas
        for (const p of this.particulas) {
            p.x += p.vx * dt; p.y += p.vy * dt;
            p.vy += 900 * dt; p.vida -= dt;
        }
        this.particulas = this.particulas.filter(p => p.vida > 0);

        this.onHud({
            tempo: Math.max(0, Math.ceil(this.tempoRestante)),
            progresso: 1 - this.tempoRestante / this.tempoTotal,
            vidas: this.vidas,
            pontos: this.pontos,
            coletados: this.coletados
        });
    }

    gerar() {
        // 45% item, 55% obstáculo
        if (Math.random() < 0.45) {
            const dados = ITENS[Math.floor(Math.random() * ITENS.length)];
            const alto = Math.random() < 0.5;
            this.objetos.push({
                tipo: 'item', dados,
                x: this.W + 60,
                y: alto ? this.chaoY - 132 : this.chaoY - 42,
                larg: 42, alt: 42, fase: 0
            });
        } else {
            const ids = this.fase.obstaculos;
            const id = ids[Math.floor(Math.random() * ids.length)];
            const dados = OBSTACULOS.find(o => o.id === id);
            this.objetos.push({
                tipo: 'obstaculo', dados,
                x: this.W + 60,
                y: dados.alto ? this.chaoY - 116 : this.chaoY - dados.alt / 2,
                larg: dados.larg, alt: dados.alt, fase: 0
            });
        }
    }

    hitboxHeroi() {
        const larg = 34;
        const alt = this.agachado && this.noChao ? 40 : 68;
        return { x: this.heroX - larg / 2, y: this.heroY - alt, w: larg, h: alt };
    }

    hitboxObjeto(o) {
        const m = o.tipo === 'item' ? 4 : 7;   // margem de tolerância
        return { x: o.x - o.larg / 2 + m, y: o.y - o.alt / 2 + m, w: o.larg - m * 2, h: o.alt - m * 2 };
    }

    colide(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    bater(o) {
        this.vidas--;
        this.batidas++;
        this.invuln = 1.5;
        this.shake = 0.4;
        this.pontos = Math.max(0, this.pontos - 15);
        o.contado = true;
        this.som('batida');
        this.faisca(this.heroX, this.heroY - 34, '#ef4444');
        this.onHit(o.dados);
        if (this.vidas <= 0) this.finalizar('perdeu');
    }

    faisca(x, y, cor) {
        for (let i = 0; i < 12; i++) {
            this.particulas.push({
                x, y,
                vx: (Math.random() - 0.5) * 260,
                vy: -Math.random() * 260,
                vida: 0.4 + Math.random() * 0.35,
                cor, r: 2 + Math.random() * 3
            });
        }
    }

    finalizar(motivo) {
        if (!this.running) return;
        this.running = false;
        this.onEnd({
            motivo,
            pontos: this.pontos,
            coletados: this.coletados,
            desviados: this.desviados,
            batidas: this.batidas,
            vidas: Math.max(0, this.vidas)
        });
    }

    /* ============================================================
       RENDER
       ============================================================ */

    desenhar() {
        const c = this.ctx;
        c.save();
        if (this.shake > 0) c.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);

        this.fundo(c);
        this.cenario(c);
        this.chao(c);

        for (const o of this.objetos) this.objeto(c, o);
        this.heroi(c);

        for (const p of this.particulas) {
            c.globalAlpha = Math.max(0, p.vida * 2);
            c.fillStyle = p.cor;
            c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
        }
        c.globalAlpha = 1;
        c.restore();
    }

    fundo(c) {
        const g = c.createLinearGradient(0, 0, 0, this.chaoY);
        g.addColorStop(0, this.fase.ceu[0]);
        g.addColorStop(1, this.fase.ceu[1]);
        c.fillStyle = g;
        c.fillRect(-20, -20, this.W + 40, this.H + 40);
    }

    chao(c) {
        c.fillStyle = this.fase.chao;
        c.fillRect(-20, this.chaoY, this.W + 40, this.H - this.chaoY + 20);
        c.fillStyle = 'rgba(0,0,0,0.22)';
        c.fillRect(-20, this.chaoY, this.W + 40, 6);
        // marcações correndo
        c.fillStyle = 'rgba(255,255,255,0.16)';
        const passo = 70;
        const off = this.camadas[2] % passo;
        for (let x = -off; x < this.W + passo; x += passo) c.fillRect(x, this.chaoY + 26, 34, 5);
    }

    /* --- cenários por fase --- */
    cenario(c) {
        const t = this.fase.cenario;
        if (t === 'cidade')    this.cenCidade(c);
        if (t === 'industria') this.cenIndustria(c);
        if (t === 'floresta')  this.cenFloresta(c);
        if (t === 'posto')     this.cenPosto(c);
        if (t === 'predio')    this.cenPredio(c);
        if (t === 'refinaria') this.cenRefinaria(c);
    }

    repetir(c, largura, offset, fn) {
        const off = offset % largura;
        for (let i = -1; i <= Math.ceil(this.W / largura) + 1; i++) {
            const x = i * largura - off;
            c.save(); c.translate(x, 0); fn(x); c.restore();
        }
    }

    cenCidade(c) {
        const base = this.chaoY;
        this.repetir(c, 190, this.camadas[1], () => {
            c.fillStyle = '#95a3b8';
            c.fillRect(20, base - 150, 66, 150);
            c.fillRect(104, base - 108, 54, 108);
            c.fillStyle = '#dbeafe';
            for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) c.fillRect(30 + k * 18, base - 138 + r * 30, 11, 15);
            for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) c.fillRect(114 + k * 20, base - 96 + r * 28, 11, 14);
        });
        this.repetir(c, 300, this.camadas[2], () => {
            c.fillStyle = '#4b5563';
            c.fillRect(150, base - 78, 7, 78);
            c.fillStyle = '#9ca3af';
            c.fillRect(136, base - 84, 35, 8);
        });
    }

    cenIndustria(c) {
        const base = this.chaoY;
        this.repetir(c, 240, this.camadas[1], () => {
            c.fillStyle = '#6b7a8f';
            c.fillRect(10, base - 120, 130, 120);
            c.fillStyle = '#55647a';
            for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(10 + i * 33, base - 120); c.lineTo(26 + i * 33, base - 142); c.lineTo(43 + i * 33, base - 120); c.closePath(); c.fill(); }
            c.fillStyle = '#4b5563';
            c.fillRect(165, base - 190, 26, 190);
            c.fillStyle = 'rgba(200,210,220,0.5)';
            c.beginPath(); c.ellipse(178, base - 205, 20, 14, 0, 0, Math.PI * 2); c.fill();
        });
    }

    cenFloresta(c) {
        const base = this.chaoY;
        this.repetir(c, 170, this.camadas[1], () => {
            c.fillStyle = '#6b5638';
            c.fillRect(48, base - 74, 12, 74);
            c.fillStyle = '#4d7c3a';
            c.beginPath(); c.moveTo(54, base - 150); c.lineTo(92, base - 66); c.lineTo(16, base - 66); c.closePath(); c.fill();
            c.fillStyle = '#3f6b30';
            c.beginPath(); c.moveTo(54, base - 118); c.lineTo(100, base - 48); c.lineTo(8, base - 48); c.closePath(); c.fill();
        });
        this.repetir(c, 96, this.camadas[2], () => {
            c.fillStyle = '#8a7a4d';
            c.fillRect(30, base - 20, 22, 20);
        });
    }

    cenPosto(c) {
        const base = this.chaoY;
        this.repetir(c, 340, this.camadas[1], () => {
            c.fillStyle = '#374151';
            c.fillRect(40, base - 128, 12, 128);
            c.fillRect(190, base - 128, 12, 128);
            c.fillStyle = '#dc2626';
            c.fillRect(20, base - 148, 200, 24);
            c.fillStyle = '#f8fafc';
            c.fillRect(20, base - 128, 200, 6);
            c.fillStyle = '#94a3b8';
            c.fillRect(96, base - 56, 34, 56);
            c.fillStyle = '#fde68a';
            c.fillRect(103, base - 48, 20, 12);
        });
    }

    cenPredio(c) {
        const base = this.chaoY;
        this.repetir(c, 210, this.camadas[1], () => {
            c.fillStyle = '#57534e';
            c.fillRect(16, base - 210, 118, 210);
            for (let r = 0; r < 6; r++) for (let k = 0; k < 3; k++) {
                const aceso = (r + k) % 3 === 0;
                c.fillStyle = aceso ? '#fb923c' : '#292524';
                c.fillRect(28 + k * 34, base - 196 + r * 32, 22, 20);
            }
            c.fillStyle = 'rgba(120,113,108,0.75)';
            c.fillRect(150, base - 150, 12, 150);
        });
    }

    cenRefinaria(c) {
        const base = this.chaoY;
        this.repetir(c, 280, this.camadas[1], () => {
            c.fillStyle = '#52525b';
            c.fillRect(20, base - 96, 74, 96);
            c.beginPath(); c.ellipse(57, base - 96, 37, 13, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#3f3f46';
            c.fillRect(130, base - 200, 18, 200);
            c.fillStyle = '#f97316';
            c.beginPath(); c.moveTo(139, base - 214); c.lineTo(148, base - 196); c.lineTo(130, base - 196); c.closePath(); c.fill();
            c.strokeStyle = '#71717a'; c.lineWidth = 6;
            c.beginPath(); c.moveTo(94, base - 60); c.lineTo(130, base - 60); c.stroke();
        });
    }

    /* --- objetos --- */
    objeto(c, o) {
        c.save();
        c.translate(o.x, o.y);

        if (o.pego) {
            const p = Math.min(1, o.fase / 0.6);
            c.globalAlpha = 1 - p;
            c.translate(0, -60 * p);
            c.scale(1 + p * 0.5, 1 + p * 0.5);
        }

        c.textAlign = 'center';
        c.textBaseline = 'middle';

        if (o.tipo === 'item') {
            const flut = Math.sin(o.fase * 4) * 5;
            c.translate(0, flut);

            // brilho suave, sem contorno duro
            const g = c.createRadialGradient(0, 0, 4, 0, 0, 34);
            g.addColorStop(0,   'rgba(255, 236, 150, 0.55)');
            g.addColorStop(0.55,'rgba(250, 204, 21, 0.22)');
            g.addColorStop(1,   'rgba(250, 204, 21, 0)');
            c.fillStyle = g;
            c.beginPath(); c.arc(0, 0, 40, 0, Math.PI * 2); c.fill();

            // desenhado em vetor: grande, colorido e igual em qualquer aparelho
            c.shadowColor = 'rgba(0,0,0,0.5)';
            c.shadowBlur = 6;
            c.shadowOffsetY = 3;
            this.iconeItem(c, o.dados.id, 46);
            c.shadowBlur = 0; c.shadowOffsetY = 0;

        } else if (o.dados.id === 'fiacao') {
            // desenhada à mão: o emoji ⚡ sai sem cor em vários sistemas
            this.fiacao(c, o);

        } else {
            if (o.dados.id === 'fogo') {
                const g = c.createRadialGradient(0, 6, 3, 0, 6, o.larg * 1.1);
                g.addColorStop(0, 'rgba(255, 170, 60, 0.45)');
                g.addColorStop(1, 'rgba(239, 68, 68, 0)');
                c.fillStyle = g;
                c.beginPath(); c.ellipse(0, 6, o.larg * 1.1, o.alt * 0.85, 0, 0, Math.PI * 2); c.fill();
            } else {
                // sombra discreta no chão
                c.fillStyle = 'rgba(0,0,0,0.22)';
                c.beginPath(); c.ellipse(0, o.alt / 2 + 5, o.larg * 0.45, 6, 0, 0, Math.PI * 2); c.fill();
            }

            c.shadowColor = 'rgba(0,0,0,0.45)';
            c.shadowBlur = 6;
            c.shadowOffsetY = 3;
            // desenhado um pouco maior que a caixa de colisão: fica legível na
            // tela do celular sem endurecer o jogo
            c.save(); c.scale(1.22, 1.22);
            this.iconeObstaculo(c, o);
            c.restore();
            c.shadowBlur = 0; c.shadowOffsetY = 0;

            if (o.dados.alto) {   // sinaliza que precisa agachar
                // bem grande: reduzido para a largura de um celular, um ▼ de
                // 26px virava 10px na tela e ninguém enxergava o aviso
                c.font = 'bold 46px sans-serif';
                c.fillStyle = '#fde047';
                c.shadowColor = 'rgba(0,0,0,0.95)'; c.shadowBlur = 8;
                c.fillText('▼', 0, o.alt / 2 + 40);
                c.shadowBlur = 0;
            }
        }
        c.restore();
    }

    /* ============================================================
       ÍCONES EM VETOR
       Emoji no canvas sai como silhueta preta no Safari do iPhone quando há
       sombra aplicada — e mesmo sem sombra a cor varia de sistema para
       sistema. Desenhar à mão garante que cada item seja reconhecível e
       tenha cor própria em qualquer aparelho.
       ============================================================ */

    iconeItem(c, id, s) {
        c.save();
        c.lineJoin = 'round';
        c.lineCap = 'round';
        const traco = (cor, larg) => { c.strokeStyle = cor; c.lineWidth = larg; };

        if (id === 'extintor') {
            c.fillStyle = '#dc2626';
            this.roundRect(c, -s * 0.28, -s * 0.42, s * 0.56, s * 0.9, s * 0.16); c.fill();
            traco('#7f1d1d', s * 0.07); c.stroke();
            c.fillStyle = '#e5e7eb';
            this.roundRect(c, -s * 0.16, -s * 0.62, s * 0.32, s * 0.22, s * 0.06); c.fill();
            traco('#111827', s * 0.09);
            c.beginPath(); c.moveTo(s * 0.14, -s * 0.55); c.quadraticCurveTo(s * 0.6, -s * 0.4, s * 0.5, s * 0.05); c.stroke();
            c.fillStyle = '#fef3c7';
            this.roundRect(c, -s * 0.18, -s * 0.14, s * 0.36, s * 0.3, s * 0.05); c.fill();

        } else if (id === 'machado') {
            traco('#92400e', s * 0.16);
            c.beginPath(); c.moveTo(-s * 0.34, s * 0.6); c.lineTo(s * 0.26, -s * 0.42); c.stroke();
            c.fillStyle = '#cbd5e1';
            c.beginPath();
            c.moveTo(s * 0.16, -s * 0.58); c.quadraticCurveTo(s * 0.72, -s * 0.5, s * 0.6, s * 0.02);
            c.quadraticCurveTo(s * 0.3, -s * 0.1, s * 0.06, -s * 0.3); c.closePath(); c.fill();
            traco('#475569', s * 0.06); c.stroke();

        } else if (id === 'hidrante') {
            c.fillStyle = '#ef4444';
            this.roundRect(c, -s * 0.3, -s * 0.34, s * 0.6, s * 0.82, s * 0.14); c.fill();
            traco('#7f1d1d', s * 0.06); c.stroke();
            c.beginPath(); c.arc(0, -s * 0.4, s * 0.26, Math.PI, 0); c.fill(); c.stroke();
            c.fillStyle = '#fbbf24';
            [-1, 1].forEach(k => { c.beginPath(); c.arc(k * s * 0.34, -s * 0.02, s * 0.13, 0, Math.PI * 2); c.fill(); });
            c.fillStyle = '#7f1d1d';
            c.fillRect(-s * 0.36, s * 0.46, s * 0.72, s * 0.12);

        } else if (id === 'mangueira') {
            traco('#facc15', s * 0.19);
            c.beginPath(); c.arc(0, 0, s * 0.42, 0, Math.PI * 2); c.stroke();
            traco('#ca8a04', s * 0.06);
            c.beginPath(); c.arc(0, 0, s * 0.42, 0, Math.PI * 2); c.stroke();
            traco('#facc15', s * 0.19);
            c.beginPath(); c.moveTo(s * 0.36, s * 0.22); c.quadraticCurveTo(s * 0.7, s * 0.5, s * 0.34, s * 0.62); c.stroke();
            c.fillStyle = '#94a3b8';
            this.roundRect(c, s * 0.18, s * 0.5, s * 0.28, s * 0.2, s * 0.05); c.fill();

        } else if (id === 'capacete') {
            c.fillStyle = '#f97316';
            c.beginPath(); c.arc(0, s * 0.02, s * 0.46, Math.PI, 0); c.fill();
            traco('#9a3412', s * 0.06); c.stroke();
            c.fillStyle = '#ea580c';
            c.beginPath(); c.ellipse(0, s * 0.06, s * 0.66, s * 0.16, 0, 0, Math.PI * 2); c.fill();
            traco('#9a3412', s * 0.05); c.stroke();
            c.fillStyle = '#fff7ed';
            c.beginPath();
            c.moveTo(0, -s * 0.34); c.lineTo(s * 0.16, -s * 0.22); c.lineTo(0, -s * 0.02); c.lineTo(-s * 0.16, -s * 0.22);
            c.closePath(); c.fill();

        } else if (id === 'mascara') {
            c.fillStyle = '#e2e8f0';
            c.beginPath(); c.ellipse(0, 0, s * 0.42, s * 0.44, 0, 0, Math.PI * 2); c.fill();
            traco('#64748b', s * 0.07); c.stroke();
            c.fillStyle = '#38bdf8';
            c.beginPath(); c.ellipse(0, -s * 0.1, s * 0.26, s * 0.18, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#475569';
            c.beginPath(); c.arc(0, s * 0.26, s * 0.16, 0, Math.PI * 2); c.fill();
            traco('#334155', s * 0.08);
            c.beginPath(); c.moveTo(-s * 0.4, -s * 0.18); c.lineTo(-s * 0.62, -s * 0.3);
            c.moveTo(s * 0.4, -s * 0.18); c.lineTo(s * 0.62, -s * 0.3); c.stroke();

        } else if (id === 'radio') {
            c.fillStyle = '#1f2937';
            this.roundRect(c, -s * 0.28, -s * 0.34, s * 0.56, s * 0.86, s * 0.1); c.fill();
            traco('#0f172a', s * 0.06); c.stroke();
            c.fillStyle = '#4ade80';
            this.roundRect(c, -s * 0.17, -s * 0.24, s * 0.34, s * 0.22, s * 0.04); c.fill();
            c.fillStyle = '#94a3b8';
            for (let i = 0; i < 3; i++) c.fillRect(-s * 0.16, s * 0.06 + i * s * 0.13, s * 0.32, s * 0.06);
            traco('#111827', s * 0.09);
            c.beginPath(); c.moveTo(s * 0.16, -s * 0.34); c.lineTo(s * 0.3, -s * 0.72); c.stroke();

        } else if (id === 'lanterna') {
            c.fillStyle = '#334155';
            this.roundRect(c, -s * 0.5, -s * 0.16, s * 0.62, s * 0.32, s * 0.08); c.fill();
            c.fillStyle = '#facc15';
            c.beginPath();
            c.moveTo(s * 0.1, -s * 0.26); c.lineTo(s * 0.28, -s * 0.26);
            c.lineTo(s * 0.28, s * 0.26); c.lineTo(s * 0.1, s * 0.26); c.closePath(); c.fill();
            const g = c.createLinearGradient(s * 0.28, 0, s * 0.85, 0);
            g.addColorStop(0, 'rgba(253,224,71,0.85)');
            g.addColorStop(1, 'rgba(253,224,71,0)');
            c.fillStyle = g;
            c.beginPath(); c.moveTo(s * 0.28, -s * 0.24); c.lineTo(s * 0.85, -s * 0.5);
            c.lineTo(s * 0.85, s * 0.5); c.lineTo(s * 0.28, s * 0.24); c.closePath(); c.fill();
        }
        c.restore();
    }

    iconeObstaculo(c, o) {
        const id = o.dados.id, L = o.larg, A = o.alt;
        c.save();
        c.lineJoin = 'round'; c.lineCap = 'round';
        const traco = (cor, larg) => { c.strokeStyle = cor; c.lineWidth = larg; };

        if (id === 'fogo') {
            const osc = Math.sin(o.fase * 11) * (A * 0.06);
            const chama = (esc, cor) => {
                const h = A * esc;
                c.fillStyle = cor;
                c.beginPath();
                c.moveTo(0, A * 0.5);
                c.bezierCurveTo(-L * 0.5 * esc, A * 0.16, -L * 0.26 * esc, -h * 0.36 + osc, 0, -h * 0.62 + osc);
                c.bezierCurveTo(L * 0.26 * esc, -h * 0.36 + osc, L * 0.5 * esc, A * 0.16, 0, A * 0.5);
                c.closePath(); c.fill();
            };
            chama(1.0, '#dc2626');
            chama(0.72, '#f97316');
            chama(0.42, '#fde047');

        } else if (id === 'entulho') {
            const tijolo = (x, y, w, h) => {
                c.fillStyle = '#b45309';
                this.roundRect(c, x, y, w, h, 2); c.fill();
                traco('#78350f', 2); c.stroke();
            };
            tijolo(-L * 0.48, A * 0.06, L * 0.44, A * 0.36);
            tijolo(0, A * 0.06, L * 0.46, A * 0.36);
            tijolo(-L * 0.28, -A * 0.36, L * 0.46, A * 0.36);
            tijolo(L * 0.2, -A * 0.32, L * 0.3, A * 0.32);

        } else if (id === 'escombro') {
            const pedra = (x, y, r, cor) => {
                c.fillStyle = cor;
                c.beginPath();
                c.moveTo(x - r, y + r * 0.5); c.lineTo(x - r * 0.5, y - r * 0.7);
                c.lineTo(x + r * 0.6, y - r * 0.5); c.lineTo(x + r, y + r * 0.5);
                c.closePath(); c.fill();
                traco('#334155', 2); c.stroke();
            };
            pedra(-L * 0.24, A * 0.14, L * 0.26, '#94a3b8');
            pedra(L * 0.22, A * 0.18, L * 0.24, '#64748b');
            pedra(-L * 0.02, -A * 0.2, L * 0.24, '#cbd5e1');

        } else if (id === 'carro') {
            c.fillStyle = '#2563eb';
            this.roundRect(c, -L * 0.5, -A * 0.1, L, A * 0.5, A * 0.14); c.fill();
            traco('#1e3a8a', 2.5); c.stroke();
            c.fillStyle = '#3b82f6';
            c.beginPath();
            c.moveTo(-L * 0.28, -A * 0.1); c.lineTo(-L * 0.16, -A * 0.46);
            c.lineTo(L * 0.2, -A * 0.46); c.lineTo(L * 0.3, -A * 0.1);
            c.closePath(); c.fill(); c.stroke();
            c.fillStyle = '#bae6fd';
            c.beginPath();
            c.moveTo(-L * 0.2, -A * 0.14); c.lineTo(-L * 0.12, -A * 0.4);
            c.lineTo(L * 0.14, -A * 0.4); c.lineTo(L * 0.2, -A * 0.14);
            c.closePath(); c.fill();
            c.fillStyle = '#0f172a';
            [-L * 0.28, L * 0.28].forEach(x => { c.beginPath(); c.arc(x, A * 0.42, A * 0.16, 0, Math.PI * 2); c.fill(); });
            c.fillStyle = '#fde047';
            c.beginPath(); c.arc(L * 0.46, A * 0.1, A * 0.09, 0, Math.PI * 2); c.fill();

        } else if (id === 'barril') {
            c.fillStyle = '#ea580c';
            this.roundRect(c, -L * 0.42, -A * 0.46, L * 0.84, A * 0.92, L * 0.16); c.fill();
            traco('#7c2d12', 2.5); c.stroke();
            c.fillStyle = '#9a3412';
            c.fillRect(-L * 0.42, -A * 0.22, L * 0.84, A * 0.09);
            c.fillRect(-L * 0.42, A * 0.14, L * 0.84, A * 0.09);
            c.fillStyle = '#fef08a';
            c.beginPath();
            c.moveTo(0, -A * 0.12); c.lineTo(L * 0.16, A * 0.06);
            c.lineTo(0, A * 0.02); c.lineTo(-L * 0.1, A * 0.2);
            c.lineTo(-L * 0.02, 0); c.lineTo(-L * 0.14, -A * 0.02);
            c.closePath(); c.fill();

        } else if (id === 'fumaca') {
            const puff = (x, y, r, alpha) => {
                c.fillStyle = `rgba(148,163,184,${alpha})`;
                c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
            };
            const w = Math.sin(o.fase * 3) * (L * 0.03);
            puff(-L * 0.3 + w, A * 0.04, A * 0.42, 0.92);
            puff(-L * 0.02, -A * 0.12 + w, A * 0.5, 0.95);
            puff(L * 0.28 - w, A * 0.02, A * 0.44, 0.9);
            puff(L * 0.06, A * 0.2, A * 0.34, 0.85);
            c.fillStyle = 'rgba(226,232,240,0.85)';
            c.beginPath(); c.arc(-L * 0.08, -A * 0.2, A * 0.2, 0, Math.PI * 2); c.fill();

        } else if (id === 'viga') {
            c.fillStyle = '#78350f';
            this.roundRect(c, -L * 0.5, -A * 0.3, L, A * 0.6, 4); c.fill();
            traco('#451a03', 2.5); c.stroke();
            c.fillStyle = '#92400e';
            c.fillRect(-L * 0.5, -A * 0.3, L, A * 0.14);
            traco('#451a03', 2);
            for (let i = -2; i <= 2; i++) {
                c.beginPath(); c.moveTo(i * L * 0.18, -A * 0.16); c.lineTo(i * L * 0.18 + L * 0.05, A * 0.24); c.stroke();
            }
        }
        c.restore();
    }

    roundRect(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
    }

    /* --- o bombeiro --- */
    heroi(c) {
        const agacha = this.agachado && this.noChao;

        c.save();
        c.translate(this.heroX, this.heroY);
        if (this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0) c.globalAlpha = 0.42;

        // sombra no chão
        c.fillStyle = 'rgba(0,0,0,0.3)';
        c.beginPath(); c.ellipse(0, 3, 26, 7, 0, 0, Math.PI * 2); c.fill();

        c.scale(1, agacha ? 0.66 : 1);

        // ciclo de corrida
        const t = this.correndo;
        const noAr = !this.noChao;
        const passoA = noAr ?  0.55 : Math.sin(t);
        const passoB = noAr ? -0.35 : Math.sin(t + Math.PI);
        const balanco = noAr ? 0 : Math.abs(Math.sin(t)) * 2;   // sobe e desce do tronco

        const CASACO   = '#b45309';   // farda de aproximação
        const CASACO_S = '#7c3806';   // membros ao fundo, mais escuros
        const BRACO_F  = '#d97706';   // braço da frente, mais claro que o tronco
        const REFLET   = '#fde047';   // faixa refletiva amarelo-limão
        const PRATA    = '#e2e8f0';
        const CALCA    = '#3d4d66';   // perna da frente
        const CALCA_S  = '#22304a';   // perna de trás
        const PELE     = '#f0c49b';

        c.save();
        c.translate(0, -balanco);

        /* ---------- PERNA DE TRÁS ---------- */
        this.perna(c, -4, -32, passoB, CALCA_S, '#0b1220', REFLET);

        /* ---------- BRAÇO DE TRÁS ---------- */
        // Cada braço acompanha a perna OPOSTA (braco() já inverte o sentido
        // internamente): braço de trás usa o passo da perna de trás.
        this.braco(c, -11, -62, passoB, CASACO_S, PELE, REFLET);

        /* ---------- CILINDRO DE AR (costas) ---------- */
        c.fillStyle = '#64748b';
        c.strokeStyle = 'rgba(8,14,26,0.55)'; c.lineWidth = 1.3;
        this.arred(c, -25, -66, 11, 30, 5); c.fill(); c.stroke();
        c.fillStyle = '#94a3b8';
        this.arred(c, -23, -64, 4, 26, 2); c.fill();
        c.fillStyle = '#475569';
        c.fillRect(-25, -68, 11, 4);
        // mangueira do cilindro subindo pelo ombro
        c.strokeStyle = '#1e293b'; c.lineWidth = 2.6; c.lineCap = 'round';
        c.beginPath();
        c.moveTo(-19, -62);
        c.quadraticCurveTo(-22, -72, -12, -73);
        c.stroke();

        /* ---------- PERNA DA FRENTE ---------- */
        this.perna(c, 4, -32, passoA, CALCA, '#111827', REFLET);

        /* ---------- TRONCO / CASACO ---------- */
        c.fillStyle = CASACO;
        c.strokeStyle = 'rgba(8,14,26,0.5)'; c.lineWidth = 1.4;
        this.arred(c, -16, -68, 32, 38, 9); c.fill(); c.stroke();
        // sombreado lateral
        c.fillStyle = 'rgba(0,0,0,0.16)';
        this.arred(c, -16, -68, 9, 38, 9); c.fill();

        // faixas refletivas (prata entre duas amarelas — padrão real)
        c.fillStyle = REFLET; c.fillRect(-16, -52, 32, 3.5);
        c.fillStyle = PRATA;  c.fillRect(-16, -48.5, 32, 4);
        c.fillStyle = REFLET; c.fillRect(-16, -44.5, 32, 3.5);
        // faixa vertical no peito
        c.fillStyle = PRATA; c.fillRect(3, -68, 4.5, 16);

        // gola alta
        c.fillStyle = CASACO_S;
        this.arred(c, -16, -70, 32, 8, 4); c.fill();

        // cinto com fivela
        c.fillStyle = '#1f2937'; c.fillRect(-16, -34, 32, 5);
        c.fillStyle = '#facc15'; c.fillRect(-3, -34.5, 7, 6);

        /* ---------- CABEÇA ---------- */
        // pescoço
        c.fillStyle = '#d9a87b'; c.fillRect(-3.5, -73, 8, 7);

        // balaclava (touca de proteção) — atrás do rosto
        c.fillStyle = '#1e293b';
        c.beginPath(); c.ellipse(-1, -80, 11, 12, 0, 0, Math.PI * 2); c.fill();

        // rosto
        c.fillStyle = PELE;
        c.beginPath(); c.ellipse(2.5, -80, 9, 10.5, 0, 0, Math.PI * 2); c.fill();
        // sombreado do maxilar
        c.fillStyle = 'rgba(0,0,0,0.07)';
        c.beginPath(); c.ellipse(-1, -78, 4.5, 8, 0, 0, Math.PI * 2); c.fill();

        // sobrancelha, olho, nariz e boca
        c.strokeStyle = '#6b3410'; c.lineWidth = 1.7; c.lineCap = 'round';
        c.beginPath(); c.moveTo(4, -85.5); c.lineTo(9, -85); c.stroke();
        c.fillStyle = '#1f2937';
        c.beginPath(); c.ellipse(7, -81.5, 1.6, 2.1, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(150,90,50,0.6)'; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(10.5, -80); c.lineTo(11, -77); c.stroke();
        c.strokeStyle = 'rgba(120,60,30,0.7)'; c.lineWidth = 1.4;
        c.beginPath(); c.arc(6.5, -75, 2.8, 0.1, Math.PI - 0.7); c.stroke();

        /* ---------- CAPACETE ---------- */
        // casco
        const gc = c.createLinearGradient(-13, -100, 13, -88);
        gc.addColorStop(0, '#f05252');
        gc.addColorStop(1, '#a91b1b');
        c.fillStyle = gc;
        c.beginPath();
        c.ellipse(0.5, -89, 14, 12.5, 0, Math.PI, 0);
        c.closePath(); c.fill();

        // aba: sobe pela frente e desce longa atrás — nunca cruza o rosto
        c.fillStyle = '#a91b1b';
        c.beginPath();
        c.moveTo(-21, -86);
        c.quadraticCurveTo(-6, -92, 16, -90.5);       // borda de cima
        c.quadraticCurveTo(-4, -85.5, -21, -81.5);    // borda de baixo (traseira caída)
        c.closePath(); c.fill();
        // brilho na aba
        c.fillStyle = 'rgba(255,255,255,0.18)';
        c.beginPath();
        c.moveTo(-19, -86); c.quadraticCurveTo(-6, -91, 14, -89.8);
        c.quadraticCurveTo(-6, -88, -19, -84.6);
        c.closePath(); c.fill();

        // crista central
        c.fillStyle = '#c81e1e';
        this.arred(c, -1.4, -101.5, 3.4, 13, 1.6); c.fill();

        // brasão frontal
        c.fillStyle = '#fbbf24';
        c.beginPath();
        c.moveTo(9.5, -99); c.lineTo(14, -93); c.lineTo(9.5, -90.5); c.lineTo(5, -93);
        c.closePath(); c.fill();
        c.fillStyle = '#92400e';
        c.beginPath(); c.arc(9.5, -94.5, 1.5, 0, Math.PI * 2); c.fill();

        // faixa refletiva no casco
        c.fillStyle = 'rgba(255,255,255,0.45)';
        c.fillRect(-12, -93, 8, 2.6);

        /* ---------- MÁSCARA ERGUIDA NA TESTA ---------- */
        c.fillStyle = 'rgba(190, 222, 245, 0.42)';
        this.arred(c, -3, -95, 13, 6, 3); c.fill();
        c.strokeStyle = 'rgba(51,65,85,0.75)'; c.lineWidth = 1.4;
        this.arred(c, -3, -95, 13, 6, 3); c.stroke();

        /* ---------- BRAÇO DA FRENTE ---------- */
        // ombreira: conecta o braço ao tronco
        c.fillStyle = BRACO_F;
        c.strokeStyle = 'rgba(8,14,26,0.5)'; c.lineWidth = 1.3;
        c.beginPath(); c.arc(10, -63, 6.5, 0, Math.PI * 2); c.fill(); c.stroke();

        this.braco(c, 10, -62, passoA, BRACO_F, PELE, REFLET);

        c.restore();
        c.restore();
    }

    /* Fiação energizada solta, com faíscas */
    fiacao(c, o) {
        const L = o.larg, A = o.alt;
        const t = o.fase;

        // halo elétrico
        const g = c.createRadialGradient(0, 0, 4, 0, 0, L * 0.75);
        g.addColorStop(0, 'rgba(125, 211, 252, 0.5)');
        g.addColorStop(1, 'rgba(56, 189, 248, 0)');
        c.fillStyle = g;
        c.beginPath(); c.ellipse(0, 0, L * 0.75, A * 0.9, 0, 0, Math.PI * 2); c.fill();

        // poste/suporte
        c.strokeStyle = '#57534e'; c.lineWidth = 5; c.lineCap = 'round';
        c.beginPath(); c.moveTo(-L / 2, -A / 2 - 12); c.lineTo(-L / 2, A / 2); c.stroke();

        // cabo pendurado, balançando
        const balanco = Math.sin(t * 3) * 4;
        c.strokeStyle = '#111827'; c.lineWidth = 4.5;
        c.beginPath();
        c.moveTo(-L / 2, -A / 2 - 8);
        c.quadraticCurveTo(0, A / 2 + balanco, L / 2, -A / 2 + 4);
        c.stroke();
        // isolamento amarelo pontilhado
        c.strokeStyle = '#facc15'; c.lineWidth = 2; c.setLineDash([7, 9]);
        c.beginPath();
        c.moveTo(-L / 2, -A / 2 - 8);
        c.quadraticCurveTo(0, A / 2 + balanco, L / 2, -A / 2 + 4);
        c.stroke();
        c.setLineDash([]);

        // ponta descascada com faíscas
        const px = L / 2 - 6, py = -A / 2 + 6;
        c.fillStyle = '#e2e8f0';
        c.beginPath(); c.arc(px, py, 3.5, 0, Math.PI * 2); c.fill();

        const fase = Math.floor(t * 10) % 3;
        c.strokeStyle = '#7dd3fc';
        c.lineWidth = 2.2;
        c.shadowColor = '#38bdf8'; c.shadowBlur = 10;
        for (let i = 0; i < 3; i++) {
            const ang = (i * 2.1) + fase * 0.9;
            const r1 = 5, r2 = 13 + (i === fase ? 5 : 0);
            c.beginPath();
            c.moveTo(px + Math.cos(ang) * r1, py + Math.sin(ang) * r1);
            c.lineTo(px + Math.cos(ang + 0.3) * (r1 + r2) / 2, py + Math.sin(ang + 0.3) * (r1 + r2) / 2);
            c.lineTo(px + Math.cos(ang) * r2, py + Math.sin(ang) * r2);
            c.stroke();
        }
        c.shadowBlur = 0;

        // aviso de agachar
        c.font = 'bold 46px sans-serif';
        c.fillStyle = '#fde047';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.shadowColor = 'rgba(0,0,0,0.95)'; c.shadowBlur = 8;
        c.fillText('▼', 0, A / 2 + 40);
        c.shadowBlur = 0;
    }

    /* Perna com coxa, canela e bota, articulada pelo passo (-1..1) */
    perna(c, x, quadril, passo, corCalca, corBota, refletivo) {
        c.save();
        c.translate(x, quadril);
        c.rotate(passo * 0.5);

        c.strokeStyle = 'rgba(8,14,26,0.55)';
        c.lineWidth = 1.4;

        c.fillStyle = corCalca;
        this.arred(c, -5.5, 0, 11, 20, 4); c.fill(); c.stroke();   // coxa

        c.translate(0, 19);
        c.rotate(Math.max(0, -passo) * 0.75);                       // joelho dobra ao recuar

        c.fillStyle = corCalca;
        this.arred(c, -5, 0, 10, 17, 3.5); c.fill(); c.stroke();    // canela
        c.fillStyle = refletivo;
        c.fillRect(-5, 7, 10, 3.2);                                 // faixa na canela

        c.fillStyle = corBota;                                      // bota
        this.arred(c, -6.5, 15, 15, 7, 3); c.fill(); c.stroke();

        c.restore();
    }

    /* Braço com manga, faixa refletiva, luva e balanço.
       O personagem corre para a DIREITA (+x = frente).
       Um segmento apontado para baixo (0,1) girado por θ vai para x' = -sen(θ):
         θ < 0  → segmento vai para a FRENTE
         θ > 0  → segmento vai para TRÁS
       Por isso o cotovelo precisa de ângulo NEGATIVO: o antebraço só dobra
       para a frente, em direção ao peito — nunca para trás. */
    braco(c, x, ombro, passo, corManga, corPele, refletivo) {
        c.save();
        c.translate(x, ombro);
        c.rotate(-passo * 0.7);                    // ombro: passo>0 leva o braço à frente

        c.strokeStyle = 'rgba(8,14,26,0.6)';
        c.lineWidth = 1.5;

        c.fillStyle = corManga;
        this.arred(c, -4.8, 0, 9.6, 17, 4.2); c.fill(); c.stroke();  // braço (ombro→cotovelo)
        c.fillStyle = refletivo;
        c.fillRect(-4.8, 11, 9.6, 3);

        // cotovelo: dobra sempre à frente (nunca inverte); em corrida fica
        // permanentemente fechado, apertando mais quando o braço avança
        c.translate(0, 16);
        const dobra = 0.95 + passo * 0.4;        // ~0.55 a ~1.35 rad
        c.rotate(-dobra);

        c.fillStyle = corManga;
        this.arred(c, -4.3, 0, 8.6, 14, 3.6); c.fill(); c.stroke();  // antebraço

        c.fillStyle = '#0f172a';                                     // luva
        c.beginPath(); c.arc(0, 15, 4.8, 0, Math.PI * 2); c.fill(); c.stroke();

        c.restore();
    }

    arred(c, x, y, w, h, r) {
        c.beginPath();
        c.moveTo(x + r, y);
        c.arcTo(x + w, y, x + w, y + h, r);
        c.arcTo(x + w, y + h, x, y + h, r);
        c.arcTo(x, y + h, x, y, r);
        c.arcTo(x, y, x + w, y, r);
        c.closePath();
    }
}
