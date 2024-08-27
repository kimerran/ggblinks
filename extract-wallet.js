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
    return;
  }
}

const isSns = async (candidate) => {
  const pubkey = await resolve(connection, candidate.split(".sol")[0])
  return pubkey.toBase58()
}

const isAllDomains = async (candidate) => {
  try {
    if (candidate.includes(".sol")) {
      return await isSns(candidate)
    }
    const parser = new TldParser(connection)
    const pubkey = await parser.getOwnerFromDomainTld(candidate)
    return pubkey.toBase58()
  } catch (error) {}
}

const extractWallet = async (title) => {
  try {
    const regex = /ggme:(.*)!/
    const match = title.match(regex)

    const candidate = match[1]

    console.log('candidate', candidate)

    let walletAddress
    console.log('testing wallet address')
    walletAddress = isPublicKey(candidate)

    if (walletAddress) return walletAddress

    console.log('testing all domains')
    walletAddress = await isAllDomains(candidate)
    if (walletAddress) return walletAddress

    return
  } catch (error) {
    console.log(error)
    return undefined
  }
}

module.exports = {
  extractWallet,
}
