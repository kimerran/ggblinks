const express = require("express")
const puppeteer = require("puppeteer")
const { getMetaTags } = require("./ metatags")
const { extractWallet } = require("./extract-wallet")
const { createSendSolTransaction } = require("./postSendSol")
const path = require("path")
const fs = require("fs")
const {
  ACTIONS_CORS_HEADERS,
  actionCorsMiddleware,
  createPostResponse,
} = require("@solana/actions")

const { composeDetailsFromMetatags } = require("./ metatags")
const { composeDetailsYoutube } = require("./youtube")

const { SEND_TOKEN_ADDRESS, PYUSD_TOKEN_ADDRESS } = require("./constants")

const { transferSPL } = require("./send-token")

const { BlinksightsClient } = require("blinksights-sdk")
const client = new BlinksightsClient(
  "df66eef7b86f5e2f767039327ffe740603ca569024378fd44d19751467abeb56"
)

const app = express()

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
  console.log("shorrify", wallet)
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
    default:
      token = "$SOL"
  }
  return token
}

const constructTitle = (url, ggtag, owner) => {
  const platform = determinePlatform(url)

  let token = tagToToken(ggtag)
  // let postType = "Facebook post"
  let poster = owner ? ` by ${shortifyWallet(owner)}` : ""

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
  }
  return title
}

async function main() {
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
    console.log("req.params", req.params)
    console.log("req.query", req.query)

    try {
      const url = req.params[0]
      const urlObj = constructUrl(url, req.query)
      const platform = determinePlatform(urlObj.toString())
      let extracted

      switch (platform) {
        case "youtube":
          extracted = await composeDetailsYoutube(urlObj.toString())
          break
        default:
          extracted = await composeDetailsFromMetatags(
            browser,
            urlObj.toString()
          )
      }

      console.log("extracted>>>>>", extracted)

      const title = constructTitle(url, extracted.ggtag, extracted.original)
      const tokenToUse = tagToToken(extracted.ggtag)
      const defaultAmount = tagToDefaultAmount(extracted.ggtag)

      const blinksightsUrl = `https://ggbl.ink/${urlObj.toString().split("?")[0]}?`
      const payload = await client.createActionGetResponseV1(blinksightsUrl, {

      // const payload =  {
        title: title,
        icon: extracted.icon,
        description: extracted.description,
        // label: `GG 0.001 SOL`,
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
      return res.set(ACTIONS_CORS_HEADERS).json(payload)
    } catch (error) {
      // console.log(error.message)
      res.json("error")
    }
  })

  app.post("/api/*", async (req, res) => {
    const { amount, actionId } = req.query
    const { account } = req.body

    console.log('req.query', req.query)
    // const actionId = amount.split("?actionId=")[1]

    const urlObj = constructUrl(req.params[0], req.query)
    console.log("urlObj", urlObj.toString())

    // TODO: check if already has ?, if yes then just use &
    const blinksightsUrl = `https://ggbl.ink/${urlObj.toString().split("?")[0]}` + "?amount=" + amount + "&actionId=" + actionId

    console.log("blinksightsUrl", blinksightsUrl)
    try {

      const trackActionPayload = {
        account,
        url: blinksightsUrl,
      }
      console.log('trackActionPayload', trackActionPayload)
      await client.trackActionV2(trackActionPayload.account, blinksightsUrl)
    } catch (error) {
      // console.log(error)
      console.error("error on trackActionV2", trackActionPayload)
    }

    const platform = determinePlatform(urlObj.toString())
    let extracted

    switch (platform) {
      case "youtube":
        extracted = await composeDetailsYoutube(urlObj.toString())
        break
      default:
        extracted = await composeDetailsFromMetatags(
          browser,
          urlObj.toString()
        )
    }

    console.log("extracted>>>>>", extracted)



    console.log("amount", amount)
    console.log("extracted", extracted)
    const amountCleaned = amount?.split("?")[0]

    let transaction
    const getActionIdentityInstructionV2 = await client.getActionIdentityInstructionV2(account, blinksightsUrl)

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
      // note: no additional signers are needed
      // signers: [],
    })

    return res.json(payload)
  })

  app.get("/*", (req, res) => {
    console.log("req.params", req.params)
    console.log("req.query", req.query)

    if (req.params[0] === "") {
      // read the content of index.htmlk
      const filePath = path.join(__dirname, "public/index.html") // Specify the path to your file
      const data = fs.readFileSync(filePath, "utf8")

      res.type("html").send(data)
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
  // Perform any necessary cleanup
  // process.exit(1); // Exit the process with a failure code
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason)
  // Perform any necessary cleanup
  // process.exit(1); // Exit the process with a failure code
})

main()
