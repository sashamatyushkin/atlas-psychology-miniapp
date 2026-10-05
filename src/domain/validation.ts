import { GOALS } from './quiz';
import type { GoalId } from './types';

export interface LeadForm {
  name: string;
  goal: GoalId | null;
  consent: boolean;
}

export type LeadFormErrors = Partial<Record<keyof LeadForm, string>>;

const NAME_RE = /^[\p{L}][\p{L}\s'’-]{1,39}$/u;

export function normalizeName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export function validateLeadForm(form: LeadForm): LeadFormErrors {
  const errors: LeadFormErrors = {};
  const name = normalizeName(form.name);
  if (!name) errors.name = 'Как к вам обращаться?';
  else if (!NAME_RE.test(name)) errors.name = 'Только буквы, от 2 до 40 символов';
  if (!form.goal || !GOALS.some((g) => g.id === form.goal)) errors.goal = 'Выберите, что для вас важнее';
  if (!form.consent) errors.consent = 'Нужно согласие, чтобы мы могли отправить гайд';
  return errors;
}

export const isFormValid = (e: LeadFormErrors) => Object.keys(e).length === 0;
