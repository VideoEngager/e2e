
# VideoEngager e2e Test

## Installation

1. install required nodejs dependencies

```bash
npm install
npm run webdriver
```

2. Configure your hosts file to forward mypurecloud requests into your localhost

- You can use below code to backup your hosts and use predefined hosts file
```bash
sudo cp /etc/hosts /etc/hostsBackup
sudo cp mockedhosts /etc/hosts
```
- Below lines should be in your hosts file
```txt
127.0.0.1 login.mypurecloud.com.au
127.0.0.1 login.mypurecloud.de
127.0.0.1 login.mypurecloud.com
127.0.0.1 api.mypurecloud.com.au
127.0.0.1 api.mypurecloud.de
127.0.0.1 api.mypurecloud.com
```

## Run test in dev

**environment** settings:

- dev - will run against dev.videoengager.com
- test - will run against localhost:9000
- staging - will run against staging.leadsecure.com

Tests are run using configuration specified in config.js based on NODE_ENV.

```bash
NODE_ENV=test npm run test
```



## Mocking Responses

To be able to mock responses you first need to setup your hosts file. Redirect desired mock dns to localhost.

You can find a working example in:

```bash
tests/StandaloneMockProxy.js
```

It can be used to debug.

### Tutorial

```bash
/*** require helper ***/
const MockProxy = require('./lib/mockProxy');
/*** create a new proxy instance ***/
const mockProxy = new MockProxy();
  
/*** start servers with port number or use their default port ***/
// start 80 port proxy server, default 9001
mockProxy.startHttpProxyServer(PROXY_SERVER_PORT);
// start 443 port proxy server, default 9001
mockProxy.startSSlProxyServer(PROXY_SERVER_PORT);
// start https server for mock responses, default 9001
mockProxy.startHttpServer(PROXY_SERVER_PORT);
// start socket server for mock socket connection, default 9898
mockProxy.startSocketServer(SOCKET_SERVER_PORT);

/*** mock request ***/
// to mock a request, put path, method and response objecy
mockProxy.mockIt({ path: '/info', method: 'POST' }, responseObject);

// note: dont forget to use "\\" (double reverse slash) before "?" (question mark)
mockProxy.mockIt({ path: '/info\\?companyParam=videoengager', method: 'GET' }, responseObject);

/*** mock advanced request ***/
// you can mock with custom status number and header
mockProxy.mockIt({ path: '/oauth/authorize', method: 'GET' }, responseObject, 302, headerObject);

```
## VideoEngager e2e tests 
[Detailed Document About Tests](https://docs.google.com/document/d/1f3fh4smNb-JDJI3wm_p0ajPtv9pzRZQlWJR8c0jxVhg/edit "Detailed Document About Tests").
Core tests are consist of 11 different scenarios. In summary, these are:
### Genesys page tests in iframe mode
1. Outbound call: invite visitor, agent is in iframe
2. Inbound call: create mocked invitation, use pickup button, agent is in iframe
### Genesys page tests in popup mode
3. Outbound call: invite visitor, use pickup button, agent is in popup 
4. Outbound call: invite visitor, open agent first in popup
5. Inbound call: create mocked invitation, use pickup button, agent is in popup 
### Basic video call tests
#### Configured with Javascript functions
6. Inbound call, agent page loads first
7. Inbound call, visitor page loads first 
8. Outbound call, end it from agent 
#### Configured with URL Params
9. Inbound call, agent page loads first
10. Inbound call, visitor page loads first 
11. Outbound call, end it from agent

## Extra 

### run spesific test case 
You can run only one test case by running this command:

`npx protractor --specs='tests/base.spec.js' --grep="outbound" `
### open chrome in 'disabled ssl security' mode
If you are a mac user you can open your chrome without ssl security:

`open /Applications/Google\ Chrome\ Dev.app --args --args --user-data-dir="~/tmp" --disable-web-security --allow-running-insecure-content --ignore-certificate-errors`