import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:'**/*.spec.mjs',fullyParallel:true,workers:2,
  reporter:'list',timeout:30000,
  use:{baseURL:'http://127.0.0.1:5174',channel:'chrome',viewport:{width:1440,height:1100},locale:'en-US',timezoneId:'UTC',colorScheme:'light',trace:'retain-on-failure',screenshot:'only-on-failure'},
  expect:{toHaveScreenshot:{maxDiffPixelRatio:0.002,animations:'disabled'}},
  webServer:{command:'python3 -u -m http.server 5174 --bind 127.0.0.1',wait:{stdout:/Serving HTTP on/},timeout:15000,stderr:'ignore'},
});
