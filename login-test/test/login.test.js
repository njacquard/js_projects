import { Builder, Browser, By } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { path } from 'chromedriver';
import assert from 'assert';
import { before, after, describe, it } from 'mocha';
import { signon, signoff } from './lib/libraries-export.mjs';

describe ("Login Page Test", () => {
  const chromeOptions = new chrome.Options();
  chromeOptions.addArguments('--headless=new');
  const driver = new Builder(path)
    .forBrowser("chrome")
    .setChromeOptions(chromeOptions)
    .build();

  const expectedSuccessMessage = 'Logged In Successfully';
  const expectedFailureMessages = ['Your username is invalid!', 'Your password is invalid!'];
  var actualResultMessage;

  before (async () => {
    let launchURL = 'https://practicetestautomation.com/practice-test-login/';
    await driver.get(launchURL);
  })

  after (async () => {
    driver.quit();
  })

  describe('Verify Successful Login', async () => {
    it('the page should display a success message', async () => {
      await doUserSignon(driver, 'student');
      actualResultMessage = await driver.findElement(By.className('post-title')).getText();
      await assert.deepEqual(actualResultMessage, expectedSuccessMessage);
      await signoff(driver);
    })
  });

  describe('Verify Unsuccessful Login', async () => {
    it('the page should display an error message about incorrect user', async () => {
      await doUserSignon(driver, 'incorrectUser');
      await driver.sleep(250);
      actualResultMessage = await driver.findElement(By.css('#error.show')).getText();
      await assert.deepEqual(actualResultMessage, expectedFailureMessages[0]);
    })

    it('the page should display an error message about incorrect password', async () => {
      await doUserSignon(driver, 'incorrectPwd');
      await driver.sleep(250);
      actualResultMessage = await driver.findElement(By.css('#error.show')).getText();
      await assert.deepEqual(actualResultMessage, expectedFailureMessages[1]);
    })
  });

  async function doUserSignon (driver, user) {
    await signon(driver, user);
    await driver.findElement(By.id('submit')).click();
  }
});
