
const { browser } = require('protractor');
const log = require('./lib/logger');
const config = require('./lib/config');

// Import Agent class definition
const Agent = require('./po/agent');
// Create an agent page object
const agent = new Agent();

const Visitor = require('./po/visitor');
const visitor = new Visitor();

const util = require('./lib/common');

log.init(config.logger);

describe('End 2 End Video Call between agent and visitor C2video', function () {
  const VISITOR_SESSION_ID = '123';
  let url;
  let visitorUrl;

  beforeAll(function () {
    // Lets prepare some sane settings.
    util.setSafety(true, false); //  Don't obscure view
    visitorUrl = visitor.constructUrlC2V(config.test_env, VISITOR_SESSION_ID);
    url = agent.constructUrl(config.test_env);
  });

  afterEach(async function () {
    browser.manage().logs().get('browser')
      .then(browserLog => {
        browserLog.forEach(function (message) { log.info(message); });
      });
    await agent.switchTo();
    await agent.hangup.click();
    await agent.confirm.click();
  });

  it('should make inbound call, and end it from agent', async function () {
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
  });
  it('should make c2v startig with visitor page', async function () {
    // Test will use different visitor session
    const vurl = visitor.constructUrlC2V(config.test_env, '456');
    log.debug('about to open visitor Url' + vurl);
    // reuse visitor window
    await visitor.switchTo();
    await visitor.open(vurl);

    // Agent window is closed, open new, with a session
    await agent.openAsNew(url);
    await agent.configureAgentWithJS(config.test_env, '456');
    expect(await agent.localVideoStarted()).toBeTruthy();
    await agent.remoteVideoStarted();
    await expect(agent.localvideo.getAttribute('readyState')).toEqual('4');
    
    // switch to visitor and verify we have local and remote video
    await visitor.switchTo();
    await visitor.localVideoStarted();
    await expect(visitor.localvideo.getAttribute('readyState')).toEqual('4');
    await visitor.remoteVideoStarted();
  });
});
