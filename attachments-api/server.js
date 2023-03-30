// Setting up the server modules
import { readFileSync } from "fs";
import { createServer } from "http";
import { createServer as createSSLServer } from "https";
import cors from "cors";
import helmet from "helmet";
import express from "express";

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);
app.use(cors({ origin: process.env.CORS_ORIGINS || "*" }));

// Setting up routes
import appRoutes from "./routes/api.js";
app.use(appRoutes);

// Anything outside the routes above, is a 404
app.all("*", (_req, res) => {
  res.status(404).end();
});

// Firing up HTTP server
try {
  const httpServer = createServer(app);
  httpServer.listen(process.env.PORT, () => {
    const address = httpServer.address();

    console.log(
      `HTTP Server started in ${process.env.NODE_ENV} mode at http://${
        address.address === "::" ? "localhost" : address.address
      }:${address.port}!`
    );
  });
} catch (err) {
  console.error(err);
}

// Setting up HTTPS server
try {
  if (!process.env.CERTIFICATE_PATH || !process.env.CERTIFICATE_KEY) {
    console.warn("Missing Certificate settings, HTTPS server was not started.");
  } else {
    // Decides the type of certificate to use
    const certType = process.env.CERTIFICATE_PATH.endsWith("crt")
      ? "crt"
      : "pfx";

    // Setting up the certificate
    const cert = readFileSync(process.env.CERTIFICATE_PATH);
    const key =
      certType === "crt"
        ? readFileSync(process.env.CERTIFICATE_KEY)
        : process.env.CERTIFICATE_KEY;
    const options =
      certType === "crt" ? { cert, key } : { pfx: cert, passphrase: key };

    // Firing up HTTPS server
    const httpsServer = createSSLServer(options, app);
    httpsServer.listen(process.env.SERVER_SSL_PORT, () => {
      const address = httpsServer.address();

      console.log(
        `HTTPS Server started in ${process.env.NODE_ENV} mode at https://${
          address.address === "::" ? "localhost" : address.address
        }:${address.port}!`
      );
    });
  }
} catch (err) {
  console.error(err);
}
