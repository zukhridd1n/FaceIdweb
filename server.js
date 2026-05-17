const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const host = process.env.HOST || "0.0.0.0";
const startPort = Number(process.env.PORT || 5173);
const distRoot = path.join(__dirname, "dist");
const root = fs.existsSync(path.join(distRoot, "index.html")) ? distRoot : __dirname;
const apiProxyTarget = process.env.API_PROXY_TARGET || "http://167.99.131.184:8000";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://${host}`);

    if (url.pathname.startsWith("/api/")) {
      proxyApiRequest(req, res, url);
      return;
    }

    const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    const requestedPath = safePath === "/" ? "/index.html" : safePath;
    const filePath = path.join(root, requestedPath);

    if (!filePath.startsWith(root)) {
      send(res, 403, "Forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        send(res, 404, "Not found");
        return;
      }

      send(res, 200, data, mimeTypes[path.extname(filePath)] || "application/octet-stream");
    });
  });
}

function proxyApiRequest(req, res, url) {
  const target = new URL(`${url.pathname}${url.search}`, apiProxyTarget);
  const transport = target.protocol === "https:" ? https : http;
  const headers = { ...req.headers, host: target.host };

  const proxyReq = transport.request(
    target,
    {
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", () => {
    send(res, 502, "API proxy error");
  });

  req.pipe(proxyReq);
}

function listen(port) {
  const server = createServer();

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      listen(port + 1);
      return;
    }

    throw error;
  });

  server.listen(port, host, () => {
    console.log(`FaceIdweb running at http://${host}:${port}/`);
  });
}

listen(startPort);
