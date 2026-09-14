import http from 'k6/http';
import { check, group } from 'k6';

export const options = {
  vus: 5,
  duration: '1m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export default function () {
  const baseUrl = __ENV.API_URL || 'http://localhost:3000';
  group('health endpoints', () => {
    const live = http.get(`${baseUrl}/health/live`);
    check(live, { 'liveness returns 200': (response) => response.status === 200 });

    const ready = http.get(`${baseUrl}/health/ready`);
    check(ready, { 'readiness responds': (response) => [200, 503].includes(response.status) });
  });
}
