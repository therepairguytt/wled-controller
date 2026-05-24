import axios from 'axios'

const host = import.meta.env.VITE_API_HOST
const port = import.meta.env.VITE_API_PORT

const api = axios.create({
  baseURL: `http://${host}:${port}`
})

api.interceptors.response.use(
  (response) => {
    window.dispatchEvent(new CustomEvent('api-status', { detail: { online: true } }));
    return response;
  },
  (error) => {
    if (!error.response) {
      window.dispatchEvent(new CustomEvent('api-status', { detail: { online: false } }));
    }
    return Promise.reject(error);
  }
);

export default api