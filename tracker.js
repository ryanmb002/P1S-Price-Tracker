#!/usr/bin/env node

const puppeteer = require('puppeteer');
const axios = require('axios');
const cron = require('node-cron');

const bestBuyURL = "https://www.bestbuy.com/site/bambu-lab-p1s-combo-3d-printer-black/6609661.p?skuId=6609661";
const bambuURL = "https://us.store.bambulab.com/products/p1s?id=583855874739507208";
const discordWebhook = process.env.DISCORD_WEBHOOK;

// === CONFIG ===
const runHeadless = false; // false to debug
const checkInterval = "*/15 * * * *"; // every minute

// Store last known status and price
let lastStatus = null;
let lastPrice = null;

// Flag to track if Bambu Lab has been checked before for sample message
let hasCheckedBambuBefore = false;

async function checkP1SStock() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  try {
    // === Check BestBuy stock status ===
    await page.goto(bestBuyURL, {
      waitUntil: "domcontentloaded",
      timeout: 0,
    });

    await page.waitForSelector('[data-testid="customer-price"]', { timeout: 5000 });
    await page.waitForSelector('.add-to-cart-button', { timeout: 5000 });

    const rawPriceBestBuy = await page.$eval('[data-testid="customer-price"]', el => el.innerText.trim());
    const priceMatchBestBuy = rawPriceBestBuy.match(/\$\d+[\.,]?\d*/);
    let priceBestBuy = priceMatchBestBuy ? priceMatchBestBuy[0] : "N/A";
    priceBestBuy = parseFloat(priceBestBuy.replace('$', '').replace(',', '')).toFixed(2); // Ensure two decimal places
    priceBestBuy = `$${priceBestBuy}`;

    // Look for 'Add to Cart' to determine if in stock
    const buttonTextBestBuy = await page.$eval('.add-to-cart-button', el => el.textContent.trim().toLowerCase());
    const isInStockBestBuy = buttonTextBestBuy.includes("add to cart");

    const newStatusBestBuy = isInStockBestBuy ? "in" : "out";

    if (newStatusBestBuy !== lastStatus) {
      lastStatus = newStatusBestBuy;

      const statusTextBestBuy = isInStockBestBuy
        ? `🚨🤩 **BestBuy: Bambu Lab P1S Combo is IN STOCK!**\n💰 Price: **${priceBestBuy}**\n🔗 [Buy Now](${bestBuyURL})`
        : `🚨😢 **BestBuy: Bambu Lab P1S Combo is NOW OUT OF STOCK!**\n💰 Price Was: **${priceBestBuy}**\n🔗 [Link to Store](${bestBuyURL})`;
      await axios.post(discordWebhook, {
        content: `${statusTextBestBuy}`,
      });

      console.log(`[${new Date().toLocaleTimeString()}] 📣 BestBuy status changed — alert sent (${newStatusBestBuy.toUpperCase()}).`);
    } else {
      console.log(`[${new Date().toLocaleTimeString()}] ℹ️ BestBuy — no change in stock status.`);
    }

    // === Add delay before checking Bambu Lab ===
    console.log(`[${new Date().toLocaleTimeString()}] ⏳ Waiting before checking Bambu Lab...`);
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds delay between checks

    // === Check Bambu Lab store price ===
    await page.goto(bambuURL, {
      waitUntil: "domcontentloaded",
      timeout: 0,
    });

    await page.waitForSelector("#info-wrapper > div > div.Product__InfoWrapper > div > div > form > div.ProductMeta > div.\\!mt-3.Heading.flex.items-center.justify-center.md\\:justify-start > div > span", { timeout: 5000 });

    // Extract the price from the specified selector
    const rawPriceBambu = await page.$eval("#info-wrapper > div > div.Product__InfoWrapper > div > div > form > div.ProductMeta > div.\\!mt-3.Heading.flex.items-center.justify-center.md\\:justify-start > div > span", el => el.innerText.trim());
    let priceMatchBambu = rawPriceBambu.match(/\$\d+[\.,]?\d*/);
    let priceBambu = priceMatchBambu ? priceMatchBambu[0] : "N/A";
    priceBambu = parseFloat(priceBambu.replace('$', '').replace(',', '')).toFixed(2); // Ensure two decimal places
    priceBambu = `$${priceBambu}`;

    console.log(`[${new Date().toLocaleTimeString()}] 🌍 Bambu store price: ${priceBambu}`);
    
    // If it's the first time checking Bambu, send a sample message
    if (!hasCheckedBambuBefore) {
      await axios.post(discordWebhook, {
        content: `🚨🙂 **Initial Check: Bambu Lab P1S Combo Price**\n💰 Price: **${priceBambu}**\n🔗 [Buy Now](${bambuURL})`,
      });

      hasCheckedBambuBefore = true;
      console.log(`[${new Date().toLocaleTimeString()}] 📣 Sample price message sent for Bambu Lab P1S Combo.`);
    }

    // Check for price change from lastPrice
    if (lastPrice && priceBambu !== lastPrice) {
        const oldPrice = parseFloat(lastPrice.replace('$', '').replace(',', ''));
        const newPrice = parseFloat(priceBambu.replace('$', '').replace(',', ''));
      
        const emoji = newPrice < oldPrice ? "🤩" : "😢";
        const changeType = newPrice < oldPrice ? "Price Decrease" : "Price Increase";
      
        await axios.post(discordWebhook, {
          content: `🚨 **${changeType}: Bambu Lab P1S Combo** ${emoji}\n💰 New Price: **${priceBambu}**\n🔗 [Buy Now](${bambuURL})`,
        });
      
        console.log(`[${new Date().toLocaleTimeString()}] 📣 Price ${changeType.toLowerCase()} alert sent!`);
      } else if (lastPrice === priceBambu) {
        console.log(`[${new Date().toLocaleTimeString()}] ℹ️ Price unchanged.`);
      }

    // Update the stored price with the latest value
    lastPrice = priceBambu;

  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] ❗ Error checking stock or price:`, err.message);
  } finally {
    await browser.close();
  }
}

checkP1SStock();
cron.schedule(checkInterval, checkP1SStock);
