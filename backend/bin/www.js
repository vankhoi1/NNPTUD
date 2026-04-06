#!/usr/bin/env node
require('dotenv').config();

const { app, initApp } = require('../app');
const http = require('http');
const { Server } = require('socket.io');
const { setupSockets } = require('../sockets/socket');

const PORT = process.env.PORT || 3000;

async function startServer() {
  await initApp();

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*'
    }
  });

  setupSockets(io);
  app.set('io', io);

  httpServer.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });

  process.on('unhandledRejection', (err) => {
    console.error(`Unhandled rejection: ${err.message}`);
    httpServer.close(() => process.exit(1));
  });
}

startServer().catch((error) => {
  console.error(`Startup failed: ${error.message}`);
  process.exit(1);
});
