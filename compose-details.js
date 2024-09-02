const { IMAGE_DEFAULT } = require("./constants")
const { extractWallet } = require("./extract-wallet")

const composeDetails = async (params) => {
  let { description, icon } = params
  let { walletAddress, original, ggtag } = await extractWallet(description)

  if (description && description?.length > 128) {
    description = description.substring(0, 125) + "🔹"
  }

  description += "\n\n"
  if (!walletAddress) {
    description =
      description +
      "⛔ Unable to determine wallet address on the post. Actions is disabled. "
  }
  description = description + "⚡Powered by GGBlinks (https://ggbl.ink)⚡"

  return {
    description,
    icon: icon || IMAGE_DEFAULT,
    wallet: walletAddress,
    original,
    ggtag,
  }
}

module.exports = {
  composeDetails,
}
