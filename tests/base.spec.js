/* global describe beforeAll beforeEach afterEach expect it xit */
const { browser } = require('protractor');
const config = require('./lib/config');
const log = require('./lib/logger');
const veUtil = require('./lib/veUtil');

const Page = require('./po/page');
// Import Agent class definition
const Agent = require('./po/agent');
// Import visitor
const Visitor = require('./po/visitor');
// Create an agent page object with environment
const agent = new Agent();
// Create a visitor page object with environment
const visitor = new Visitor();

describe('Basic video call tests', function () {
  let VISITOR_SESSION_ID;
  let agentUrl;
  let visitorUrl;

  beforeAll(async function () {
    // authenticate agent
    await veUtil.authenticate(config.test_env);
    // Lets prepare some sane settings.
    // Don't obscure view
    await veUtil.authenticate();
    await veUtil.setBrokerageProfile({
      safety: {
        enable: true,
        disableRemoteCamera: false
      },
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

  describe('Configured with Javascript functions', function () {
    beforeEach(function () {
      VISITOR_SESSION_ID = veUtil.getUUID();
      agentUrl = agent.constructUrl(config.test_env);
      visitorUrl = visitor.constructUrlC2V(config.test_env, VISITOR_SESSION_ID);
    });

    afterEach(async function () {
      try {
        await agent.switchTo();
        await agent.hangup.click();
        await agent.confirm.click();
        await visitor.close();
      } catch (e) {
        log.error(e.stack);
      }
      // close remaining pages
      Page.closeAllPages();
    });

    it('should make inbound call, agent page loads first', async function () {
      // visitor id to be used in both agent and visitor page init
      log.debug('about to open agent url:' + agentUrl);
      await agent.openAsNew(agentUrl);

      // configure agent in 'autocall visitor session mode'
      await agent.configureAgentWithJS(config.test_env, VISITOR_SESSION_ID);
      log.debug('about to open visitor url in a second browser:' + visitorUrl);
      await visitor.openAsNew(visitorUrl);

      // switch to agent page and verify we have local and remote video
      await agent.switchTo();
      expect(await agent.localVideoStarted()).toBeTruthy();
      await agent.remoteVideoStarted();
      await expect(agent.localvideo.getAttribute('readyState')).toEqual('4');

      // switch to visitor and verify we have local and remote video
      await visitor.switchTo();
      await visitor.localVideoStarted();
      await expect(visitor.localvideo.getAttribute('readyState')).toEqual('4');
      await visitor.remoteVideoStarted();
    });

    it('should make inbound call, visitor page loads first', async function () {
      // Test will use different visitor session
      const vurl = visitor.constructUrlC2V(config.test_env, VISITOR_SESSION_ID);
      log.debug('about to open visitor Url' + vurl);
      // open visitor window
      await visitor.openAsNew(vurl);

      // Agent window is closed, open new, with a session
      await agent.openAsNew(agentUrl);
      await agent.configureAgentWithJS(config.test_env, VISITOR_SESSION_ID);
      expect(await agent.localVideoStarted()).toBeTruthy();
      await agent.remoteVideoStarted();
      await expect(agent.localvideo.getAttribute('readyState')).toEqual('4');

      // switch to visitor and verify we have local and remote video
      await visitor.switchTo();
      await visitor.localVideoStarted();
      await expect(visitor.localvideo.getAttribute('readyState')).toEqual('4');
      await visitor.remoteVideoStarted();
    });

    it('should make outbound call, and end it from agent', async function () {
      // open agent page
      await agent.openAsNew(agentUrl);
      // config agent without sessionID
      await agent.configureAgentWithJS(config.test_env);
      // check if startVideo clickable
      await agent.startVideoClickable();
      // wait for listeners set
      await browser.sleep(1000);
      // get visitor short url
      await agent.startVideo.click();
      // get visitor short url
      visitorUrl = await agent.getCloudUrl();
      // open visitor page
      await visitor.openAsNew(visitorUrl);

      // switch to agent page and verify we have local and remote video
      await agent.switchTo();
      expect(await agent.localVideoStarted()).toBeTruthy();
      await agent.remoteVideoStarted();
      await expect(agent.localvideo.getAttribute('readyState')).toEqual('4');

      // switch to visitor and verify we have local and remote video
      await visitor.switchTo();
      expect(await visitor.localVideoStarted()).toBeTruthy();
      await visitor.remoteVideoStarted();
      await expect(visitor.localvideo.getAttribute('readyState')).toEqual('4');
    });
  });

  describe('Configured with Params scenarious', function () {
    beforeAll(async function () {
      // get brokerage settings
      const brokerage = await veUtil.getBrokerage();
      // set config from brokerage settings to generate visitor url
      config.test_env.shortUrl = brokerage.shortUrl;
      config.test_env.tennantId = brokerage.tennantId;
      if (brokerage.agentUrl) {
        config.test_env.agentUrl = brokerage.agentUrl;
      }
    });

    beforeEach(async function () {
      // renew visitor id
      VISITOR_SESSION_ID = veUtil.getUUID();
      // generate visitor url using new visitor id
      visitorUrl = visitor.constructUrlC2V(config.test_env, VISITOR_SESSION_ID);
    });

    afterEach(async function () {
      try {
        await agent.switchTo();
        await agent.hangup.click();
        await agent.confirm.click();
        await visitor.close();
      } catch (e) {
        log.error(e.stack);
      }
      // close remaining pages
      Page.closeAllPages();
    });

    it('should make inbound call, agent page loads first', async function () {
      agentUrl = await agent.createAgentUrlWithJS(veUtil.token, config.test_env, VISITOR_SESSION_ID);
      log.debug('about to open agent url:' + agentUrl);
      await agent.openAsNew(agentUrl);

      log.debug('about to open visitor url in a second browser:' + visitorUrl);
      await visitor.openAsNew(visitorUrl);

      // switch to agent page and verify we have local and remote video
      await agent.switchTo();
      expect(await agent.localVideoStarted()).toBeTruthy();
      await agent.remoteVideoStarted();
      await expect(agent.localvideo.getAttribute('readyState')).toEqual('4');

      // switch to visitor and verify we have local and remote video
      await visitor.switchTo();
      expect(await visitor.localVideoStarted()).toBeTruthy();
      await visitor.remoteVideoStarted();
      await expect(visitor.localvideo.getAttribute('readyState')).toEqual('4');
    });

    it('should make inbound call, visitor page loads first', async function () {
      log.debug('about to open visitor url in a second browser:' + visitorUrl);
      await visitor.openAsNew(visitorUrl);

      agentUrl = await agent.createAgentUrlWithJS(veUtil.token, config.test_env, VISITOR_SESSION_ID);
      log.debug('about to open agent url:' + agentUrl);
      await agent.openAsNew(agentUrl);

      // switch to agent page and verify we have local and remote video
      await agent.switchTo();
      expect(await agent.localVideoStarted()).toBeTruthy();
      await agent.remoteVideoStarted();
      await expect(agent.localvideo.getAttribute('readyState')).toEqual('4');

      // switch to visitor and verify we have local and remote video
      await visitor.switchTo();
      expect(await visitor.localVideoStarted()).toBeTruthy();
      await visitor.remoteVideoStarted();
      await expect(visitor.localvideo.getAttribute('readyState')).toEqual('4');
    });

    it('should make outbound call, and end it from agent', async function () {
      // generate pin and conferance id to use in generated visitor url
      const PIN = veUtil.randomDigit(4);
      const CONFERENCE_ID = veUtil.makeid(12);
      // generate agent and visitor urls
      log.debug('about to create visitor shorturl');
      visitorUrl = await veUtil.createVisitorShortUrl(config.test_env, VISITOR_SESSION_ID, CONFERENCE_ID, PIN);
      log.debug('visitor shorturl: ', visitorUrl);
      log.debug('about to create agent shorturl');
      agentUrl = await agent.createAgentUrlWithJS(veUtil.token, config.test_env, VISITOR_SESSION_ID, 'outbound', CONFERENCE_ID, PIN);
      log.debug('agent shorturl: ', agentUrl);
      log.debug('open agent url');

      // open agent page and check preview
      await agent.openAsNew(agentUrl);
      await agent.switchTo();
      await agent.previewVideoStarted();
      // open visitor page
      await visitor.openAsNew(visitorUrl);
      expect(await visitor.shortUrlExpanded()).toBeTruthy();
      // switch to agent page and verify we have local and remote video
      await agent.switchTo();
      expect(await agent.localVideoStarted()).toBeTruthy();
      await agent.remoteVideoStarted();
      await expect(agent.localvideo.getAttribute('readyState')).toEqual('4');

      // switch to visitor and verify we have local and remote video
      await visitor.switchTo();
      expect(await visitor.localVideoStarted()).toBeTruthy();
      await visitor.remoteVideoStarted();
      await expect(visitor.localvideo.getAttribute('readyState')).toEqual('4');
    });
  });
});
