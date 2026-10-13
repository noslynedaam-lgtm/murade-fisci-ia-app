import React from 'react';

interface SimboloContabilProps {
  tamanho?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  comBrilho?: boolean;
}

/**
 * 🏛️ SÍMBOLO CONTÁBIL OFICIAL (Colunas + Cobra/Caduceu + Cifrão)
 * Identidade visual da Contabilidade com acabamento Dourado (#D4AF37),
 * Fundo Azul MURADE (#0F2B5B / #0A1628), perspectiva 3D e brilho animado.
 */
export default function SimboloContabil({
  tamanho = 'md',
  className = '',
  comBrilho = true,
}: SimboloContabilProps) {
  const dimensoes = {
    sm: { container: 'w-8 h-8 rounded-lg', iconSize: 20 },
    md: { container: 'w-10 h-10 sm:w-11 sm:h-11 rounded-xl', iconSize: 26 },
    lg: { container: 'w-14 h-14 rounded-2xl', iconSize: 34 },
    xl: { container: 'w-16 h-16 sm:w-20 sm:h-20 rounded-3xl', iconSize: 48 },
  }[tamanho];

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden select-none transition-transform duration-300 hover:scale-105 ${dimensoes.container} ${className}`}
      style={{
        background: 'linear-gradient(135deg, #0F2B5B 0%, #1A3A70 50%, #0A1628 100%)',
        border: '1px solid rgba(212, 175, 55, 0.4)',
        boxShadow: '0 0 20px rgba(212, 175, 55, 0.3), 0 8px 24px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
        transform: 'perspective(400px) rotateX(4deg)',
      }}
      title="Símbolo Contábil Oficial — Murade Fisco IA"
    >
      {/* Luz animada passando suavemente pelo símbolo */}
      {comBrilho && (
        <div
          className="absolute inset-0 pointer-events-none -translate-x-full animate-[shimmer_3.5s_infinite_linear]"
          style={{
            background:
              'linear-gradient(60deg, transparent 30%, rgba(242, 210, 110, 0.25) 50%, transparent 70%)',
          }}
        />
      )}

      {/* SVG Exclusivo: Colunas Clássicas Contábeis + Serpente (Caduceu Contábil) + Cifrão Central */}
      <svg
        width={dimensoes.iconSize}
        height={dimensoes.iconSize}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
      >
        <defs>
          {/* Gradiente Dourado Contábil Realista */}
          <linearGradient id="ouroContabilGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF2A3" />
            <stop offset="25%" stopColor="#F2D26E" />
            <stop offset="55%" stopColor="#D4AF37" />
            <stop offset="85%" stopColor="#AA820A" />
            <stop offset="100%" stopColor="#E5C158" />
          </linearGradient>

          {/* Gradiente Metálico para as Colunas */}
          <linearGradient id="colunaOuroGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFF5BA" />
            <stop offset="50%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#996E00" />
          </linearGradient>
        </defs>

        {/* 1. FRONTÃO / CAPITEL SUPERIOR (Templo da Ciência Contábil) */}
        <path
          d="M10 14L32 6L54 14H10Z"
          fill="url(#ouroContabilGrad)"
          stroke="#5C4300"
          strokeWidth="0.8"
        />
        {/* Friso horizontal sob o frontão */}
        <rect
          x="8"
          y="14"
          width="48"
          height="3"
          rx="1"
          fill="url(#ouroContabilGrad)"
        />

        {/* 2. COLUNAS CONTÁBEIS (Estrutura do Patrimônio e Livros Fiscais) */}
        {/* Coluna Esquerda */}
        <rect x="13" y="18" width="5" height="28" rx="1" fill="url(#colunaOuroGrad)" />
        <rect x="12" y="17" width="7" height="2" rx="0.5" fill="#FFE58F" />
        <rect x="12" y="45" width="7" height="2" rx="0.5" fill="#C99700" />

        {/* Coluna Central-Esquerda */}
        <rect x="23" y="18" width="4.5" height="28" rx="0.8" fill="url(#colunaOuroGrad)" opacity="0.9" />

        {/* Coluna Central-Direita */}
        <rect x="36.5" y="18" width="4.5" height="28" rx="0.8" fill="url(#colunaOuroGrad)" opacity="0.9" />

        {/* Coluna Direita */}
        <rect x="46" y="18" width="5" height="28" rx="1" fill="url(#colunaOuroGrad)" />
        <rect x="45" y="17" width="7" height="2" rx="0.5" fill="#FFE58F" />
        <rect x="45" y="45" width="7" height="2" rx="0.5" fill="#C99700" />

        {/* 3. BASE DO TEMPLO (Estabilidade Contábil) */}
        <rect x="8" y="47" width="48" height="3" rx="1" fill="url(#ouroContabilGrad)" />
        <rect x="6" y="50" width="52" height="4" rx="1.5" fill="url(#ouroContabilGrad)" stroke="#5C4300" strokeWidth="0.8" />

        {/* 4. A SERPENTE DO CADUCEU CONTÁBIL (Sabedoria & Vara de Mercúrio entrelaçada) */}
        {/* Corpo da serpente sinuoso cruzando o centro */}
        <path
          d="M32 18 C37 20, 37 24, 32 26 C27 28, 27 33, 32 35 C37 37, 37 42, 32 44"
          stroke="url(#ouroContabilGrad)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Cabeça da serpente voltada para cima */}
        <circle cx="32" cy="18" r="2.2" fill="#FFE58F" stroke="#AA820A" strokeWidth="0.8" />
        {/* Olho da serpente */}
        <circle cx="32.5" cy="17.5" r="0.6" fill="#0A1628" />

        {/* 5. SÍMBOLO MONETÁRIO / CIFRÃO CENTRAL EMBLEMÁTICO */}
        {/* Medalhão sutil de fundo para o Cifrão */}
        <circle cx="32" cy="31" r="7.5" fill="#0F2B5B" stroke="url(#ouroContabilGrad)" strokeWidth="1.2" />
        {/* Letra S / Cifrão Contábil */}
        <text
          x="32"
          y="35"
          textAnchor="middle"
          fontSize="11"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill="url(#ouroContabilGrad)"
        >
          $
        </text>
      </svg>
    </div>
  );
}
