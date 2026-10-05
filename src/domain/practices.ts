/** Интерактивные практики, которые проигрываются в приложении. */

export type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'rest';

export interface BreathingPractice {
  id: string;
  mode: 'breathing';
  title: string;
  subtitle: string;
  image: string;
  /** длительности фаз в секундах; 0 — фаза пропускается */
  pattern: Record<BreathPhase, number>;
  cycles: number;
  intro: string;
}

export interface StepsPractice {
  id: string;
  mode: 'steps';
  title: string;
  subtitle: string;
  image: string;
  stepSec: number;
  steps: string[];
  intro: string;
}

export type Practice = BreathingPractice | StepsPractice;

export const PRACTICES: Record<string, Practice> = {
  breath478: {
    id: 'breath478',
    mode: 'breathing',
    title: 'Дыхание 4-7-8',
    subtitle: 'Техника №1 из гайда',
    image: 'purple-lake',
    pattern: { inhale: 4, hold: 7, exhale: 8, rest: 0 },
    cycles: 4,
    intro: 'Следуйте за сферой: она растёт на вдохе, замирает на задержке и мягко сжимается на выдохе.',
  },
  harbor: {
    id: 'harbor',
    mode: 'breathing',
    title: 'Тихая гавань',
    subtitle: 'Квадратное дыхание',
    image: 'purple-lake',
    pattern: { inhale: 4, hold: 4, exhale: 4, rest: 4 },
    cycles: 11,
    intro: 'Четыре равные фазы — как четыре стороны квадрата. Дышите носом, плечи расслаблены.',
  },
  bodyscan: {
    id: 'bodyscan',
    mode: 'steps',
    title: 'Сканирование тела',
    subtitle: 'Практика осознанности',
    image: 'beach',
    stepSec: 20,
    intro: 'Устройтесь удобно. Ничего не нужно менять — только замечать.',
    steps: [
      'Закройте глаза и сделайте три спокойных вдоха.',
      'Почувствуйте точки опоры: стопы, спину, ладони.',
      'Перенесите внимание на пальцы ног. Тепло, холод, покалывание?',
      'Поднимитесь к стопам и голеням. Просто замечайте.',
      'Колени и бёдра. Если есть напряжение — подышите в него.',
      'Живот: как он поднимается и опускается с дыханием.',
      'Грудь и сердцебиение. Без оценок.',
      'Плечи. Позвольте им опуститься чуть ниже.',
      'Руки — от плеч до кончиков пальцев.',
      'Шея и челюсть. Разомкните зубы, расслабьте язык.',
      'Лицо: лоб, глаза, мышцы вокруг рта.',
      'Почувствуйте тело целиком. Сделайте глубокий вдох и откройте глаза.',
    ],
  },
};

export function practiceDurationSec(p: Practice): number {
  if (p.mode === 'steps') return p.steps.length * p.stepSec;
  const { inhale, hold, exhale, rest } = p.pattern;
  return (inhale + hold + exhale + rest) * p.cycles;
}
