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

        if (o.tipo === 'item') {
            const flut = Math.sin(o.fase * 4) * 5;
            c.translate(0, flut);
            c.fillStyle = 'rgba(250, 204, 21, 0.28)';
            c.beginPath(); c.arc(0, 0, 27, 0, Math.PI * 2); c.fill();
            c.strokeStyle = 'rgba(250, 204, 21, 0.85)'; c.lineWidth = 2.5;
            c.beginPath(); c.arc(0, 0, 27, 0, Math.PI * 2); c.stroke();
            c.font = '30px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText(o.dados.icone, 0, 1);
        } else {
            if (o.dados.id === 'fogo') {
                const f = Math.sin(o.fase * 12) * 3;
                c.fillStyle = 'rgba(239,68,68,0.35)';
                c.beginPath(); c.ellipse(0, 6, o.larg * 0.7, o.alt * 0.6, 0, 0, Math.PI * 2); c.fill();
                c.font = `${o.alt + f}px serif`;
            } else {
                c.fillStyle = 'rgba(0,0,0,0.2)';
                c.beginPath(); c.ellipse(0, o.alt / 2 + 4, o.larg * 0.5, 7, 0, 0, Math.PI * 2); c.fill();
                c.font = `${o.alt}px serif`;
            }
            c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText(o.dados.icone, 0, 0);

            if (o.dados.alto) {   // sinaliza que precisa agachar
                c.font = 'bold 15px sans-serif';
                c.fillStyle = '#fde047';
                c.fillText('▼', 0, o.alt / 2 + 18);
            }
        }
        c.restore();
    }

    /* --- o bombeiro --- */
    heroi(c) {
        const x = this.heroX;
        const y = this.heroY;
        const agacha = this.agachado && this.noChao;

        c.save();
        c.translate(x, y);
        if (this.invuln > 0 && Math.floor(this.invuln * 12) % 2 === 0) c.globalAlpha = 0.4;

        // sombra
        c.fillStyle = 'rgba(0,0,0,0.28)';
        c.beginPath(); c.ellipse(0, 4, 24, 7, 0, 0, Math.PI * 2); c.fill();

        const esc = agacha ? 0.62 : 1;
        c.scale(1, esc);

        const passo = Math.sin(this.correndo) * (this.noChao ? 1 : 0.25);

        // pernas (calça escura + faixa refletiva)
        c.fillStyle = '#1f2937';
        c.fillRect(-13, -26, 11, 26 + passo * 5);
        c.fillRect(3, -26, 11, 26 - passo * 5);
        c.fillStyle = '#fbbf24';
        c.fillRect(-13, -12, 11, 4);
        c.fillRect(3, -12, 11, 4);

        // botas
        c.fillStyle = '#111827';
        c.fillRect(-15, -3 + passo * 5, 14, 5);
        c.fillRect(2, -3 - passo * 5, 14, 5);

        // casaco
        c.fillStyle = '#c2410c';
        this.arred(c, -17, -60, 34, 36, 7); c.fill();
        // faixas refletivas
        c.fillStyle = '#fde68a';
        c.fillRect(-17, -46, 34, 5);
        c.fillRect(-17, -35, 34, 5);
        // gola
        c.fillStyle = '#9a3412';
        c.fillRect(-17, -60, 34, 6);

        // cilindro nas costas
        c.fillStyle = '#475569';
        this.arred(c, -25, -56, 9, 26, 4); c.fill();

        // braço
        c.fillStyle = '#9a3412';
        c.fillRect(12, -56, 9, 22 + passo * 4);
        c.fillStyle = '#fde68a';
        c.fillRect(12, -42, 9, 4);

        // cabeça
        c.fillStyle = '#f5c9a4';
        c.beginPath(); c.arc(0, -70, 11, 0, Math.PI * 2); c.fill();

        // capacete de bombeiro
        c.fillStyle = '#dc2626';
        c.beginPath(); c.arc(0, -73, 13, Math.PI, 0); c.fill();
        c.fillRect(-15, -74, 30, 5);            // aba frontal
        c.fillStyle = '#b91c1c';
        c.fillRect(-17, -74, 6, 5);             // aba traseira alongada
        c.fillStyle = '#fde68a';                 // brasão
        c.beginPath(); c.moveTo(0, -84); c.lineTo(4, -77); c.lineTo(-4, -77); c.closePath(); c.fill();

        // viseira
        c.fillStyle = 'rgba(148, 163, 184, 0.6)';
        c.fillRect(-11, -71, 22, 5);

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
