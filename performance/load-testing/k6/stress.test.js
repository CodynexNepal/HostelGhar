import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 25 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 0 },
  ],
};
export default function () {
  const response = http.get(`${__ENV.API_URL || 'http://localhost:8000'}/health/live`);
  check(response, { 'service remains available': (res) => res.status === 200 });
}
