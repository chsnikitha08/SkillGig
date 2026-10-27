import { useCallback, useEffect, useState } from 'react';
import { errorMessage, http } from '../api/http';

/** GET a URL and expose { data, loading, error, reload }. Pass null to skip. */
export function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState(null);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!url) return;
      if (!silent) setLoading(true);
      try {
        const res = await http.get(url);
        setData(res.data);
        setError(null);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [url],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load, setData };
}
