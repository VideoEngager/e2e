/* global describe beforeAll beforeEach afterEach expect it xit afterAll */
const { browser } = require('protractor');
const config = require('./lib/config');
const log = require('./lib/logger');
const veUtil = require('./lib/veUtil');
log.init(config.logger);
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
    const authHeader = {
      location: genesysPageLocation + '#access_token=' + accessToken + '&expires_in=86399&token_type=bearer'
    };

    // mandatory
    mockProxy.mockIt({ path: '/oauth/(.*)', method: 'GET' }, null, 302, authHeader);
    mockProxy.mockIt({ path: '/api/v2/users/me\\?expand=conversationSummary', method: 'GET' }, genesysResponses.conversationSummary);
    mockProxy.mockIt({ path: '/api/v2/users/me\\?expand=organization', method: 'GET' }, genesysResponses.userResponse);
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
  });

  afterEach(async function () {
    // close agent and visitor pages after the test
    await genesys.switchToIframe();
    await genesys.hangup.click();
    await genesys.confirm.click();
    await genesys.switchTo();
    await genesys.close();
    await visitor.close();
  });

  afterAll(async function () {
    // close proxy servers
    mockProxy.stopAndClean();
  });

  it('outbound call: invite visitor, agent is in iframe', async function () {
    // construct genesys url by pak, env, clientId
    const genesysUrl = genesys.constructUrl(config.test_env);
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
    // get generated visitor url from genesys page
    visitorUrl = await genesys.getVisitorUrl();

    // open visitor page and join to the call
    await visitor.openAsNew(visitorUrl);
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

  it('inbound call: create mocked invitation, use pickup button, agent is in iframe', async function () {
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
    // construct genesys url by pak, env, clientId
    const genesysUrl = genesys.constructUrl(config.test_env);
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

    const authHeader = {
      location: genesysPageLocation + '#access_token=' + accessToken + '&expires_in=86399&token_type=bearer'
    };

    mockProxy.mockIt({ path: '/oauth/(.*)', method: 'GET' }, null, 302, authHeader);
    mockProxy.mockIt({ path: '/api/v2/users/me\\?expand=conversationSummary', method: 'GET' }, genesysResponses.conversationSummary);
    mockProxy.mockIt({ path: '/api/v2/users/me\\?expand=organization', method: 'GET' }, genesysResponses.userResponse);
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
  });

  afterEach(async function () {
    await visitor.close();
    await genesys.close();
  });

  afterAll(async function () {
    // close proxy servers
    mockProxy.stopAndClean();
  });

  it('outbound call: invite visitor, agent is in popup', async function () {
    // construct genesys url by pak, env, clientId
    const genesysUrl = genesys.constructUrl(config.test_env);
    // open genesys page
    await genesys.openAsNew(genesysUrl);
    // click start video button
    await genesys.authorized(accessToken);
    // check is websocket conencted
    await mockProxy.isConnected();
    // check c2v button and click it
    await genesys.c2vAvailable();
    await genesys.startVideoButton.click();

    // get generated visitor url from genesys page
    visitorUrl = await genesys.getVisitorUrl();
    // open visitor page and join to the call
    await visitor.openAsNew(visitorUrl);

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
    await visitor.verifyRedirect(REDIRECT_URL);
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
    // construct genesys url by pak, env, clientId
    const genesysUrl = genesys.constructUrl(config.test_env);
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
    await visitor.verifyRedirect(REDIRECT_URL);
    // except exception
    expect(agent.switchTo())
      .toThrow('NoSuchWindowError')
      .catch(function (e) { log.debug('handle exception to avoid crash', e); });
  });
});
