
const { browser } = require('protractor');

const config = require('./lib/config');
const log = require('./lib/logger');
log.init(config.logger);

const uuid = require('uuid');

// Import Agent class definition
const Agent = require('./po/agent');
// Create an agent page object
const agent = new Agent();

const Visitor = require('./po/visitor');
const visitor = new Visitor();

const util = require('./lib/common');

describe('Basic video call tests', function () {
  let VISITOR_SESSION_ID;
  let url;
  let visitorUrl;

  beforeAll(function () {
    // Lets prepare some sane settings.
    util.setSafety(true, false); //  Don't obscure view
  });

  describe('Configured with Javascript functions', function () {
    beforeEach(function () {
      VISITOR_SESSION_ID = uuid.v1();
      url = agent.constructUrl(config.test_env);
      visitorUrl = visitor.constructUrlC2V(config.test_env, VISITOR_SESSION_ID);
    });

    afterEach(async function () {
      // browser.manage().logs().get('browser')
      //   .then(browserLog => {
      //     browserLog.forEach(function (message) { log.info(message); });
      //   });

    });

    it('should make inbound call, agent page loads first', async function () {
      // visitor id to be used in both agent and visitor page init
      log.debug('about to open agent url:' + url);
      await agent.openAsNew(url);

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
      await agent.switchTo();
      await agent.hangup.click();
      await agent.confirm.click();

      await visitor.close();
    });

    it('should make inbound call, visitor page loads first', async function () {
      // Test will use different visitor session
      const vurl = visitor.constructUrlC2V(config.test_env, VISITOR_SESSION_ID);
      log.debug('about to open visitor Url' + vurl);
      // open visitor window
      await visitor.openAsNew(vurl);

      // Agent window is closed, open new, with a session
      await agent.openAsNew(url);
      await agent.configureAgentWithJS(config.test_env, VISITOR_SESSION_ID);
      expect(await agent.localVideoStarted()).toBeTruthy();
      await agent.remoteVideoStarted();
      await expect(agent.localvideo.getAttribute('readyState')).toEqual('4');

      // switch to visitor and verify we have local and remote video
      await visitor.switchTo();
      await visitor.localVideoStarted();
      await expect(visitor.localvideo.getAttribute('readyState')).toEqual('4');
      await visitor.remoteVideoStarted();
      await agent.switchTo();
      await agent.hangup.click();
      await agent.confirm.click();
      await visitor.close();
    });

    it('should make outbound call, and end it from agent', async function () {
      // open agent page
      await agent.openAsNew(url);
      // config agent without sessionID
      await agent.configureAgentWithJS(config.test_env);
      // click blue button in agent
      await agent.previewVideoStarted();
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

      await agent.switchTo();
      await agent.hangup.click();
      await agent.confirm.click();

      await visitor.close();
    });
  });

  describe('Configured with Params scenarious', function() {
    beforeEach(function () {
      VISITOR_SESSION_ID = uuid.v1();
      visitorUrl = visitor.constructUrlC2V(config.test_env, VISITOR_SESSION_ID);
    });

    afterEach(async function () {
      await agent.switchTo();
      await agent.hangup.click();
      await agent.confirm.click();
      await visitor.close();
    });

    it('should make inbound call, agent page loads first', async function () {
      url = await agent.createAgentUrlWithJS(config.test_env, VISITOR_SESSION_ID);
      log.debug('about to open agent url:' + url);
      await agent.openAsNew(url);

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
      // Test will use different visitor session
      const vurl = visitor.constructUrlC2V(config.test_env, VISITOR_SESSION_ID);
      log.debug('about to open visitor Url: ' + vurl);
      // open visitor window
      await visitor.openAsNew(vurl);

      // Agent window is closed, open new, with a session
      url = await agent.createAgentUrlWithJS(config.test_env, VISITOR_SESSION_ID);
      log.debug('about to open agent url:' + url);
      await agent.openAsNew(url);

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

    xit('should make outbound call, and end it from agent', async function () {
      url = await agent.createAgentUrlWithJS(config.test_env);
      await agent.openAsNew(url);
      // click blue button in agent
      await agent.switchTo();
      await agent.previewVideoStarted();
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
});
