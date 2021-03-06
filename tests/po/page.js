const { browser } = require('protractor');
const assert = require('assert');
const config = require('../lib/config');
const log = require('../lib/logger');
 
module.exports = class Page {
  // Parent page handle, to workaround webdriver 'already closed'
  // we will always switch to parent before opening new windows
  static parentHandle = "";
  
  constructor() {
    // Instance browser handle
    this.myHandle = "";
  };
  
  switchTo = async function () {
    await browser.switchTo().window(this.myHandle);
  };

  close = async function () {
    assert(this.myHandle);
    try {
      await this.switchTo();
      await browser.close();
      // wait after browser close
      await browser.sleep(500);
    } catch(NoSuchWindowError) {

    };
    this.myHandle = '';
  };

  open = async function (url) {
    browser.waitForAngularEnabled(false);
    await browser.get(url);
    const handle = await browser.getWindowHandle();
    this.myHandle = handle;
  };

  openAsNew = async function (url) {
    if(this.myHandle)
      await this.close();
    browser.waitForAngularEnabled(false);
    if(Page.parentHandle) {
      this.myHandle = Page.parentHandle;
      await this.switchTo();
    } 
    await browser.executeScript('window.open()');

    const windows = await browser.getAllWindowHandles();
    Page.parentHandle = windows[0];
    this.myHandle = windows[windows.length - 1];
    await this.switchTo();
    await this.open(url);
  }

  static closeAllPages = async function () {
    const windows = await browser.getAllWindowHandles();
    for (let i = 0; i < windows.length; i++) {
      await browser.switchTo().window(windows[i]);
      const url = await browser.getCurrentUrl();
      if (url === 'data:,') {
        continue;
      }
      log.error('forced to close page url: ' + url);
      try {
        await browser.close()
      } catch (e) {
        log.error(e.message);
      }
      ;
    }
  }
}

