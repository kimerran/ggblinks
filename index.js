require("dotenv").config()
const express = require("express")
const puppeteer = require("puppeteer")
const { getMetaTags } = require("./ metatags")
const { extractWallet } = require("./extract-wallet")
const { createSendSolTransaction } = require("./postSendSol")
const path = require("path")
const fs = require("fs")
const NodeCache = require("node-cache")

const {
  ACTIONS_CORS_HEADERS,
  actionCorsMiddleware,
  createPostResponse,
} = require("@solana/actions")

const { composeDetailsFromMetatags } = require("./ metatags")
const { composeDetailsYoutube } = require("./youtube")

const {
  SEND_TOKEN_ADDRESS,
  PYUSD_TOKEN_ADDRESS,
  SKID_TOKEN_ADDRESS,
} = require("./constants")

const { transferSPL } = require("./send-token")

const { BlinksightsClient } = require("blinksights-sdk")
const { composeDetailsTwitter } = require("./twitter")
const client = new BlinksightsClient(process.env.BLINKSIGHTS_ACCESS_TOKEN)

const app = express()

const determinePlatform = (url) => {
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
  if (url.includes("x.com")) {
    return "twitter"
  }
  if (url.includes("twitter.com")) {
    return "twitter"
  }
}

const shortifyWallet = (wallet) => {
  if (wallet && !wallet.includes(".")) {
    const firstFour = wallet.substring(0, 4)
    // Extract the last four characters
    const lastFour = wallet.substring(wallet.length - 4)
    return `${firstFour}..${lastFour}`
  }
  return wallet
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

const tagToDefaultAmount = (ggtag) => {
  let amount = 0.0005 //0.0069
  switch (ggtag) {
    case "send":
      token = 100
      break
    case "pay":
      token = 0.5
      break
    case "skid":
      token = 100
      break
    default:
      token = 0.0005
  }
  return token
}

const tagToToken = (ggtag) => {
  let token = "$SOL"
  switch (ggtag) {
    case "send":
      token = "$SEND"
      break
    case "pay":
      token = "$PYUSD"
      break
    case "skid":
      token = "$SKID"
      break
    default:
      token = "$SOL"
  }
  return token
}

const constructTitle = (url, ggtag, owner) => {
  const platform = determinePlatform(url)

  let token = tagToToken(ggtag)
  // let postType = "Facebook post"

  let poster = owner ? ` by ${owner}` : ""
  if (platform !== "twitter") {
    poster = owner ? ` by ${shortifyWallet(owner)}` : ""
  }
  // 💜
  let title = "GGBlinks"
  switch (platform) {
    case "facebook":
      title = `Send ${token} for this Facebook post${poster}`
      break
    case "youtube":
      title = `Send ${token} for this YouTube video${poster}`
      break
    case "tiktok":
      title = `Send ${token} for this TikTok video${poster}`
      break
    case "twitter":
      title = `Send ${token} for this X post${poster}`
  }
  return title
}

async function main() {
  const myCache = new NodeCache({ stdTTL: 300 })

  const browser = await puppeteer.launch({
    args: ["--no-sandbox"],
    headless: true,
  }) // Set headless: true if you don't want to see the browser
  app.use(actionCorsMiddleware())
  app.use(express.json())

  app.get("/actions.json", (req, res) => {
    const payload = {
      rules: [
        { pathPattern: "/**", apiPath: "/api/**" },
        // { pathPattern: "/api/**", apiPath: "/api/**" },
      ],
    }
    res.json(payload)
  })

  app.get("/robots.txt", (req, res) => {
    const filePath = path.join(__dirname, "public/robots.txt") // Specify the path to your file
    const data = fs.readFileSync(filePath, "utf8")
    res.type("text/plain").send(data)
  })

  app.get("/api/*", async (req, res) => {
    try {
      const url = req.params[0]
      const urlObj = constructUrl(url, req.query)

      // check cache
      const cachedGetResponse = myCache.get(urlObj.toString())
      if (cachedGetResponse) {
        return res.set(ACTIONS_CORS_HEADERS).json(cachedGetResponse)
      }

      const platform = determinePlatform(urlObj.toString())
      let extracted

      switch (platform) {
        case "youtube":
          extracted = await composeDetailsYoutube(urlObj.toString())
          break
        case "twitter":
          extracted = await composeDetailsTwitter(urlObj.toString())
          break
        default:
          extracted = await composeDetailsFromMetatags(
            browser,
            urlObj.toString()
          )
      }

      const title = constructTitle(url, extracted.ggtag, extracted.original)
      const tokenToUse = tagToToken(extracted.ggtag)
      const defaultAmount = tagToDefaultAmount(extracted.ggtag)

      const blinksightsUrl = `https://ggbl.ink/${
        urlObj.toString().split("?")[0]
      }?`
      const payload = await client.createActionGetResponseV1(blinksightsUrl, {
        title: title,
        icon: extracted.icon,
        description: extracted.description,
        disabled: !extracted.wallet,
        links: {
          actions: [
            {
              label: `Send ${defaultAmount} ${tokenToUse} 💜`,
              href: `/api/${req.params[0]}?amount=${defaultAmount}`,
            },
            {
              label: `Send ${tokenToUse} 💜`,
              href: `/api/${req.params[0]}?amount={amount}`,
              parameters: [
                {
                  name: "amount",
                  label: `How many ${tokenToUse}?`,
                  required: true,
                },
              ],
            },
          ],
        },
      })
      myCache.set(urlObj.toString(), payload)
      return res.set(ACTIONS_CORS_HEADERS).json(payload)
    } catch (error) {
      console.error(error.message)
      res.json("error")
    }
  })

  app.post("/api/*", async (req, res) => {
    const { amount, actionId } = req.query
    const { account } = req.body
    const urlObj = constructUrl(req.params[0], req.query)

    // check if already has ?, if yes then just use &
    const blinksightsUrl =
      `https://ggbl.ink/${urlObj.toString().split("?")[0]}` +
      "?amount=" +
      amount +
      "&actionId=" +
      actionId

    try {
      const trackActionPayload = {
        account,
        url: blinksightsUrl,
      }
      await client.trackActionV2(trackActionPayload.account, blinksightsUrl)
    } catch (error) {
      console.error("error on trackActionV2", trackActionPayload)
    }

    const platform = determinePlatform(urlObj.toString())
    let extracted

    switch (platform) {
      case "youtube":
        extracted = await composeDetailsYoutube(urlObj.toString())
        break
      case "twitter":
        extracted = await composeDetailsTwitter(urlObj.toString())
        break
      default:
        extracted = await composeDetailsFromMetatags(browser, urlObj.toString())
    }

    const amountCleaned = amount?.split("?")[0]

    let transaction
    const getActionIdentityInstructionV2 =
      await client.getActionIdentityInstructionV2(account, blinksightsUrl)

    switch (extracted.ggtag) {
      case "send":
        transaction = await transferSPL(
          SEND_TOKEN_ADDRESS,
          account,
          extracted.wallet,
          amountCleaned,
          getActionIdentityInstructionV2
        )
        break
      case "pay":
        transaction = await transferSPL(
          PYUSD_TOKEN_ADDRESS,
          account,
          extracted.wallet,
          amountCleaned,
          getActionIdentityInstructionV2
        )
        break
      case "skid":
        transaction = await transferSPL(
          SKID_TOKEN_ADDRESS,
          account,
          extracted.wallet,
          amountCleaned,
          getActionIdentityInstructionV2
        )
        break
      default:
        transaction = await createSendSolTransaction(
          amountCleaned,
          account,
          extracted.wallet,
          getActionIdentityInstructionV2
        )
    }

    const payload = await createPostResponse({
      fields: {
        transaction,
        message: `Sent to ${extracted.original}`,
      },
    })

    return res.json(payload)
  })

  app.get("/*", (req, res) => {
    if (req.params[0] === "") {
      // read the content of index.html
      const filePath = path.join(__dirname, "public/index.html") // Specify the path to your file
      const data = fs.readFileSync(filePath, "utf8")
      const csp = `
      default-src 'self' 'unsafe-inline';
      script-src 'self' 'unsafe-inline';
      style-src 'self' 'unsafe-inline' data: cdnjs.cloudflare.com fonts.googleapis.com blob: https://fonts.googleapis.com;
      img-src 'self' 'unsafe-inline' data: i.imgur.com imgur.com blob: https://ipfs.dscvr.one https://media.dscvr.one https://medai1.stg.dscvr.one;
      font-src 'self' 'unsafe-inline' data: fonts.gstatic.com fonts.googleapis.com cdnjs.cloudflare.com;
    `.replace(/\s+/g, " ")

      res.setHeader("Content-Security-Policy", csp)

      return res.type("html").send(data)
    }

    res.redirect(req.params[0])
  })

  app.use((err, req, res, next) => {
    console.error(err)
    res.status(500).send("Unexepcted error")
  })

  app.listen(80, () => {
    console.log("listening...")
  })
}
process.on("uncaughtException", (err) => {
  console.error("There was an uncaught error:", err)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason)
})

main()
