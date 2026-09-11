export const useCache = <T>(key: string, ttl = 5 * 60 * 1000) => {
  const get = (): T | null => {
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < ttl) {
          return data;
        }
      }
    } catch (e) {
      console.error('Cache read error:', e);
    }
    return null;
  };

  const set = (data: T) => {
    try {
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error('Cache write error:', e);
    }
  };

  const clear = () => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Cache clear error:', e);
    }
  };

  return { get, set, clear };
};
