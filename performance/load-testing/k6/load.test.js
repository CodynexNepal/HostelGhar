import http from 'k6/http';
import { check } from 'k6';

export const options = { vus: 10, duration: '2m' };
export default function () {
  const response = http.get(`${__ENV.API_URL || 'http://localhost:3000'}/health/live`);
  check(response, { 'request succeeded': (res) => res.status === 200 });
}
