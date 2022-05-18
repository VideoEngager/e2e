const fs = require('fs');
const WebSocketServer = require('websocket').server;
const http = require('http');
const httpProxy = require('http-proxy');
const config = require('./config');
const log = require('./logger');
const { match } = require('path-to-regexp');

let socketConnected = false;
let connection;
let sslProxy;
let httpsProxy;
let httpServer;
let socketServer;
let wsServer;
const mockObjects = [];

const header = {
  'Access-Control-Allow-Origin': config.test_env.baseURL,
  'Content-Type': 'application/json',
  'access-control-allow-headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, DNT, User-Agent, Keep-Alive, Cache-Control, ININ-Client-Path',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, HEAD, OPTIONS, PATCH',
  Allow: 'GET, PUT, POST, DELETE, HEAD, OPTIONS, PATCH',
  'access-control-max-age': 2592000
};

/**
 * MockProxy Class contains proxy servers, socket server and http server
 * genesys responses are redirected to http server by proxy servers
 * web socket server given by genesys mocked by local web socket server
 */
class MockProxy {
  /**
   * set port number for ssl proxy server.
   * it will listen 443 and will redirect messages to given port number in local host
   * @param {int} port port number for local mock server
   * @returns promise
   */
  startSSlProxyServer (port = 9001) {
    return new Promise(function (resolve, reject) {
      try {
        sslProxy = httpProxy.createProxyServer({
          target: 'http://localhost:' + port,
          ssl: {
            key: fs.readFileSync('./tests/lib/cert/fakeCertificate.key', 'utf8'),
            cert: fs.readFileSync('./tests/lib/cert/fakeCertificate.crt', 'utf8')
          }
        });

        sslProxy.on('error', function (err, req, res) {
          log.error('ssl proxy server error', req.method, req.url, err);
          res.writeHead(200, header);
          res.end();
        });

        sslProxy.listen(443);
        resolve({ status: 'ok', message: 'ssl proxy server started' });
      } catch (e) {
        log.error(e);
        reject(new Error({ status: 'fail', message: 'ssl proxy failed', error: e }));
      }
    });
  }

  /**
   * close ssl proxy server
   */
  closeSSlProxyServer () {
    if (sslProxy) {
      sslProxy.close();
    }
  }

  /**
   * it will listen 80 port and redirect messages to given port
   * @param {int} port port number for local mock server
   * @returns promise
   */
  startHttpProxyServer (port = 9001) {
    return new Promise(function (resolve, reject) {
      try {
        httpsProxy = httpProxy.createProxyServer({ target: 'http://localhost:' + port });

        httpsProxy.on('error', function (err, req, res) {
          log.error('http proxy server error', req.method, req.url, err);
          res.writeHead(200, header);
          res.end();
        });

        httpsProxy.listen(80);
        resolve({ status: 'ok', message: 'http server started' });
      } catch (e) {
        log.error(e);
        reject(new Error({ status: 'fail', message: 'http proxy failed', error: e }));
      }
    });
  }

  /**
   * close http proxy server
   */
  closeHttpProxyServer () {
    if (httpsProxy) {
      httpsProxy.close();
    }
  }

  /**
   * set your local mock web socket servers port number
   * @param {int} port mock socket server port number
   * @returns promize
   */
  startSocketServer (port = 9898) {
    return new Promise(function (resolve, reject) {
      try {
        socketServer = http.createServer();

        socketServer.on('error', function (err, req, res) {
          log.error('http socket server error', req.method, req.url, err);
          res.writeHead(200, header);
          res.end();
        });

        socketServer.listen(port);
        wsServer = new WebSocketServer({
          httpServer: socketServer
        });

        wsServer.on('request', function (request) {
          connection = request.accept(null, request.origin);
          connection.on('message', function (data) {
            log.debug('Received data:', data.utf8Data);
            const jsonData = JSON.parse(data.utf8Data);
            if (jsonData.message === 'ping') {
              connection.sendUTF(JSON.stringify({ eventBody: { message: 'pong' }, topicName: 'channel.metadata' }));
              socketConnected = true;
            }
          });
        });

        wsServer.on('error', function (err) {
          log.error('wsServer error', err);
        });

        resolve({ status: 'ok', message: 'socket server started' });
      } catch (e) {
        log.error(e.message);
        reject(new Error(e));
      }
    });
  }

  /**
   * close websocket server
   */
  async closeSocketServer () {
    if (connection) {
      connection.close();
    }
    if (socketServer) {
      socketServer.close();
    }
    socketConnected = false;
  }

  /**
   * Add/replace mock resp.
   */
  mockIt (rule, response, statusCode = 200, _header = header) {
    const index = mockObjects.findIndex(function (element) {
      return element.rule.path === rule.path && element.rule.method === rule.method;
    });
    if ((index !== -1)) {
      mockObjects[index] = { rule: rule, resp: response, statusCode: statusCode, header: _header };
    } else {
      mockObjects.push({ rule: rule, resp: response, statusCode: statusCode, header: _header });
    }
    log.debug('Mocked:' + JSON.stringify(rule) + ' With response:' + JSON.stringify(response));
  }

  cleanMocks () {
    mockObjects.splice(0, mockObjects.length);
  }

  /**
   * local mock http server
   * @param {*} accessToken genesys mock auth token. it is given as auth token by genesys
   * @param {*} port this local mock server's port number
   * @returns promise
   */
  startHttpServer (port = 9001) {
    return new Promise(function (resolve, reject) {
      try {
        httpServer = http.createServer(function (req, res) {
          let rawData = '';
          req.on('data', (chunk) => {
            rawData += chunk;
          });
          req.on('end', () => {
            try {
              log.debug('REQUEST rcvd===> Method:' + req.method + ' PATH:' + req.url);
              const parsedData = JSON.parse(rawData);
              console.log('REQUEST body===> ', parsedData);
            } catch (e) {
              console.error(e.message);
            }
          });

          const mresp = mockObjects.find(function (element) {
            const rule = match(element.rule.path);
            //            log.debug("URL PATH:" + req.url + "RULE:" + element.rule.path);
            return rule(req.url) && element.rule.method === req.method;
          });
          if (mresp) {
            log.debug('Got mock?', JSON.stringify(mresp));
            res.writeHead(mresp.statusCode, mresp.header);
            if (mresp.resp) {
              res.write(JSON.stringify(mresp.resp, true, 2));
            }
            return res.end();
          }
          log.warn('NON MOCKED Method', req.method, req.url);
          res.writeHead(200, header);
          return res.end();
        });
        httpServer.on('error', function (err, req, res) {
          log.error('http server error', req.method, req.url, err);
          res.writeHead(200, header);
          res.end();
        });
        httpServer.listen(port);
        resolve({ status: 'ok', message: 'socket server started' });
      } catch (e) {
        log.error(e);
        reject(new Error({ status: 'fail', message: 'socket server failed', error: e }));
      }
    });
  }

  /**
   * close http server which responses proxied requests
   */
  closeHttpServer () {
    if (httpServer) {
      httpServer.close();
    }
  }

  /**
   * check if websocked ever connected in every half seconds
   * @param {number} timeout timeout in miliseconds
   * @returns promise
   */
  isConnected (timeout = 10000) {
    let count = timeout / 500;
    return new Promise(function (resolve, reject) {
      const interval = setInterval(function () {
        if (socketConnected === true) {
          clearInterval(interval);
          // socketConnected = false;
          resolve();
          return;
        }
        if (count === 0) {
          reject(Error('timeout reached'));
        }
        count -= 1;
      }, 500);
    });
  }

  stopAndClean () {
    this.closeHttpProxyServer();
    this.closeHttpServer();
    this.closeSSlProxyServer();
    this.closeSocketServer();
    this.cleanMocks();
  }

  sendSocketMessage (socketMessage) {
    if (socketConnected) {
      return connection.sendUTF(JSON.stringify(socketMessage));
    } else {
      throw new Error('socket not connected.');
    }
  }
}

module.exports = MockProxy;
