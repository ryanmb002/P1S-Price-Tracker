#!/usr/bin/env node

const puppeteer = require('puppeteer');
const axios = require('axios');
const cron = require('node-cron');

const bestBuyURL = "https://www.bestbuy.com/site/bambu-lab-p1s-combo-3d-printer-black/6609661.p?skuId=6609661";
const bambuURL = "https://us.store.bambulab.com/products/p1s?id=583855874739507208";
const discordWebhook = process.env.DISCORD_WEBHOOK;

// === CONFIG ===
const runHeadless = true;
const checkInterval = "*/15 * * * *"; // every 15 minutes

// State initialization
let lastStatusBestBuy = null;
let lastStatusBambu = null;
let lastPriceBestBuy = null;
let lastPriceBambu = null;
let hasCheckedBestBuyBefore = false;
let hasCheckedBambuBefore = false;

async function checkP1SStock() {
  const browser = await puppeteer.launch({
    headless: runHeadless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  try {
    // === Check BestBuy ===
    await page.goto(bestBuyURL, { waitUntil: "domcontentloaded", timeout: 0 });
    await page.waitForSelector('[data-testid="customer-price"]', { timeout: 5000 });
    await page.waitForSelector('.add-to-cart-button', { timeout: 5000 });

    const rawPriceBestBuy = await page.$eval('[data-testid="customer-price"]', el => el.innerText.trim());
    const priceMatchBestBuy = rawPriceBestBuy.match(/\$\d+[\.,]?\d*/);
    let priceBestBuy = priceMatchBestBuy ? priceMatchBestBuy[0] : "N/A";
    priceBestBuy = parseFloat(priceBestBuy.replace('$', '').replace(',', '')).toFixed(2);
    priceBestBuy = `$${priceBestBuy}`;

    const buttonTextBestBuy = await page.$eval('.add-to-cart-button', el => el.textContent.trim().toLowerCase());
    const isInStockBestBuy = buttonTextBestBuy.includes("add to cart");

    const newStatusBestBuy = isInStockBestBuy ? "in" : "out";

    if (newStatusBestBuy !== lastStatusBestBuy) {
      lastStatusBestBuy = newStatusBestBuy;

      const statusText = isInStockBestBuy
        ? `🚨🤩 **BestBuy: P1S Combo is now IN STOCK!**\n💰 Price: **${priceBestBuy}**\n🔗 [Buy Now](${bestBuyURL})`
        : `🚨😢 **BestBuy: P1S Combo is now OUT OF STOCK!**\n💰 Price Was: **${priceBestBuy}**\n🔗 [Link to Store](${bestBuyURL})`;

      await axios.post(discordWebhook, { content: statusText });
      console.log(`[${new Date().toLocaleTimeString()}] 📣 BestBuy status changed — alert sent (${newStatusBestBuy.toUpperCase()}).`);
    } else {
      console.log(`[${new Date().toLocaleTimeString()}] ℹ️ BestBuy — no change in stock status.`);
    }

    // === BestBuy: Initial Check & Price Alerts ===
    if (!hasCheckedBestBuyBefore) {
      await axios.post(discordWebhook, {
        content: `🚨🙂 **BestBuy: P1S Combo Initial Check**\n💰 Price: **${priceBestBuy}**\n🔗 [Buy Now](${bestBuyURL})`,
      });

      hasCheckedBestBuyBefore = true;
      console.log(`[${new Date().toLocaleTimeString()}] 📣 Sample price message sent for BestBuy P1S Combo.`);
    }

    if (lastPriceBestBuy && priceBestBuy !== lastPriceBestBuy) {
      const oldPrice = parseFloat(lastPriceBestBuy.replace('$', '').replace(',', ''));
      const newPrice = parseFloat(priceBestBuy.replace('$', '').replace(',', ''));

      const emoji = newPrice < oldPrice ? "🤩" : "😢";
      const changeType = newPrice < oldPrice ? "Price Decrease" : "Price Increase";

      await axios.post(discordWebhook, {
        content: `🚨${emoji} **BestBuy: ${changeType} for P1S Combo** \n💰 New Price: **${priceBestBuy}**\n🔗 [Buy Now](${bestBuyURL})`,
      });

      console.log(`[${new Date().toLocaleTimeString()}] 📣 BestBuy price ${changeType.toLowerCase()} alert sent!`);
    } else if (lastPriceBestBuy === priceBestBuy) {
      console.log(`[${new Date().toLocaleTimeString()}] ℹ️ BestBuy price unchanged.`);
    }

    lastPriceBestBuy = priceBestBuy;

    // === Delay before checking Bambu ===
    console.log(`[${new Date().toLocaleTimeString()}] ⏳ Waiting before checking Bambu Lab...`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // === Check Bambu ===
    await page.goto(bambuURL, { waitUntil: "domcontentloaded", timeout: 0 });
    await page.waitForSelector("#info-wrapper span", { timeout: 5000 });

    const rawPriceBambu = await page.$eval("#info-wrapper span", el => el.innerText.trim());
    const priceMatchBambu = rawPriceBambu.match(/\$\d+[\.,]?\d*/);
    let priceBambu = priceMatchBambu ? priceMatchBambu[0] : "N/A";
    priceBambu = parseFloat(priceBambu.replace('$', '').replace(',', '')).toFixed(2);
    priceBambu = `$${priceBambu}`;

    console.log(`[${new Date().toLocaleTimeString()}] 🌍 Bambu store price: ${priceBambu}`);

    if (!hasCheckedBambuBefore) {
      await axios.post(discordWebhook, {
        content: `🚨🙂 **Bambu Lab: P1S Combo Initial Check**\n💰 Price: **${priceBambu}**\n🔗 [Buy Now](${bambuURL})`,
      });

      hasCheckedBambuBefore = true;
      console.log(`[${new Date().toLocaleTimeString()}] 📣 Sample price message sent for Bambu Lab P1S Combo.`);
    }

    if (lastPriceBambu && priceBambu !== lastPriceBambu) {
      const oldPrice = parseFloat(lastPriceBambu.replace('$', '').replace(',', ''));
      const newPrice = parseFloat(priceBambu.replace('$', '').replace(',', ''));

      const emoji = newPrice < oldPrice ? "🤩" : "😢";
      const changeType = newPrice < oldPrice ? "Price Decrease" : "Price Increase";

      await axios.post(discordWebhook, {
        content: `🚨${emoji} **Bambu Lab: ${changeType} for P1S Combo** \n💰 New Price: **${priceBambu}**\n🔗 [Buy Now](${bambuURL})`,
      });

      console.log(`[${new Date().toLocaleTimeString()}] 📣 Bambu Lab price ${changeType.toLowerCase()} alert sent!`);
    } else if (lastPriceBambu === priceBambu) {
      console.log(`[${new Date().toLocaleTimeString()}] ℹ️ Bambu Lab price unchanged.`);
    }

    lastPriceBambu = priceBambu;

  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] ❗ Error checking stock or price:`, err.message);
  } finally {
    await browser.close();
  }
}

// Run once at start
checkP1SStock();

// Schedule recurring checks
cron.schedule(checkInterval, checkP1SStock);
