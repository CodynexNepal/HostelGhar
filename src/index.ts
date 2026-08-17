import express, { Express } from 'express';

const app: Express = express();

app.listen(3000, () => {
  console.log('Listening to port number 3000');
});
