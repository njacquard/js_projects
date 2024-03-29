import { Builder, WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { path } from 'chromedriver';

//:Purpose
//  Constructor for the Driver class
//  Driver extends WebDriver class
//
//:Arguments
//  |0: headless flag (true/false)
//
//:Local Variables
//  chromeOptions: chrome options
//  this.driver: selenium-webdriver
//
//:Local Functions
//  super(): super constructor from WebDriver
//
//:Returns
// unimportant

export class CustomDriver extends WebDriver {
    
    constructor (notHeadless) {
        super();
        const chromeOptions = new chrome.Options();
        if (!notHeadless) {
            chromeOptions.addArguments('--headless=new');
        }
        chromeOptions.addArguments('--no-sandbox');
        chromeOptions.addArguments('--disable-dev-shm-usage');

        this.driver = new Builder(path)
          .forBrowser("chrome")
          .setChromeOptions(chromeOptions)
          .build();
    }
}