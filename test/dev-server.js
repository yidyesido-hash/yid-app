/* Serveur local de recette : sert public/, l'API et un dossier de pages de test (test/site).
   Base : PGlite dans test/data (aucune variable DATABASE_URL en local). Mot de passe : test. */
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "test";
const http = require("http"), fs = require("fs"), path = require("path");
const handler = require("../api/forms");
const root = path.join(__dirname, "..");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json" };
const port = +process.env.PORT || 8787;
http.createServer((req, res) => {
  if (req.url.startsWith("/api/forms")) return handler(req, res);
  let p = decodeURIComponent(req.url.split("?")[0]);
  let file = p.startsWith("/site/") ? path.join(root, "test", p) : path.join(root, "public", p === "/" ? "index.html" : p);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.statusCode = 404; return res.end("404"); }
  res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log("yid-app local http://localhost:" + port + " (mot de passe : test)"));
