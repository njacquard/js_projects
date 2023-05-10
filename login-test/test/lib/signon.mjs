import { Builder, By, Key, Capabilities } from "selenium-webdriver";
import "chromedriver";

//:Purpose
//  launch a new chrome session and log in to site
//
//:Arguments
//  |0: selenium-webdriver
//  |1: signon user
//
//:Local Variables
//  driver: selenium-webdriver
//  user: signon user's info ("name". "pwd")
//
//:Returns
// unimportant
async function signon(driver, user) {
    let foundUser = getUserInfo(user);
    await authenticate(driver, foundUser.name, foundUser.pwd);
}

//:Purpose
//  get the given user's password
//
//:Arguments
//  |0: authenticate user
//
//:Local Variables
//  pwdMap: Map object of user information
//                key: user
//                value: user info Object ("name", "pwd")
//  user: authenticate user's info ("name". "pwd")
//
//:Returns
// user info Object
function getUserInfo(user) {
    const pwdMap = new Map([
        // User/Password can also be environment variables and would need to be injected at runtime (CREDS_USR & CREDS_PSW)
        // { name: process.env.CREDS_USR, pwd: process.env.CREDS_PSW }
        ["student", { name: "student", pwd: "Password123" }],
        ["incorrectUser", { name: "incorrectUser", pwd: "Password123" }],
        ["incorrectPwd", {name: "student", pwd: "incorrectPassword" }]
    ]);
    return pwdMap.get(user);
}

//:Purpose
// send authenticated user credentials to user/pass fields
//
//:Arguments
//  |0: selenium-webdriver
//  |1: user
//  |2: password
//
//:Local Variables
//
//:Returns
// unimportant
async function authenticate(driver, user, pwd) {
   await driver.findElement(By.id("username")).sendKeys(user);
   await driver.findElement(By.id("password")).sendKeys(pwd);
}

//:Purpose
// sign out of login
//
//:Arguments
//  |0: selenium-webdriver
//
//:Local Variables
//
//:Returns
// unimportant
async function signoff(driver) {
    await driver.findElement(By.css(".wp-block-button__link")).click();
}

export {
    signon,
    signoff
}