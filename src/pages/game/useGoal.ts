import { useGoals } from '@/hooks/data';
import { goalForDate } from '@/domain/balance';
import { today } from '@/domain/dates';

export function useCurrentGoalVersion() {
  const goals = useGoals();
  return goalForDate(goals, today());
}
