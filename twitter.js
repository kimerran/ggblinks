require("dotenv").config()
const { TwitterApi } = require("twitter-api-v2")
const { tryIfSnsOrAllDomains, isAllDomains } = require("./extract-wallet")
const NodeCache = require("node-cache")

const {
  TWITTER_API_APP_KEY,
  TWITTER_API_APP_SECRET,
  TWITTER_API_ACCESS_TOKEN,
  TWITTER_API_ACCESS_SECRET,
  TWITTER_API_BEARER_TOKEN,
} = process.env

const client = new TwitterApi({
  appKey: TWITTER_API_APP_KEY,
  appSecret: TWITTER_API_APP_SECRET,
  accessToken: TWITTER_API_ACCESS_TOKEN,
  accessSecret: TWITTER_API_ACCESS_SECRET,
  bearerToken: TWITTER_API_BEARER_TOKEN,
})

const twitterApiCache = new NodeCache({ stdTTL: 10800 })

const getPostIdFromUrl = (url) => {
  // Regular expression to match X post URLs
  const xPostUrlRegex = /x\.com\/(?:[^/]+\/)?status\/(\d+)/i

  // Try to match the URL with the regex
  const match = url.match(xPostUrlRegex)

  if (match?.[1]) {
    return match[1]
  }
  return "No X post ID found in the URL."
}

const getPostDetails = async (postId) => {
  const cachedPost = twitterApiCache.get(`post:${postId}`)
  if (cachedPost) {
    return cachedPost
  }
  const tweet = await client.v2.singleTweet(postId, {
    "tweet.fields": [
      "author_id",
      "created_at",
      "public_metrics",
      "attachments",
    ],
    expansions: ["attachments.media_keys"],
    "media.fields": [
      "duration_ms",
      "height",
      "width",
      "preview_image_url",
      "type",
      "url",
    ],
  })
  twitterApiCache.set(`post:${postId}`, tweet)
  return tweet
}

const getUserDetails = async (userId) => {
  const cachedUser = twitterApiCache.get(`user:${userId}`)
  if (cachedUser) {
    return cachedUser
  }
  const user = await client.v2.user(userId, {
    "user.fields": [
      "created_at",
      "description",
      "location",
      "public_metrics",
      "profile_image_url",
    ],
  })
  twitterApiCache.set(`user:${userId}`, user.data)
  return user.data
}

const extractDomain = (text) => {
  const domainRegex =
    /((?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6})/
  const match = text.match(domainRegex)
  return match ? match[0] : null
}

const extractPartBetween = (text, start, end) => {
  const regex = new RegExp(`${start}(.*?)${end}`)
  const match = text.match(regex)
  return match ? match[1] : null
}

const getOwnerWallet = async (authorId) => {
  const userProfile = await getUserDetails(authorId)

  const { name, description } = userProfile
  console.log("profile", userProfile)
  let walletAddress = ""

  // check if name is a .sol or allDomains domain
  const domain = extractDomain(name)
  console.log("extracted domain", domain)
  if (domain) {
    walletAddress = await tryIfSnsOrAllDomains(domain)
  }
  console.log("tryIfSnsOrAllDomains", walletAddress)

  // if this is still null, check the description
  if (!walletAddress) {
    const candidateInDesc = extractPartBetween(description, "ggme:", "!")
    walletAddress = await tryIfSnsOrAllDomains(candidateInDesc)
  }
  console.log("in desc", walletAddress)

  // if there's is still none, then we probably want to catch it or disable
  if (!walletAddress) {
    walletAddress = await isAllDomains("k1merran.sol")
  }

  console.log("getOwnerwallet", walletAddress)
  return { wallet: walletAddress, userProfile }
}

const composeDetailsTwitter = async (url) => {
  try {
    const postId = getPostIdFromUrl(url)
    const post = await getPostDetails(postId)

    // retrieve the wallet or sns or alldomains via the
    const { wallet, userProfile } = await getOwnerWallet(post.data.author_id)

    let icon
    const media = post?.includes?.media
      .filter((m) => m.preview_image_url)
      .shift()

    if (media) {
      icon = media.preview_image_url
    }
    if (!icon) {
      const xx = userProfile.profile_image_url.split("_normal")
      const enlargedProfile = xx[0] + xx[1]
      icon = enlargedProfile
    }

    //https://pbs.twimg.com/profile_images/1749855163383468032/3YYg5Vim_normal.jpg

    return {
      description: post.data.text,
      icon,
      wallet,
      original: userProfile.name,
      ggtag: "ggme",
    }
  } catch (error) {
    console.error(error)
  }
}

module.exports = {
  composeDetailsTwitter,
}
