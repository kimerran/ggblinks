const { Connection, PublicKey } = require("@solana/web3.js")

const { resolve } = require("@bonfida/spl-name-service")
const { TldParser } = require("@onsol/tldparser")

const RPC_URL = "https://api.mainnet-beta.solana.com"
const connection = new Connection(RPC_URL)

const isPublicKey = (candidate) => {
  try {
    new PublicKey(candidate)
    return candidate
  } catch (error) {
    console.log("errorr", error)
    return
  }
}

const isSns = async (candidate) => {
  try {
    const domain = candidate.split(".sol")[0]
    const pubkey = await resolve(connection, domain.toLowerCase())
    return pubkey.toBase58()
  } catch (error) {
    console.log(error)
  }
}

const isAllDomains = async (candidate) => {
  console.log("isAllDomains", candidate)
  try {
    if (candidate.includes(".sol")) {
      return await isSns(candidate)
    }
    const parser = new TldParser(connection)
    const pubkey = await parser.getOwnerFromDomainTld(candidate)
    return pubkey.toBase58()
  } catch (error) {}
}

const tryIfSnsOrAllDomains = async (original) => {
  console.log("in tryIfSnsOrAllDomains", original)
  try {
    const walletAddress = await isAllDomains(original)
    if (walletAddress) return { walletAddress, original }
    return
  } catch (error) {
    console.error(error)
    return
  }
}

const extractWallet = async (titleFromTag) => {
  try {
    const title = titleFromTag.split("!")[0] + "!"
    const regex = /gg(.*):(.*)!/
    const match = title.match(regex)

    if (match) {
      const ggtag = match[1]
      const candidate = match[2]

      let walletAddress
      walletAddress = isPublicKey(candidate)

      if (walletAddress) return { walletAddress, original: candidate, ggtag }
      walletAddress = await isAllDomains(candidate)
      if (walletAddress) return { walletAddress, original: candidate, ggtag }
      return {}
    }

    return {}
  } catch (error) {
    console.error(error)
    return {}
  }
}

module.exports = {
  isSns,
  isAllDomains,
  tryIfSnsOrAllDomains,
  extractWallet,
}
