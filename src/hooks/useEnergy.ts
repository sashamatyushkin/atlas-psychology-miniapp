import { useEffect, useReducer } from 'react';
import { currentEnergy } from '../domain/engine';
import { energyCap, regenPerSec, tapValue } from '../domain/economy';
import { useApp } from '../store/app';

/** Перерисовывает компонент с заданным интервалом. */
export function useTicker(ms: number) {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const id = setInterval(tick, ms);
    return () => clearInterval(id);
  }, [ms]);
}

/** Текущая энергия с учётом регенерации и ещё не подтверждённых тапов. */
export function useEnergy(ms = 500) {
  useTicker(ms);
  const state = useApp((s) => s.state)!;
  const pending = useApp((s) => s.pendingTaps + s.inflightTaps);
  const offset = useApp((s) => s.clockOffset);
  const value = tapValue(state);
  const raw = currentEnergy(state, Date.now() + offset) - pending * value;
  return {
    energy: Math.max(0, Math.floor(raw)),
    cap: energyCap(state),
    regen: regenPerSec(state),
    tapValue: value,
  };
}
