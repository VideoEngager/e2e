const { browser, element, by } = require('protractor');
const veUtil = require('../lib/veUtil');
const Agent = require('./agent');
const until = browser.ExpectedConditions;
const config = require('../lib/config');
const log = require('../lib/logger');
class Genesys extends Agent {
  constructor () {
    super();
    this.genesysIframe = null;
  }

  /**
   * return "Start Video Button" html button element as selemium object
   */
  get startVideoButton () {
    return element(by.id('startVideoButton'));
  }

  /**
   * return "Start Video Session" html button element as selemium object
   */
  get acceptIncomingCallButton () {
    return element(by.id('acceptIncomingCallButton'));
  }

  /**
   * return "Pickup Video Chat" html button element as selemium object
   */
  get acceptClickToVideoButton () {
    return element(by.id('acceptClickToVideoButton'));
  }

  /**
   * get invitation url input as selemiunm object
   */
  get inviteUrl () {
    return element(by.className('invite_url'));
  }

  /**
   * get sendSmsAndInvite btn as selemiunm object
   */
  get sendSmsAndInvite () {
    return element(by.id('sendSmsAndInvite'));
  }

  /**
   * check if "Start Video Session" button is available which starts popup window
   * @returns promise
   */
  async StartVideoSessionAvailable () {
    return browser.wait(until.elementToBeClickable(element(by.id('acceptIncomingCallButton'))), global.TIMEOUT, 'acceptIncomingCallButton does not became available in ' + global.TIMEOUT + 's');
  }

  /**
   * check if "invite for video chat" button is available
   * @returns promise
   */
  async c2vAvailable () {
    return browser.wait(until.elementToBeClickable(element(by.id('startVideoButton'))), global.TIMEOUT, 'startVideoButton does not became available in ' + global.TIMEOUT + 's');
  }

  /**
   * check if "pickup video chat" button is available
   * @returns promise
   */
  async pickupAvailable () {
    return browser.wait(until.elementToBeClickable(element(by.id('acceptClickToVideoButton'))), global.TIMEOUT, 'acceptClickToVideoButton does not became available in ' + global.TIMEOUT + 's');
  }

  /**
   * check if "send sms and Invite" button is available
   * @returns promise
   */
  async sendSmsAndInviteAvailable () {
    return browser.wait(until.elementToBeClickable(element(by.id('sendSmsAndInvite'))), global.TIMEOUT, 'sendSmsAndInvite does not became available in ' + global.TIMEOUT + 's');
  }

  async sendSmsAndInviteInvisible () {
    return browser.wait(until.invisibilityOf(element(by.id('sendSmsAndInvite'))), global.TIMEOUT, 'sendSmsAndInvite does not became invisibile in ' + global.TIMEOUT + 's');
  }

  /**
   * check if agent iframe is created
   * @returns promise
   */
  async iframeCreated () {
    return browser.wait(until.visibilityOf(element(by.id('genesysIframe'))), global.TIMEOUT, 'genesysIframe does not became available in ' + global.TIMEOUT + 's');
  }

  /**
   * check if agent popup is created
   * @returns promise
   */
  async popupCreated (windowsBeforePopup) {
    const windowsAfterPopup = await browser.getAllWindowHandles();
    const popupWindow = windowsAfterPopup.filter(function (window) {
      return windowsBeforePopup.indexOf(window) < 0;
    });
    if (popupWindow.length === 1) {
      const genesysPopup = popupWindow[0];
      const agent = new Agent();
      agent.myHandle = genesysPopup;
      return agent;
    }
    throw new Error('no new popup window');
  }

  /**
   * check if genesys page is authorized by checking hash (#) in the ne of the url
   * genesys page redirects back with hash to genesys page if authorized
   * it saves accessToken to localstorage(puretoken)
   * @param {Object} puretoken check authorize by accessToken
   * @returns promise
   */
  async authorized (puretoken = '') {
    return browser.wait(async function () {
      const url = await browser.getCurrentUrl();
      const localStoragePuretoken = await browser.executeScript('return window.localStorage.getItem("puretoken")');
      if (url && url.substring(url.length - 1, url.length) === '#') {
        log.debug('verify authorize by redirect');
        return true;
      }
      if (localStoragePuretoken === puretoken) {
        log.debug('verify authorize by token in localstorage');
        return true;
      }
      return false;
    }, global.TIMEOUT, 'not authorized in ' + global.TIMEOUT + 's');
  }

  /**
   * construct genesys url with environment, pak and client id for authentication
   * @param {Object} confObject environment configuration object
   * @returns {string} genesys page url
   */
  constructUrl (confObject) {
    let url = confObject.baseURL + '/static/genesys.purecloud.html?';
    const genesysParams = {
      langTag: 'en-us',
      environment: confObject.environment.substring(12),
      interaction: 1,
      pak: confObject.pak,
      clientId: confObject.clientId
    };
    url += veUtil.generateUrlParamters(genesysParams);
    return url;
  }

  /**
   * get genesys app generated visitor url from input
   * @returns {Promise} visitor url as promise
   */
  async getVisitorUrl () {
    return browser.wait(async function () {
      const value = await element(by.className('invite_url')).getAttribute('value');
      if (value !== '') {
        return value;
      }
      return false;
    });
  }

  /**
   * switch to agent iframe
   */
  async switchToIframe () {
    await this.switchTo();
    await browser.switchTo().frame(0);
  }
}
module.exports = Genesys;
