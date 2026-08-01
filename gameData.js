/**
 * Dados do jogo — Bombeiro Herói
 * www.horadaseguranca.com
 */

function embaralhar(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/* ============================================================
   ITENS PARA COLETAR (equipamentos de combate a incêndio)
   ============================================================ */
const ITENS = [
    { id: 'extintor',  nome: 'Extintor',            icone: '🧯', pontos: 20, dica: 'Primeiro equipamento de combate a princípios de incêndio.' },
    { id: 'machado',   nome: 'Machado',             icone: '🪓', pontos: 20, dica: 'Usado para arrombamento e abertura de rotas de fuga.' },
    { id: 'hidrante',  nome: 'Hidrante',            icone: '🚰', pontos: 25, dica: 'Fonte de água pressurizada para o combate prolongado.' },
    { id: 'mangueira', nome: 'Mangueira',           icone: '🧵', pontos: 20, dica: 'Conduz a água do hidrante até o foco do incêndio.' },
    { id: 'capacete',  nome: 'Capacete',            icone: '⛑️', pontos: 15, dica: 'EPI obrigatório: protege contra impacto e calor radiante.' },
    { id: 'mascara',   nome: 'Máscara autônoma',    icone: '😷', pontos: 25, dica: 'Protege as vias respiratórias da fumaça e de gases tóxicos.' },
    { id: 'radio',     nome: 'Rádio comunicador',   icone: '📻', pontos: 15, dica: 'Comunicação com a equipe é vital durante a operação.' },
    { id: 'lanterna',  nome: 'Lanterna',            icone: '🔦', pontos: 15, dica: 'Ambientes com fumaça densa têm visibilidade quase nula.' }
];

/* ============================================================
   OBSTÁCULOS (perigos a desviar)
   alto = true  → precisa AGACHAR
   alto = false → precisa PULAR
   ============================================================ */
const OBSTACULOS = [
    { id: 'fogo',     nome: 'Foco de incêndio',   icone: '🔥', alto: false, larg: 46, alt: 54 },
    { id: 'entulho',  nome: 'Entulho',            icone: '🧱', alto: false, larg: 54, alt: 40 },
    { id: 'escombro', nome: 'Escombros',          icone: '🪨', alto: false, larg: 58, alt: 46 },
    { id: 'carro',    nome: 'Veículo desgovernado', icone: '🚗', alto: false, larg: 74, alt: 50 },
    { id: 'barril',   nome: 'Barril inflamável',  icone: '🛢️', alto: false, larg: 44, alt: 56 },
    { id: 'fiacao',   nome: 'Fiação energizada',  icone: '⚡', alto: true,  larg: 90, alt: 44 },
    { id: 'fumaca',   nome: 'Nuvem de fumaça',    icone: '💨', alto: true,  larg: 96, alt: 48 },
    { id: 'viga',     nome: 'Viga caída',         icone: '🪵', alto: true,  larg: 88, alt: 42 }
];

/* ============================================================
   6 FASES — cada uma com cenário e ritmo próprios
   ============================================================ */
const FASES = [
    {
        n: 1,
        nome: 'Rua Residencial',
        subtitulo: 'Princípio de incêndio em residência',
        cenario: 'cidade',
        duracao: 40,
        velocidade: 250,
        intervalo: [1.15, 1.6],
        obstaculos: ['fogo', 'entulho', 'fiacao'],
        ceu: ['#7ec8f0', '#cfe9f7'],
        chao: '#6b7280',
        briefing: 'Fumaça saindo de uma residência. Corra até o local recolhendo equipamento pelo caminho.'
    },
    {
        n: 2,
        nome: 'Galpão Industrial',
        subtitulo: 'Incêndio em depósito de materiais',
        cenario: 'industria',
        duracao: 40,
        velocidade: 290,
        intervalo: [1.05, 1.45],
        obstaculos: ['fogo', 'entulho', 'barril', 'fiacao', 'viga'],
        ceu: ['#5c7ea3', '#9fb6cb'],
        chao: '#4b5563',
        briefing: 'Depósito com material combustível empilhado. Cuidado com os barris e a fiação exposta.'
    },
    {
        n: 3,
        nome: 'Mata Seca',
        subtitulo: 'Incêndio florestal em propagação',
        cenario: 'floresta',
        duracao: 40,
        velocidade: 330,
        intervalo: [0.95, 1.32],
        obstaculos: ['fogo', 'escombro', 'fumaca', 'viga'],
        ceu: ['#e8a45c', '#f6d9a8'],
        chao: '#7c6242',
        briefing: 'O fogo avança pela vegetação seca. A fumaça reduz a visibilidade — abaixe-se quando necessário.'
    },
    {
        n: 4,
        nome: 'Posto de Combustível',
        subtitulo: 'Vazamento com risco de explosão',
        cenario: 'posto',
        duracao: 40,
        velocidade: 370,
        intervalo: [0.88, 1.2],
        obstaculos: ['fogo', 'barril', 'carro', 'fiacao', 'fumaca'],
        ceu: ['#1e3a5f', '#3f6b96'],
        chao: '#374151',
        briefing: 'Vazamento de combustível à noite. Qualquer fonte de ignição pode causar explosão.'
    },
    {
        n: 5,
        nome: 'Edifício em Chamas',
        subtitulo: 'Resgate em altura',
        cenario: 'predio',
        duracao: 40,
        velocidade: 410,
        intervalo: [0.8, 1.1],
        obstaculos: ['fogo', 'escombro', 'viga', 'fiacao', 'entulho'],
        ceu: ['#7a2d1e', '#c96a3f'],
        chao: '#57534e',
        briefing: 'Estrutura comprometida e vítimas nos andares superiores. Atenção às vigas que despencam.'
    },
    {
        n: 6,
        nome: 'Refinaria',
        subtitulo: 'Emergência classe máxima',
        cenario: 'refinaria',
        duracao: 40,
        velocidade: 455,
        intervalo: [0.72, 1.0],
        obstaculos: ['fogo', 'barril', 'carro', 'fiacao', 'fumaca', 'viga', 'escombro'],
        ceu: ['#2b1436', '#7b3560'],
        chao: '#3f3f46',
        briefing: 'Missão final. Unidade de processo em chamas, com risco de propagação para os tanques.'
    }
];

/* ============================================================
   QUIZ ENTRE FASES — arrastar e soltar
   ============================================================ */
const QUIZZES = [
    {
        titulo: 'Classes de incêndio',
        enunciado: 'Arraste cada material para a classe de incêndio correspondente.',
        categorias: [
            { id: 'A', nome: 'Classe A', desc: 'Sólidos comuns' },
            { id: 'B', nome: 'Classe B', desc: 'Líquidos inflamáveis' },
            { id: 'C', nome: 'Classe C', desc: 'Equipamento energizado' }
        ],
        itens: [
            { id: 'q1a', rotulo: 'Madeira e papel',      icone: '🪵', cat: 'A' },
            { id: 'q1b', rotulo: 'Gasolina',             icone: '⛽', cat: 'B' },
            { id: 'q1c', rotulo: 'Painel elétrico',      icone: '🔌', cat: 'C' },
            { id: 'q1d', rotulo: 'Tecido e estofado',    icone: '🛋️', cat: 'A' },
            { id: 'q1e', rotulo: 'Óleo lubrificante',    icone: '🛢️', cat: 'B' },
            { id: 'q1f', rotulo: 'Motor energizado',     icone: '⚙️', cat: 'C' }
        ]
    },
    {
        titulo: 'Agente extintor correto',
        enunciado: 'Arraste cada situação para o agente extintor adequado.',
        categorias: [
            { id: 'agua', nome: 'Água',       desc: 'Resfriamento' },
            { id: 'po',   nome: 'Pó químico', desc: 'Abafamento' },
            { id: 'co2',  nome: 'CO₂',        desc: 'Sem resíduo' }
        ],
        itens: [
            { id: 'q2a', rotulo: 'Pilha de papelão',       icone: '📦', cat: 'agua' },
            { id: 'q2b', rotulo: 'Poça de solvente',       icone: '🧪', cat: 'po' },
            { id: 'q2c', rotulo: 'Rack de servidores',     icone: '🖥️', cat: 'co2' },
            { id: 'q2d', rotulo: 'Colchão em brasa',       icone: '🛏️', cat: 'agua' },
            { id: 'q2e', rotulo: 'Tanque de combustível',  icone: '⛽', cat: 'po' },
            { id: 'q2f', rotulo: 'Quadro de comando',      icone: '🎛️', cat: 'co2' }
        ]
    },
    {
        titulo: 'EPI do bombeiro',
        enunciado: 'Arraste cada equipamento para a parte do corpo que ele protege.',
        categorias: [
            { id: 'cabeca', nome: 'Cabeça',     desc: 'Crânio e face' },
            { id: 'resp',   nome: 'Respiração', desc: 'Vias aéreas' },
            { id: 'corpo',  nome: 'Corpo',      desc: 'Tronco e membros' }
        ],
        itens: [
            { id: 'q3a', rotulo: 'Capacete',            icone: '⛑️', cat: 'cabeca' },
            { id: 'q3b', rotulo: 'Máscara autônoma',    icone: '😷', cat: 'resp' },
            { id: 'q3c', rotulo: 'Roupa de aproximação', icone: '🧥', cat: 'corpo' },
            { id: 'q3d', rotulo: 'Balaclava',           icone: '🧣', cat: 'cabeca' },
            { id: 'q3e', rotulo: 'Cilindro de ar',      icone: '🛢️', cat: 'resp' },
            { id: 'q3f', rotulo: 'Luva de raspa',       icone: '🧤', cat: 'corpo' }
        ]
    },
    {
        titulo: 'Ordem do atendimento',
        enunciado: 'Arraste cada ação para o momento correto do atendimento.',
        categorias: [
            { id: 'antes',  nome: '1º Ao chegar',   desc: 'Avaliação' },
            { id: 'durante', nome: '2º No combate',  desc: 'Ação' },
            { id: 'depois', nome: '3º Após o fogo', desc: 'Rescaldo' }
        ],
        itens: [
            { id: 'q4a', rotulo: 'Isolar a área',           icone: '🚧', cat: 'antes' },
            { id: 'q4b', rotulo: 'Atacar o foco',           icone: '🧯', cat: 'durante' },
            { id: 'q4c', rotulo: 'Verificar focos ocultos', icone: '🔎', cat: 'depois' },
            { id: 'q4d', rotulo: 'Avaliar riscos no local', icone: '👀', cat: 'antes' },
            { id: 'q4e', rotulo: 'Resgatar vítimas',        icone: '🧑‍🚒', cat: 'durante' },
            { id: 'q4f', rotulo: 'Preservar o local',       icone: '📋', cat: 'depois' }
        ]
    },
    {
        titulo: 'Triângulo do fogo',
        enunciado: 'Arraste cada método de extinção para o elemento que ele elimina.',
        categorias: [
            { id: 'calor',  nome: 'Calor',       desc: 'Resfriamento' },
            { id: 'oxig',   nome: 'Oxigênio',    desc: 'Abafamento' },
            { id: 'comb',   nome: 'Combustível', desc: 'Isolamento' }
        ],
        itens: [
            { id: 'q5a', rotulo: 'Jato de água',            icone: '💧', cat: 'calor' },
            { id: 'q5b', rotulo: 'Manta de abafamento',     icone: '🧣', cat: 'oxig' },
            { id: 'q5c', rotulo: 'Retirar material vizinho', icone: '📦', cat: 'comb' },
            { id: 'q5d', rotulo: 'Neblina d’água',      icone: '🌫️', cat: 'calor' },
            { id: 'q5e', rotulo: 'Espuma mecânica',         icone: '🫧', cat: 'oxig' },
            { id: 'q5f', rotulo: 'Fechar a válvula de gás', icone: '🔧', cat: 'comb' }
        ]
    }
];

/* ============================================================
   ESPAÇO PUBLICITÁRIO
   Para vender a cota, basta trocar os dados abaixo pelos do
   anunciante (ou acrescentar novos objetos ao array).
   ============================================================ */
const ANUNCIOS = [
    {
        id: 'demo-proseg',
        demonstracao: true,
        marca: 'ProSeg Soluções',
        iniciais: 'PS',
        segmento: 'Revenda de EPI e equipamentos de combate a incêndio',
        tagline: 'O equipamento certo, na hora certa.',
        claim: 'Linha completa de extintores, mangueiras, EPIs e sinalização de emergência com laudo e ART.',
        beneficios: ['Recarga e teste hidrostático', 'Projeto e AVCB', 'Entrega em todo o Brasil'],
        cta: 'Conhecer a ProSeg',
        url: 'https://www.horadaseguranca.com',
        cor1: '#c2410c',
        cor2: '#7c2d12',
        cor3: '#fb923c'
    }
];
