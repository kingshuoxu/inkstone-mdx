import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./diagnostics',testMatch:'profile.spec.js',workers:1,use:{baseURL:'http://127.0.0.1:4174',viewport:{width:1440,height:960},trace:'off'},webServer:{command:'npx vite preview --host 127.0.0.1 --port 4174',url:'http://127.0.0.1:4174'},reporter:'list'});
