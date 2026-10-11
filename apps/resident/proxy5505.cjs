const http = require('http');

const server = http.createServer((req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: 5500,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: 'localhost:5500' },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', () => {
    res.writeHead(302, { Location: 'http://localhost:5500' + req.url });
    res.end();
  });

  req.pipe(proxyReq, { end: true });
});

server.on('upgrade', (req, socket, head) => {
  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: 5500,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: 'localhost:5500' },
  });
  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
      Object.entries(proxyRes.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n');
    proxySocket.pipe(socket).pipe(proxySocket);
  });
  proxyReq.end();
});

server.listen(5505, '127.0.0.1', () => {
  console.log('Port 5505 forwarder active -> http://localhost:5500');
});
