import { get } from 'node:http';

const request = get(
  {
    host: '127.0.0.1',
    port: 3000,
    path: '/api/v1/health',
    timeout: 3000,
    headers: { Accept: 'application/json' },
  },
  (response) => {
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => {
      body += chunk;
    });
    response.on('end', () => {
      if (response.statusCode !== 200) process.exit(1);
      try {
        const payload = JSON.parse(body);
        process.exit(payload?.status === 'ok' ? 0 : 1);
      } catch {
        process.exit(1);
      }
    });
  },
);

request.on('timeout', () => {
  request.destroy();
  process.exit(1);
});
request.on('error', () => process.exit(1));
