import { By } from 'selenium-webdriver';
import assert from 'assert';
import { before, after, describe, it } from 'mocha';
import { signon, signoff } from './lib/libraries-export.mjs';
import { CustomDriver } from './lib/driver-class.mjs';

describe ("Verify Login Actions - Practice Site", () => {
  const customDriver = new CustomDriver();
  const driver = customDriver.driver;

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
