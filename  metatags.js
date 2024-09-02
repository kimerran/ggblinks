const { composeDetails } = require("./compose-details")

const getMetaTags = async (browser, url) => {
  const page = await browser.newPage()
  await page.goto(url)
  await page.waitForSelector("meta")

  // Extract meta tags
  const metaTags = await page.evaluate(() => {
    const tags = {}
    document.querySelectorAll("meta").forEach((meta) => {
      // tags[name] =
      // tags.push({
      const name = meta.getAttribute("name") || meta.getAttribute("property")
      const content = meta.getAttribute("content")
      // })
      tags[name] = content
    })
    return tags
  })
  await page.close()
  return metaTags
}

const composeDetailsFromMetatags = async (browser, url) => {
  const metaTags = await getMetaTags(browser, url)
  const params = {
    description: metaTags["twitter:description"],
    icon: metaTags["twitter:image"],
  }
  return await composeDetails(params)
}

module.exports = {
  getMetaTags,
  composeDetailsFromMetatags,
}
