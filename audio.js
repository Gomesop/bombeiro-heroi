/**
 * Efeitos sonoros — Bombeiro Herói (Web Audio API)
 * www.horadaseguranca.com
 */

class SonsBombeiro {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (this.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
    }

    tocar(freqs, dur = 0.16, tipo = 'square', vol = 0.07) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        try {
            const t0 = this.ctx.currentTime;
            freqs.forEach((f, i) => {
                const osc = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                osc.type = tipo;
                osc.frequency.setValueAtTime(f, t0 + i * dur * 0.6);
                g.gain.setValueAtTime(vol, t0 + i * dur * 0.6);
                g.gain.exponentialRampToValueAtTime(0.0008, t0 + i * dur * 0.6 + dur);
                osc.connect(g); g.connect(this.ctx.destination);
                osc.start(t0 + i * dur * 0.6);
                osc.stop(t0 + i * dur * 0.6 + dur);
            });
        } catch (e) {}
    }

    ruido(dur = 0.22, vol = 0.09) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        try {
            const n = Math.floor(this.ctx.sampleRate * dur);
            const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
            const src = this.ctx.createBufferSource();
            const g = this.ctx.createGain();
            const filtro = this.ctx.createBiquadFilter();
            filtro.type = 'lowpass'; filtro.frequency.value = 900;
            g.gain.setValueAtTime(vol, this.ctx.currentTime);
            src.buffer = buf;
            src.connect(filtro); filtro.connect(g); g.connect(this.ctx.destination);
            src.start();
        } catch (e) {}
    }

    pulo()    { this.tocar([420, 660], 0.1, 'square', 0.05); }
    coleta()  { this.tocar([780, 1040, 1310], 0.09, 'triangle', 0.06); }
    batida()  { this.ruido(0.3, 0.11); this.tocar([160, 110], 0.18, 'sawtooth', 0.07); }
    clique()  { this.tocar([520], 0.06, 'square', 0.04); }
    acerto()  { this.tocar([660, 880, 1180], 0.12, 'triangle', 0.06); }
    erro()    { this.tocar([220, 165], 0.16, 'sawtooth', 0.06); }
    faseOk()  { this.tocar([523, 659, 784, 1046], 0.14, 'triangle', 0.07); }
    vitoria() { this.tocar([523, 659, 784, 1046, 1318], 0.17, 'triangle', 0.08); }
    derrota() { this.tocar([392, 330, 262, 196], 0.2, 'sawtooth', 0.07); }
}

const sons = new SonsBombeiro();
