/* global describe beforeAll beforeEach afterEach expect it xit afterAll */
const { browser } = require('protractor');
const config = require('./lib/config');
const log = require('./lib/logger');
const veUtil = require('./lib/veUtil');
const MockProxy = require('./lib/mockProxy');
const Genesys = require('./po/genesys');
const Visitor = require('./po/visitor');
const genesysResponses = require('./lib/genesys');
const { exception } = require('winston');

const PROXY_SERVER_PORT = 9001;
const SOCKET_SERVER_PORT = 9898;
const genesysPageLocation = config.test_env.baseURL + '/static/genesys.purecloud.html';
const REDIRECT_URL = config.test_env.baseURL + '/static/index.html';
const accessToken = veUtil.getUUID();
const channelId = veUtil.getUUID();
let genesysUrl;

let genesysParams = {
  langTag: 'en-us',
  environment: null,
  interaction: 1,
  pak: null,
  clientId: null
};


function authHeader (genesysParams) 
{ 
  return {
    location: genesysPageLocation +
    '#access_token=' + accessToken +
    '&expires_in=86399&token_type=bearer' +
    '&state=' + encodeURIComponent(Buffer.from(JSON.stringify(genesysParams)).toString('base64'))
}
};

describe('genesys page tests in iframe mode', function () {
  // prepare genesys page and visitor page instances
  const genesys = new Genesys();
  const visitor = new Visitor();
  // create proxy server
  const mockProxy = new MockProxy();
  let VISITOR_SESSION_ID;
  let visitorUrl;

  beforeAll(async function () {
    // prepare mocks
    genesysResponses.userResponse.organization.id = config.test_env.organizationId;
    genesysResponses.channels.connectUri = `ws://localhost:${SOCKET_SERVER_PORT}/`;
    genesysResponses.channels.id = channelId;
    genesysResponses.getChannels.entities[0].connectUri = `ws://localhost:${SOCKET_SERVER_PORT}/`;
    genesysResponses.getChannels.entities[0].id = channelId;
    genesysResponses.messages.entities[0].body = JSON.stringify({ interactionId: VISITOR_SESSION_ID });

    const authURLParams = veUtil.generateUrlParamters({
      response_type: 'token',
      client_id: config.test_env.clientId,
      redirect_uri: encodeURIComponent(genesysPageLocation)
    });

    // mandatory
    mockProxy.mockIt({ path: '/api/v2/users/me\\?expand=conversationSummary', method: 'GET' }, genesysResponses.conversationSummary);
    mockProxy.mockIt({ path: '/api/v2/users/me\\?expand=organization', method: 'GET' }, genesysResponses.userResponse);
    mockProxy.mockIt({ path: '/api/v2/users/me\\?expand=organization%2Cauthorization', method: 'GET' }, genesysResponses.userResponseWithAuth);
    mockProxy.mockIt({ path: '/api/v2/users/:userId/presences/PURECLOUD', method: 'PATCH' }, genesysResponses.purecloud);
    mockProxy.mockIt({ path: '/api/v2/notifications/channels', method: 'POST' }, genesysResponses.channels);
    mockProxy.mockIt({ path: '/api/v2/notifications/channels', method: 'GET' }, genesysResponses.getChannels);
    mockProxy.mockIt({ path: '/api/v2/conversations/chats', method: 'GET' }, genesysResponses.chats[0]);
    mockProxy.mockIt({ path: '/api/v2/notifications/channels/' + channelId + '/subscriptions', method: 'GET' }, genesysResponses.subscriptions[0]);
    mockProxy.mockIt({ path: '/api/v2/notifications/channels/' + channelId + '/subscriptions', method: 'PUT' }, genesysResponses.subscriptions[0]);
    // webhook
    mockProxy.mockIt({ path: '/api/v2/conversations', method: 'GET' }, genesysResponses.conversations[0]);
    // not mandaroty
    /*
    mockProxy.mockIt({ path: '/api/v2/users/me\\?expand=chats', method: 'GET' }, genesysResponses.chats[0]);
    */
    // not used in this tests
    /*
    mockProxy.mockIt({ path: '/AGENT_PARTICIPANT_ID', method: 'GET' }, genesysResponses.participants);
    mockProxy.mockIt({ path: '/CONVERSATION_ID', method: 'GET' }, genesysResponses.conversationChat);
    */

    // start 80 port proxy server
    await mockProxy.startHttpProxyServer(PROXY_SERVER_PORT);
    // start 443 port proxy server
    await mockProxy.startSSlProxyServer(PROXY_SERVER_PORT);
    // start https server for mock responses
    await mockProxy.startHttpServer(PROXY_SERVER_PORT);
    // start socket server for mock socket connection
    await mockProxy.startSocketServer(SOCKET_SERVER_PORT);
    // authenticate and set to default db
    await veUtil.authenticate();
    await veUtil.setBrokerageProfile({
      branding:
        {
          visitorShowPrecall: false,
          enablePrecallWorkflow: false,
          inviteUrl: config.test_env.baseURL
        },
      newTheme: false,
      isPopup: false
    });
  });

  beforeEach(async function () {
    VISITOR_SESSION_ID = veUtil.getUUID();
    visitorUrl = visitor.constructUrlC2V(config.test_env, VISITOR_SESSION_ID);
    // construct genesys url by pak, env, clientId
    genesysUrl = genesys.constructUrl(config.test_env, genesysParams);

    let authRSP = authHeader(genesysParams);
    mockProxy.mockIt({ path: '/oauth/(.*)', method: 'GET' }, null, 302, authRSP);
  });

  afterEach(async function () {
    // close agent and visitor pages after the test
    try {
      await genesys.switchToIframe();
      await genesys.hangup.click();
      await genesys.confirm.click();
      await genesys.switchTo();
      await genesys.close();
      await visitor.close();
    } catch (e) {
      log.error(e.stack);
    }
    // close remaining pages
    Genesys.closeAllPages();
  });

  afterAll(async function () {
    // close proxy servers
    mockProxy.stopAndClean();
  });

  it('outbound call: invite visitor, agent is in iframe', async function () {
    // open genesys page
    await genesys.openAsNew(genesysUrl);
    // click start video button
    await genesys.authorized();
    // check is websocket conencted
    await mockProxy.isConnected();
    // check c2v button and click it
    await genesys.c2vAvailable();
    await genesys.startVideoButton.click();
    // check if iframe created
    await genesys.iframeCreated();
    await browser.sleep(1000);
    // get generated visitor url from genesys page
    visitorUrl = await genesys.getVisitorUrl();

    // open visitor page and join to the call
    await visitor.openAsNew(visitorUrl);
    expect(await visitor.shortUrlExpanded()).toBeTruthy();
    expect(await visitor.inWaitingState(config.test_env)).toBeTruthy();
    // switch to genesys page and verify we have local and remote video
    await genesys.switchToIframe();
    expect(await genesys.localVideoStarted()).toBeTruthy();
    await genesys.remoteVideoStarted();
    await expect(genesys.localvideo.getAttribute('readyState')).toEqual('4');

    // switch to visitor and verify we have local and remote video
    await visitor.switchTo();
    await visitor.localVideoStarted();
    expect(await visitor.localvideo.getAttribute('readyState')).toEqual('4');
    await visitor.remoteVideoStarted();
  });

  it('should accept inbound call in genesys page, visitor popup opens first', async function () {
    // set mockProxy server to response like there are an active interaction
    // replace chat mock with non-empty resp.
    genesysResponses.messages.entities[0].body = JSON.stringify({ interactionId: VISITOR_SESSION_ID });
    // mandatory
    mockProxy.mockIt({ path: '/api/v2/conversations/chats', method: 'GET' }, genesysResponses.chats[1]);
    mockProxy.mockIt({ path: '/api/v2/conversations/chats/' + genesysResponses.chats[1].entities[0].id + '/messages', method: 'GET' }, genesysResponses.messages);
    // mandatory and added for this test, not mandatory for outbound test
    mockProxy.mockIt({ path: '/api/v2/notifications/channels/' + channelId + '/subscriptions', method: 'GET' }, genesysResponses.subscriptions[1]);
    mockProxy.mockIt({ path: '/api/v2/notifications/channels/' + channelId + '/subscriptions', method: 'PUT' }, genesysResponses.subscriptions[1]);
    // not mandatory
    // mockProxy.mockIt({ path: '/api/v2/conversations/chats/' + genesysResponses.chats[1].entities[0].id, method: 'GET' }, genesysResponses.messages);

    // open visitor page
    await visitor.openAsNew(visitorUrl);
    // check visitor hang state
    expect(await visitor.shortUrlExpanded()).toBeTruthy();
    expect(await visitor.waitingToConnectOrAgent()).toBeTruthy();

    // open genesys page
    await genesys.openAsNew(genesysUrl);
    // test localstorage token
    await genesys.authorized(accessToken);
    // check if websocket conencted
    await mockProxy.isConnected();

    // check pickup button and click it
    await genesys.pickupAvailable();
    await genesys.acceptClickToVideoButton.click();
    // check if iframe created
    await genesys.iframeCreated();
    await genesys.switchToIframe();
    // check genesys page local stream
    expect(await genesys.localVideoStarted()).toBeTruthy();
    await genesys.remoteVideoStarted();
    await expect(genesys.localvideo.getAttribute('readyState')).toEqual('4');

    // switch to visitor and verify we have local and remote video
    await visitor.switchTo();
    await visitor.localVideoStarted();
    expect(await visitor.localvideo.getAttribute('readyState')).toEqual('4');
    await visitor.remoteVideoStarted();
  });
});

describe('genesys page tests in popup mode', function () {
  // prepare genesys page and visitor page instances
  const genesys = new Genesys();
  const visitor = new Visitor();
  // create proxy server
  const mockProxy = new MockProxy();
  let VISITOR_SESSION_ID;
  let visitorUrl;

  beforeAll(async function () {
    genesysResponses.userResponse.organization.id = config.test_env.organizationId;
    genesysResponses.channels.connectUri = `ws://localhost:${SOCKET_SERVER_PORT}/`;
    genesysResponses.channels.id = channelId;
    genesysResponses.getChannels.entities[0].connectUri = `ws://localhost:${SOCKET_SERVER_PORT}/`;
    genesysResponses.getChannels.entities[0].id = channelId;
    genesysResponses.messages.entities[0].body = JSON.stringify({ interactionId: VISITOR_SESSION_ID });

    mockProxy.mockIt({ path: '/api/v2/users/me\\?expand=conversationSummary', method: 'GET' }, genesysResponses.conversationSummary);
    mockProxy.mockIt({ path: '/api/v2/users/me\\?expand=organization', method: 'GET' }, genesysResponses.userResponse);
    mockProxy.mockIt({ path: '/api/v2/users/me\\?expand=organization\\%2Cauthorization', method: 'GET' }, genesysResponses.userResponseWithAuth);
    mockProxy.mockIt({ path: '/api/v2/users/:userId/presences/PURECLOUD', method: 'PATCH' }, genesysResponses.purecloud);
    mockProxy.mockIt({ path: '/api/v2/notifications/channels', method: 'POST' }, genesysResponses.channels);
    mockProxy.mockIt({ path: '/api/v2/notifications/channels', method: 'GET' }, genesysResponses.getChannels);
    mockProxy.mockIt({ path: '/api/v2/conversations/chats', method: 'GET' }, genesysResponses.chats[0]);
    mockProxy.mockIt({ path: '/api/v2/notifications/channels/' + channelId + '/subscriptions', method: 'GET' }, genesysResponses.subscriptions[0]);
    mockProxy.mockIt({ path: '/api/v2/notifications/channels/' + channelId + '/subscriptions', method: 'PUT' }, genesysResponses.subscriptions[0]);
    mockProxy.mockIt({ path: '/api/v2/conversations', method: 'GET' }, genesysResponses.conversations[0]);

    await mockProxy.startHttpProxyServer(PROXY_SERVER_PORT);
    await mockProxy.startSSlProxyServer(PROXY_SERVER_PORT);
    await mockProxy.startHttpServer(PROXY_SERVER_PORT);
    await mockProxy.startSocketServer(SOCKET_SERVER_PORT);
    await veUtil.authenticate();
    await veUtil.setBrokerageProfile({
      branding:
         {
           visitorShowPrecall: false,
           enablePrecallWorkflow: false,
           inviteUrl: config.test_env.baseURL,
           redirectUrl: REDIRECT_URL
         },
      newTheme: false,
      isPopup: true
    });
  });

  beforeEach(async function () {
    VISITOR_SESSION_ID = veUtil.getUUID();
    visitorUrl = visitor.constructUrlC2V(config.test_env, VISITOR_SESSION_ID);
    // construct genesys url by pak, env, clientId
    const genesysUrl = genesys.constructUrl(config.test_env, genesysParams);
    let authRSP = authHeader(genesysParams);
    mockProxy.mockIt({ path: '/oauth/(.*)', method: 'GET' }, null, 302, authRSP);

  });

  afterEach(async function () {
    try {
      await visitor.switchTo();
      log.debug(await browser.getCurrentUrl());
      await visitor.close();
      await genesys.close();
    } catch (e) {
      log.error(e.stack);
    }
    // close remaining pages
    Genesys.closeAllPages();
  });

  afterAll(async function () {
    // close proxy servers
    mockProxy.stopAndClean();
  });

  it('outbound call: invite visitor, open agent in popup by pickup button', async function () {
    // open genesys page
    await genesys.openAsNew(genesysUrl);
    // click start video button
    await genesys.authorized(accessToken);
    // check is websocket conencted
    await mockProxy.isConnected();
    // check c2v button and click it
    await genesys.c2vAvailable();
    await genesys.startVideoButton.click();
    await browser.sleep(1000);

    // get generated visitor url from genesys page
    visitorUrl = await genesys.getVisitorUrl();
    // open visitor page and join to the call
    await visitor.openAsNew(visitorUrl);
    // check if visitor is redirected from short url
    expect(await visitor.shortUrlExpanded()).toBeTruthy();
    expect(await visitor.inWaitingState(config.test_env)).toBeTruthy();
    await genesys.switchTo();
    // click start video session button to open agent popup
    await genesys.pickupAvailable();
    // check if popup created
    const windowsBeforePopup = await browser.getAllWindowHandles();
    await genesys.acceptClickToVideoButton.click();
    const agent = await genesys.popupCreated(windowsBeforePopup);

    // verify  agent
    await agent.switchTo();
    expect(await agent.localVideoStarted()).toBeTruthy();
    await agent.remoteVideoStarted();
    await expect(agent.localvideo.getAttribute('readyState')).toEqual('4');

    // switch to visitor and verify we have local and remote video
    await visitor.switchTo();
    await visitor.localVideoStarted();
    expect(await visitor.localvideo.getAttribute('readyState')).toEqual('4');
    await visitor.remoteVideoStarted();

    // terminate session by agent red button
    await agent.switchTo();
    await agent.hangup.click();
    await agent.confirm.click();

    await visitor.switchTo();
    expect(await visitor.redirectedTo(REDIRECT_URL)).toBeTruthy();
    // except exception
    expect(agent.switchTo())
      .toThrow('NoSuchWindowError')
      .catch(function (e) { log.debug('handle exception to avoid crash', e); });
  });

  it('outbound call: invite visitor, open agent first in popup', async function () {
     // open genesys page
    await genesys.openAsNew(genesysUrl);
    // click start video button
    await genesys.authorized(accessToken);
    // check is websocket conencted
    await mockProxy.isConnected();
    // check c2v button and click it
    await genesys.c2vAvailable();
    await genesys.startVideoButton.click();
    await browser.sleep(1000);

    // get generated visitor url from genesys page
    visitorUrl = await genesys.getVisitorUrl();

    // click start video session button to open agent popup
    await genesys.StartVideoSessionAvailable();
    // check if popup created
    const windowsBeforePopup = await browser.getAllWindowHandles();
    await genesys.acceptIncomingCallButton.click();
    const agent = await genesys.popupCreated(windowsBeforePopup);

    await agent.switchTo();
    await agent.previewVideoStarted();

    // open visitor page and join to the call
    await visitor.openAsNew(visitorUrl);
    expect(await visitor.shortUrlExpanded()).toBeTruthy();
    expect(await visitor.inWaitingState(config.test_env)).toBeTruthy();
    // verify  agent
    await agent.switchTo();
    expect(await agent.localVideoStarted()).toBeTruthy();
    await agent.remoteVideoStarted();
    await expect(agent.localvideo.getAttribute('readyState')).toEqual('4');

    // switch to visitor and verify we have local and remote video
    await visitor.switchTo();
    await visitor.localVideoStarted();
    expect(await visitor.localvideo.getAttribute('readyState')).toEqual('4');
    await visitor.remoteVideoStarted();

    // terminate session by agent red button
    await agent.switchTo();
    await agent.hangup.click();
    await agent.confirm.click();

    await visitor.switchTo();
    expect(await visitor.redirectedTo(REDIRECT_URL)).toBeTruthy();
    // except exception
    expect(agent.switchTo())
      .toThrow('NoSuchWindowError')
      .catch(function (e) { log.debug('handle exception to avoid crash', e); });
  });

  it('inbound call: create mocked invitation, use pickup button, agent is in popup', async function () {
    // set mockProxy server to response like there are an active interaction
    // replace chat mock with non-empty resp.
    genesysResponses.messages.entities[0].body = JSON.stringify({ interactionId: VISITOR_SESSION_ID });
    // mandatory
    mockProxy.mockIt({ path: '/api/v2/conversations/chats', method: 'GET' }, genesysResponses.chats[1]);
    mockProxy.mockIt({ path: '/api/v2/conversations/chats/' + genesysResponses.chats[1].entities[0].id + '/messages', method: 'GET' }, genesysResponses.messages);
    // mandatory and added for this test, not mandatory for outbound test
    mockProxy.mockIt({ path: '/api/v2/notifications/channels/' + channelId + '/subscriptions', method: 'GET' }, genesysResponses.subscriptions[1]);
    mockProxy.mockIt({ path: '/api/v2/notifications/channels/' + channelId + '/subscriptions', method: 'PUT' }, genesysResponses.subscriptions[1]);
    // not mandatory
    // mockProxy.mockIt({ path: '/api/v2/conversations/chats/' + genesysResponses.chats[1].entities[0].id, method: 'GET' }, genesysResponses.messages);
    // open visitor page
    await visitor.openAsNew(visitorUrl);
    // check visitor hang state
    expect(await visitor.shortUrlExpanded()).toBeTruthy();
    expect(await visitor.waitingToConnectOrAgent()).toBeTruthy();
    // open genesys page
    await genesys.openAsNew(genesysUrl);
    // test localstorage token
    await genesys.authorized(accessToken);
    // check if websocket conencted
    await mockProxy.isConnected();

    // check pickup button and click it
    await genesys.pickupAvailable();
    // check if popup created
    const windowsBeforePopup = await browser.getAllWindowHandles();
    await genesys.acceptClickToVideoButton.click();
    const agent = await genesys.popupCreated(windowsBeforePopup);
    // switch to agent popup
    await agent.switchTo();
    expect(await agent.localVideoStarted()).toBeTruthy();
    await agent.remoteVideoStarted();
    await expect(agent.localvideo.getAttribute('readyState')).toEqual('4');

    // switch to visitor and verify we have local and remote video
    await visitor.switchTo();
    await visitor.localVideoStarted();
    expect(await visitor.localvideo.getAttribute('readyState')).toEqual('4');
    await visitor.remoteVideoStarted();

    // terminate session by agent red button
    await agent.switchTo();
    await agent.hangup.click();
    await agent.confirm.click();

    await visitor.switchTo();
    await visitor.redirectedTo(REDIRECT_URL);
    // except exception
    expect(agent.switchTo())
      .toThrow('NoSuchWindowError')
      .catch(function (e) { log.debug('handle exception to avoid crash', e); });
  });
  it('Should not blink on alerting, should blink on accepted callback, should stop on disconneted', async function () {
    browser.sleep(4000);
    let params = genesysParams;
    params.interaction = 'ffff-ffff-ffff-ffff';
    params.conversationId = 'ffff-ffff-ffff-ffff';
    mockProxy.mockIt({ path: '/api/v2/conversations/ffff-ffff-ffff-ffff', method: 'GET' }, genesysResponses.callbackConversation);
    mockProxy.mockIt({ path: '/api/v2/users/me\\?expand=conversationSummary', method: 'GET' }, genesysResponses.conversationSummary);
    mockProxy.mockIt({ path: '/api/v2/users/me\\?expand=organization', method: 'GET' }, genesysResponses.userResponse);
    log.debug("WTF RESP:" + JSON.stringify(genesysResponses.userResponse));
    mockProxy.mockIt({ path: '/api/v2/users/me\\?expand=organization%2Cauthorization', method: 'GET' }, genesysResponses.userResponseWithAuth);

    const genesysUrl = genesys.constructUrl(config.test_env, params);
    log.debug('genesysParams' + JSON.stringify(genesysParams));
    // open genesys page
    log.debug('ABOUT TO OPEN GENESYS GLUE URL:' + genesysUrl);
    let authRSP = authHeader(params);
    log.debug("AUTH RESP" + JSON.stringify(authRSP));
    mockProxy.mockIt({ path: '/oauth/(.*)', method: 'GET' }, null, 302, authRSP);

    await genesys.openAsNew(genesysUrl);
    expect(await genesys.c2vAvailable());
    browser.sleep(4000);

    mockProxy.sendSocketMsg(genesysResponses.callBackConnectMsg);
    expect(await genesys.pickupAvailable());
    browser.sleep(4000);

    mockProxy.sendSocketMsg(genesysResponses.callBackDisconnectMsg);
    // test localstorage token
    expect(await genesys.c2vAvailable());
    browser.sleep(4000);

    // body...
  });
});
