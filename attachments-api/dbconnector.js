import { createConnection } from 'mysql2';

export default class DBConnector {
  constructor() {
    const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE } = process.env;
    this.Connection = createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_DATABASE,
    });

    this.Connection.connect((err) => {
      if (err) console.log(err);
    });
  }

  query(query, values) {
    return new Promise((resolve, reject) => {
      this.Connection.query(query, values, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  disconnect() {
    return new Promise((resolve, reject) => {
      try {
        this.Connection.end();
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }
}
