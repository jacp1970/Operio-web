import { JobStatus } from '../types';

/**
 * Finds the company's "Pendiente" status (non-completed) so that when a job is
 * passed from one operator to another, the new operator receives it in Pending state.
 */
export function findPendingStatus(statuses: JobStatus[]): JobStatus | undefined {
  if (!statuses || statuses.length === 0) return undefined;

  const normalize = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const exactPending = statuses.find(
    (s) => !s.isCompleted && normalize(s.name) === 'pendiente'
  );
  if (exactPending) return exactPending;

  const partialPending = statuses.find(
    (s) => !s.isCompleted && normalize(s.name).includes('pendiente')
  );
  if (partialPending) return partialPending;

  return statuses.find((s) => !s.isCompleted);
}
