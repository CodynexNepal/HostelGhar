import http from 'k6/http';
import { check } from 'k6';

export const options = { vus: 1, duration: '30s' };
export default function () {
  const response = http.get(`${__ENV.API_URL || 'http://localhost:3000'}/health/live`);
  check(response, { 'liveness is healthy': (res) => res.status === 200 });
}
