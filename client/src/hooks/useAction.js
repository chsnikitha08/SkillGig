import { useCallback, useState } from 'react';
import { errorMessage } from '../api/http';
import { useToast } from '../context/ToastContext';

/**
 * Wraps a mutation: tracks `pending` (used to disable buttons and prevent double
 * submits), shows a toast on success or failure, and returns the result.
 */
export function useAction() {
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (fn, successMessage) => {
      setPending(true);
      try {
        const result = await fn();
        if (successMessage) toast(successMessage);
        return result;
      } catch (err) {
        toast(errorMessage(err), 'error');
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [toast],
  );

  return { run, pending };
}
