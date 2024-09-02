// require('dotenv').config({ path: './.env.local' });

const solanaWeb3 = require("@solana/web3.js")
const splToken = require("@solana/spl-token")
const bs58 = require("bs58")
const { PYUSD_TOKEN_ADDRESS } = require("./constants")
const { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } = splToken

const connection = new solanaWeb3.Connection(
  "https://api.mainnet-beta.solana.com",
  "finalized"
)

const getAssociatedTokenAddress = async (tokenAddress, ownerAddress) => {
  let programId = TOKEN_PROGRAM_ID
  if (tokenAddress === PYUSD_TOKEN_ADDRESS) {
    programId = TOKEN_2022_PROGRAM_ID
  }

  return await splToken.getAssociatedTokenAddress(
    new solanaWeb3.PublicKey(tokenAddress),
    new solanaWeb3.PublicKey(ownerAddress),
    false,
    programId
  )
}

const transferSPL = async (
  tokenAddress,
  senderAddress,
  recipientAddress,
  amount,
  blinksightsActionIdentityInstruction
) => {
  const SENDR_ATA = await getAssociatedTokenAddress(tokenAddress, senderAddress)
  const RECVR_ATA = await getAssociatedTokenAddress(
    tokenAddress,
    recipientAddress
  )
  let programId = TOKEN_PROGRAM_ID
  if (tokenAddress === PYUSD_TOKEN_ADDRESS) {
    programId = TOKEN_2022_PROGRAM_ID
  }

  const setComputeUnitInstruction =
    solanaWeb3.ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 200000, // increase as needed
    })

  const setComputeUnitLimitInstruction =
    solanaWeb3.ComputeBudgetProgram.setComputeUnitLimit({
      units: 50000,
    })

  const createAtaInstruction =
    splToken.createAssociatedTokenAccountIdempotentInstruction(
      new solanaWeb3.PublicKey(senderAddress),
      RECVR_ATA,
      new solanaWeb3.PublicKey(recipientAddress),
      new solanaWeb3.PublicKey(tokenAddress),
      programId
    )

  const splTransferInstruction = splToken.createTransferCheckedInstruction(
    SENDR_ATA,
    new solanaWeb3.PublicKey(tokenAddress),
    RECVR_ATA,
    new solanaWeb3.PublicKey(senderAddress),
    Number(amount) * 1_000_000,
    6,
    [new solanaWeb3.PublicKey(senderAddress)],
    programId
  )
  const blockhash = await connection.getLatestBlockhash()
  const tx = new solanaWeb3.TransactionMessage({
    payerKey: new solanaWeb3.PublicKey(senderAddress),
    recentBlockhash: blockhash.blockhash,
    instructions: [
      setComputeUnitInstruction,
      setComputeUnitLimitInstruction,
      createAtaInstruction,
      splTransferInstruction,
    ],
  })

  if (blinksightsActionIdentityInstruction) {
    tx.instructions.push(blinksightsActionIdentityInstruction)
  }
  const messagev0 = tx.compileToV0Message()

  const transaction = new solanaWeb3.VersionedTransaction(messagev0)
  return transaction
}

module.exports.transferSPL = transferSPL
