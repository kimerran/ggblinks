const express = require("express")
const puppeteer = require("puppeteer")
const { getMetaTags } = require("./ metatags")
const { createSendSolTransaction } = require("./postSendSol")

const {
  ACTIONS_CORS_HEADERS,
  actionCorsMiddleware,
  createPostResponse
} = require("@solana/actions")
const app = express()

const IMAGE_DEFAULT =
  "https://pbs.twimg.com/media/GVymlzra8AIARGS?format=jpg&name=medium"

const extractWallet = (title) => {
  try {
    const regex = /(ggme:)([a-zA-Z0-9]+)!/
    const match = title.match(regex)
    return match[2]
  } catch (error) {
    return undefined
  }
}

const extractDetailsFromMetatags = (url, metaTags) => {
  // facebook.com, youtube.com, tiktok.com
  //
  let title = metaTags["twitter:description"]
  let icon = metaTags["twitter:image"] || IMAGE_DEFAULT
  let wallet = extractWallet(title)

  if (title.length > 48) {
    title = title.substring(0, 45) + "..."
  }

  title = title + " (Powered by GGBlinks - Create yours now at ggbl.ink)"

  if (!wallet) {
    title =
      title +
      " ***Unable to determine wallet address on the post. Actions is disabled***"
  }

  return {
    title,
    icon,
    wallet,
  }
}

const determinePlatform = (url) => {
  console.log("determining platform", url)
  if (url.includes("facebook")) {
    return "facebook"
  }
  if (url.includes("youtube")) {
    return "youtube"
  }
  if (url.includes("youtu")) {
    return "youtube"
  }
  if (url.includes("tiktok")) {
    return "tiktok"
  }
}

const shortifyWallet = (wallet) => {
  if (wallet) {
    const firstFour = wallet.substring(0, 4)
    // Extract the last four characters
    const lastFour = wallet.substring(wallet.length - 4)
    return ` by ${firstFour}..${lastFour}`
  }
  return ``
}

const constructUrl = (url, query) => {
  // const url = req.params[0]
  const urlObj = new URL(url)

  if (query) {
    for (const key in query) {
      urlObj.searchParams.append(key, query[key])
    }
  }
  return urlObj
}

async function main() {
  const browser = await puppeteer.launch({ headless: true }) // Set headless: true if you don't want to see the browser
  app.use(actionCorsMiddleware())
  app.use(express.json())
  app.get("/", (req, res) => {
    res.json("homepage")
  })

  app.get("/actions.json", (req, res) => {
    const payload = {
      rules: [
        { pathPattern: "/**", apiPath: "/api/**" },
        // { pathPattern: "/api/**", apiPath: "/api/**" },
      ],
    }
    res.json(payload)
  })

  app.get("/api/*", async (req, res) => {
    console.log("req.params", req.params)
    console.log("req.query", req.query)

    try {
      const url = req.params[0]
      const urlObj = constructUrl(url, req.query)

      const metaTags = await getMetaTags(browser, urlObj.toString())
      const extracted = extractDetailsFromMetatags(url, metaTags)

      console.log("metaTags", metaTags)

      const platform = determinePlatform(url)
      console.log("platform", platform)

      let title = "GGBlinks"
      switch (platform) {
        case "facebook":
          title = `Facebook post${shortifyWallet(extracted.wallet)} (ggbl.ink)`
          break
        case "youtube":
          title = `YouTube video${shortifyWallet(extracted.wallet)} (ggbl.ink)`
          break
        case "tiktok":
          title = `TikTok video by${shortifyWallet(
            extracted.wallet
          )} (ggbl.ink)`
          break
      }

      const payload = {
        title: title,
        icon: extracted.icon,
        description: extracted.title,
        // label: `GG 0.001 SOL`,
        disabled: !extracted.wallet,
        links: {
          actions: [
            {
              label: `GG 0.001 SOL`,
              href: `/api/${req.params[0]}?amount=${0.001}`,
            },
            {
              label: `GG SOL`,
              href: `?amount={amount}`,
              parameters: [
                {
                  name: "amount",
                  label: "How many SOL",
                  required: true,
                },
              ],
            },
          ],
        },
      }
      return res.set(ACTIONS_CORS_HEADERS).json(payload)
    } catch (error) {
      console.log(error.message)
      res.json("error")
    }
  })

  app.post("/api/*", async (req, res) => {
    const { amount } = req.query;
    const { account } = req.body;

    const urlObj = constructUrl(req.params[0], req.query)

    const metaTags = await getMetaTags(browser, urlObj.toString())
    const extracted = extractDetailsFromMetatags(req.params[0], metaTags)

    console.log("metaTags", metaTags)

    const transaction = await createSendSolTransaction(amount, account, extracted.wallet);
    const payload = await createPostResponse({
      fields: {
        transaction,
        message: `Sent ${amount} to ${extracted.wallet}`,
      },
      // note: no additional signers are needed
      // signers: [],
    })
    return res.json(payload);
  })

  app.get("/*", (req, res) => {
    console.log("req.params", req.params)
    console.log("req.query", req.query)
    res.redirect(req.params[0])
  })

  app.listen(3000, () => {
    console.log("listening...")
  })
}

main()
