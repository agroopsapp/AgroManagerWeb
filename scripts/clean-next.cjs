/**
 * Borra `.next` para recuperar el servidor de desarrollo cuando Webpack deja
 * referencias a chunks inexistentes (p. ej. Cannot find module './948.js').
 */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", ".next");
try {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("[clean-next] Eliminada carpeta .next");
} catch (e) {
  if (e && e.code === "ENOENT") {
    console.log("[clean-next] .next no existía");
  } else {
    throw e;
  }
}
