import { readFileSync } from 'fs';
import { createServer } from 'http';
import { createServer as createSSLServer } from 'https';
import cors from 'cors';
import helmet from 'helmet';
import express from 'express';

import { ChatRoomDTO } from './mysql.js';

import { config } from 'dotenv';
config();

export default function StartAPI() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use(helmet());
  app.use(cors({ origin: '*' }));

  app.get('/chatserver-api/:project_uid/:room_uid', async (req, res) => {
    const { project_uid, room_uid } = req.params;

    const dto = new ChatRoomDTO();
    const result = await dto.getAllMessages({ room_uid, project_uid });

    const rows = result.map((row, i) => {
      return { rowNumber: i, ...row };
    });

    res.json(rows);
  });

  app.get('/chatserver-api/:project_uid', async (req, res) => {
    const { project_uid } = req.params;
    const { page, pageSize, userUid, unread, sort } = req.query;

    const dto = new ChatRoomDTO();
    const result = await dto.getAllMessages({
      project_uid,
      user_uid: userUid,
      page: Number(page ?? '1'),
      page_size: Number(pageSize ?? '15'),
      sort,
      unread,
    });

    const rows = result.map((row, i) => {
      delete row.direct_link;

      row.cde_extra_info = JSON.parse(row.cde_extra_info);
      return { rowNumber: page && pageSize ? (page - 1) * pageSize + i : i, ...row };
    });

    res.json(rows);
  });

  // Anything outside the routes above, is a 404
  app.all('*', (_req, res) => {
    res.status(404).end();
  });

  // Firing up HTTP server
  const httpServer = createServer(app);
  httpServer.listen(process.env.API_PORT, () => {
    const address = httpServer.address();

    console.log(
      `API Server started in ${process.env.NODE_ENV} mode at http://${
        address.address === '::' ? 'localhost' : address.address
      }:${address.port}`
    );
  });

  // Setting up HTTPS server
  if (process.env.PFX_FILE && process.env.PFX_PASSWORD) {
    const options = {
      pfx: readFileSync(process.env.PFX_FILE),
      passphrase: process.env.PFX_PASSWORD,
    };

    const sslServer = createSSLServer(options, app);
    sslServer.listen(process.env.SSL_API_PORT, () => {
      const address = sslServer.address();

      console.log(
        `API Server started in ${process.env.NODE_ENV} mode at https://${
          address.address === '::' ? 'localhost' : address.address
        }:${address.port}`
      );
    });
  }
}

