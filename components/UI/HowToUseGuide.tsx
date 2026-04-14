'use client';

export default function HowToUseGuide() {
  const steps = [
    {
      num: '1',
      title: 'Escanear o Mercado',
      desc: 'Nosso robô fiscaliza as moedas para você. Quando uma moeda se aproxima de máximas ou mínimas antigas (onde o dinheiro está), o alarme dispara.',
      icon: '🔎',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    },
    {
      num: '2',
      title: 'Aguardar a "Armadilha"',
      desc: 'Os grandes players adoram romper falsamente essas máximas (Sweep) para pegar o dinheiro dos iniciantes. Nós esperamos eles fazerem isso no gráfico.',
      icon: '🪤',
      color: 'text-amber-500',
      bg: 'bg-amber-500/10'
    },
    {
      num: '3',
      title: 'Validar a Entrada',
      desc: 'Use o Formulário Analisador abaixo para checar se o mercado te deu um sinal claro de reversão após a armadilha. Responda sim ou não.',
      icon: '✅',
      color: 'text-green-500',
      bg: 'bg-green-500/10'
    },
    {
      num: '4',
      title: 'Lucrar com os Grandes',
      desc: 'Se a nota for boa, você entra junto com o "Smart Money" (dinheiro inteligente), e evita ser engolido pelo mercado.',
      icon: '💰',
      color: 'text-purple-500',
      bg: 'bg-purple-500/10'
    },
  ];

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold mb-2 text-primary">Para Iniciantes: Como Operar com a Gente</h2>
      <p className="text-secondary mb-6 leading-relaxed max-w-3xl">
        Esqueça os gráficos confusos cheios de linhas. O mercado financeiro é um jogo de "roubar bandeira". Os institucionais manipulam o preço para liquidar pequenos traders antes de mover o mercado de verdade. <strong className="text-primary">Este painel te ajuda a surfar nessa onda em vez de ser engolido por ela.</strong>
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((step) => (
          <div
            key={step.num}
            className="card p-5 flex flex-col items-start gap-3 hover:-translate-y-1 transition-transform cursor-default"
          >
            <div className={`p-3 rounded-full ${step.bg} ${step.color} text-2xl`}>
              {step.icon}
            </div>
            <h3 className="font-semibold text-primary text-lg">
              Passo {step.num}: {step.title}
            </h3>
            <p className="text-sm text-secondary leading-relaxed">
              {step.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
