const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  ComputeBudgetProgram,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
} =  require("@solana/web3.js")

const connection = new Connection(clusterApiUrl("mainnet-beta"))

const createSendSolTransaction = async (amount, from, to, blinksightsActionIdentityInstruction) => {
    console.log('create send sol tx', {
        amount,
        from,
        to
    })


    const fromPubkey = new PublicKey(from);
    const toPubkey = new PublicKey(to)
    const minimumBalance = await connection.getMinimumBalanceForRentExemption(0)

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash()

    const setComputeLimit = ComputeBudgetProgram.setComputeUnitLimit({
        units: 1_000_000, // Requesting 1,000,000 compute units
    })

    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 10000,
    })

    const transferSolInstruction = SystemProgram.transfer({
        fromPubkey: fromPubkey,
        toPubkey: toPubkey,
        lamports: Number(amount) * LAMPORTS_PER_SOL,
      });

  const transaction = new Transaction({
    feePayer: fromPubkey,
    blockhash,
    lastValidBlockHeight,
  })

  transaction.add(setComputeLimit)
  transaction.add(addPriorityFee)
  transaction.add(transferSolInstruction)
  transaction.add(blinksightsActionIdentityInstruction)

  return transaction;
}

module.exports = {
  createSendSolTransaction,
}
