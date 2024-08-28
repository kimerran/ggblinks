// require('dotenv').config({ path: './.env.local' });

const solanaWeb3 = require("@solana/web3.js")
const splToken = require("@solana/spl-token")
const bs58 = require("bs58")
const { PYUSD_TOKEN_ADDRESS } = require("./constants")

// const TOKEN_PROGRAM_ID = splToken.TOKEN_PROGRAM_ID
// const TOKEN_2022_PROGRAM_ID = splToken.TOKEN_2022_PROGRAM_ID;

const { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } = splToken

// const base58String = process.env.GIVER_PRIVATE_KEY;
const rpcUrl = process.env.SOLANA_RPC_URL
// const senderPrivateKey = process.env.GIVER_PRIVATE_KEY;
// const bonkTokenMintAddress = process.env.TOKEN_MINT_ADDRESS;
const connection = new solanaWeb3.Connection(
  "https://api.mainnet-beta.solana.com",
  "finalized"
)

// const connection = new solanaWeb3.Connection(rpcUrl, 'finalized');

// Function to create a Keypair from a base58 encoded secret key string
const createKeypairFromBase58 = (base58String) => {
  const secretKeyBytes = bs58.decode(base58String)
  return solanaWeb3.Keypair.fromSecretKey(secretKeyBytes)
}

const getAssociatedTokenAddress = async (tokenAddress, ownerAddress) => {
  let programId = TOKEN_PROGRAM_ID
  if (tokenAddress === PYUSD_TOKEN_ADDRESS) {
    console.log("using token 22")
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
  amount
) => {
  const SENDR_ATA = await getAssociatedTokenAddress(
    tokenAddress,
    senderAddress
  )
  const RECVR_ATA = await getAssociatedTokenAddress(
    tokenAddress,
    recipientAddress
  )
  //   const keypair = createKeypairFromBase58(senderPrivateKey);
  console.log("params", {
    SENDR_BONK_ATA: SENDR_ATA,
    RECVR_BONK_ATA: RECVR_ATA,
  })

  let programId = TOKEN_PROGRAM_ID
  if (tokenAddress === PYUSD_TOKEN_ADDRESS) {
    console.log("using token 22")
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

  console.log("amountf", { amount })

  // splToken.createTransferCheckedInstruction

  // const splTransferInstruction = splToken.createTransferInstruction(

  //   const splTransferInstruction = splToken.createTransferCheckedInstruction(
  //     SENDR_BONK_ATA,
  //     RECVR_BONK_ATA,
  //     new solanaWeb3.PublicKey(senderAddress),
  //     Number(amount) * 1_000_000,
  //     [new solanaWeb3.PublicKey(senderAddress)],
  //     programId
  //   )

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
  const messagev0 = new solanaWeb3.TransactionMessage({
    payerKey: new solanaWeb3.PublicKey(senderAddress),
    recentBlockhash: blockhash.blockhash,
    instructions: [
      setComputeUnitInstruction,
      setComputeUnitLimitInstruction,
      createAtaInstruction,
      splTransferInstruction,
    ],
  }).compileToV0Message()

  const transaction = new solanaWeb3.VersionedTransaction(messagev0)
  return transaction

  //   transaction.sign([keypair]);

  //   const signature = await connection.sendTransaction(transaction);
  //   console.log('Transaction Signature:', signature);
  //   return signature;

  // Verify transaction receipt
  // const status = await connection.confirmTransaction({
  //   blockhash: blockhash.blockhash,
  //   lastValidBlockHeight: blockhash.lastValidBlockHeight,
  //   signature: signature,
  //   commitment: 'finalized'
  // });
  // console.log('Transaction Status:', status);
}

module.exports.transferSPL = transferSPL

// async function main() {
//   //   const hasBonkATA = await getAssociatedTokenAddress('CnUZW3CLt3FF38SQHGZWtz3xGYLptYYcPhUZjdwT3cEB');
//   //   console.log(hasBonkATA);

//   transferBONKto('ESKdbZcy1wpbdHyx7LNYMS6mJs91smrA6mk6w649S6QB');
// }

// main();
