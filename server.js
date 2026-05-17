const http = require("http");
const fs = require("fs");
const path = require("path");

const host = "127.0.0.1";
const startPort = Number(process.env.PORT || 5173);
const root = __dirname;

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
