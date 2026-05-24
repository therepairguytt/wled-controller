import { useState, useEffect } from 'react';
import api from '../services/api'

const CONFIG_KEY = 'app_config_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000;

export function useAppConfig() {
  const [config, setConfig] = useState(() => {
    const cached = localStorage.getItem(CONFIG_KEY);
    if (cached) {
      const { payload, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) return payload;
    }
    return null;
  });
  
  const [loading, setLoading] = useState(!config);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await api.get('/api/config');
        
        const data = response.data || (await response.json?.());
        
        if (data) {
          const cacheData = { payload: data, timestamp: Date.now() };
          localStorage.setItem(CONFIG_KEY, JSON.stringify(cacheData));
          setConfig(data);
        }
      } catch (error) {
        console.error("Config fetch failed, using cache if available:", error);
      } finally {
        setLoading(false);
      }
    };

    if (!config) {
      fetchConfig();
    }
  }, [config]);

  return { config, loading };
}