const puppeteer = require("puppeteer");
const fs = require("fs");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
  });
  const page = await browser.newPage();

  try {
    // Set up CSV writer
    const csvWriter = createCsvWriter({
      path: "capterra_data.csv",
      header: [
        { id: "url", title: "Website URL" },
        { id: "categoryName", title: "Category Name" },
        { id: "h5Text", title: "H5 Text" },
      ],
    });

    await page.goto("https://www.capterra.in/directory", {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    // Extract links and category names
    const linksAndNames = await page.evaluate(() => {
      const categoryList = document.getElementById("categories_list");
      if (!categoryList) return [];
      const anchorElements = Array.from(
        categoryList.querySelectorAll("a")
      ).slice(0, 5);
      return Array.from(anchorElements).map((a) => ({
        href: a.href,
        categoryName: a.textContent.trim(),
      }));
    });

    if (linksAndNames.length === 0) {
      console.log("No links found under #categories_list");
      await browser.close();
      return;
    }

    console.log(`Found ${linksAndNames.length} links. Starting to scrape...`);
    const csvData = [];

    for (const { href, categoryName } of linksAndNames) {
      try {
        const url = new URL(href);
        console.log(`Navigating to: ${url.href}`);
        await page.goto(url.href, {
          waitUntil: "networkidle0",
          timeout: 30000,
        });

        // Scrape h5 texts
        const h5Texts = await page.evaluate(() => {
          const elements = Array.from(
            document.querySelectorAll(".h5.m-0")
          ).filter((el) => el.classList.length === 2);
          return Array.from(elements).map((el) => {
            const match = el.textContent.trim().match(/\d+/); // Extracts the first number in the string
            if (match) {
              const number = match[0]; // Access the matched number
              return number;
            } else {
              console.log("No number found"); // Handles cases where no number is present
            }
          });
        });

        // Add each h5 text as a separate row with the same URL and category
        h5Texts.forEach((h5Text) => {
          csvData.push({
            url: url.href,
            categoryName: categoryName,
            h5Text: h5Text,
          });
        });
      } catch (linkError) {
        console.error(`Error processing link ${href}:`, linkError.message);
        continue;
      }
    }

    // Write to CSV
    await csvWriter.writeRecords(csvData);
    console.log("CSV file has been created successfully");
  } catch (error) {
    console.error("Error occurred:", error);
  } finally {
    await browser.close();
  }
})();
