/**
 * Registro de participantes — Bombeiro Herói
 * Mesma planilha "Treinamentos incrições" dos demais treinamentos.
 * www.horadaseguranca.com
 */

const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbw77Qz-viys5Kd0qg6fHqGqz5sm4Pay2vJDOGmT89FdZI8BLh3hXOVwj4lfYEJx18Axvw/exec';
const NOME_TREINAMENTO = 'Bombeiro Herói';

function isEmailValido(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim());
}

class RegistroParticipante {
    constructor() { this.atual = null; }

    inscrever(nome, email, empresa) {
        this.atual = {
            nome: String(nome || '').trim(),
            email: String(email || '').trim(),
            empresa: String(empresa || '').trim() || 'Não informada'
        };
        this.enviar({ etapa: 'Inscrição' });
        return this.atual;
    }

    concluir(pontuacao, resultado) {
        if (!this.atual) return;
        this.enviar({ etapa: 'Conclusão', pontuacao, resultado });
    }

    enviar(extra) {
        if (!GOOGLE_SHEETS_URL || !this.atual) return;
        try {
            fetch(GOOGLE_SHEETS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nome: this.atual.nome,
                    email: this.atual.email,
                    data: new Date().toLocaleDateString('pt-BR'),
                    treinamento: NOME_TREINAMENTO,
                    modo: this.atual.empresa,
                    etapa: extra.etapa || '',
                    pontuacao: extra.pontuacao != null ? extra.pontuacao : '',
                    resultado: extra.resultado || ''
                })
            }).catch(e => console.warn('Falha ao registrar:', e));
        } catch (e) {
            console.warn('Falha ao registrar:', e);
        }
    }
}

const registro = new RegistroParticipante();
