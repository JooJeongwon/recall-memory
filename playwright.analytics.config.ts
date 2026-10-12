import {defineConfig} from '@playwright/test';
import checkpoints from './playwright.checkpoints.config';
export default defineConfig({...checkpoints,testMatch:'qr-analytics.spec.ts'});
