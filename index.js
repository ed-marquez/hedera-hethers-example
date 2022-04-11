console.clear();

require("dotenv").config();
const fs = require("fs");
const { AccountId, PrivateKey } = require("@hashgraph/sdk");
const { hethers } = require("@hashgraph/hethers");

const signerId = AccountId.fromString(process.env.SIGNER_ID);
const signerKey = PrivateKey.fromString(process.env.SIGNER_PVKEY); // TO WORK WITH HETHERS, IT MUST BE ECDSA KEY (FOR NOW)
const aliceId = AccountId.fromString(process.env.ALICE_ID);

const walletAddress = hethers.utils.getAddressFromAccount(signerId);
const aliceAddress = hethers.utils.getAddressFromAccount(aliceId);

async function main() {
	// =============================================================================
	// STEP 1 - INITIALIZE A PROVIDER AND WALLET
	console.log(`\n- STEP 1 ===================================`);

	const provider = hethers.providers.getDefaultProvider("testnet");

	const eoaAccount = {
		account: signerId,
		privateKey: `0x${signerKey.toStringRaw()}`, // Convert private key to short format using .toStringRaw()
	};
	const wallet = new hethers.Wallet(eoaAccount, provider);
	console.log(`\n- Alice's address: ${aliceAddress}`);
	console.log(`\n- Wallet address: ${wallet.address}`);
	console.log(`\n- Wallet public key: ${wallet.publicKey}`);

	const balance = await wallet.getBalance(walletAddress);
	console.log(`\n- Wallet address balance: ${hethers.utils.formatHbar(balance.toString())} hbar`);

	// =============================================================================
	// STEP 2 - DEPLOY THE CONTRACT
	console.log(`\n- STEP 2 ===================================`);

	// Define the contract's properties
	const bytecode = fs.readFileSync("./contractBytecode.bin").toString();
	const abi = [
		"constructor(uint totalSupply)",

		// Read-Only Functions
		"function balanceOf(address owner) view returns (uint256)",
		"function decimals() view returns (uint8)",
		"function symbol() view returns (string)",

		// Authenticated Functions
		"function transfer(address to, uint amount) returns (bool)",

		// Events
		"event Transfer(address indexed from, address indexed to, uint amount)",
	];

	// Create a ContractFactory object
	const factory = new hethers.ContractFactory(abi, bytecode, wallet);

	// Deploy the contract
	const contract = await factory.deploy(100, { gasLimit: 300000 });

	// Transaction sent by the wallet (signer) for deployment - for info
	const contractDeployTx = contract.deployTransaction;

	// Wait until the transaction reaches consensus (i.e. contract is deployed)
	//  - returns the receipt
	//  - throws on failure (the reciept is on the error)
	const contractDeployWait = await contract.deployTransaction.wait();
	console.log(`\n- Contract deployment status: ${contractDeployWait.status.toString()}`);

	// Get the address of the deployed contract
	contractAddress = contract.address;
	console.log(`\n- Contract address: ${contractAddress}`);

	// =============================================================================
	// STEP 3 - INTERACT WITH THE DEPLOYED CONTRACT
	console.log(`\n- STEP 3 ===================================`);

	// Setup a filter and event listener to know when an address receives/sends tokens
	const filter = contract.filters.Transfer(walletAddress, null);

	contract.once(filter, (from, to, amount, event) => {
		console.log(`\n- Event: ${from} sent ${amount} tokens to ${to}`);
	});

	// Call contract functions
	const ercSymbol = await contract.symbol({ gasLimit: 300000 });
	console.log(`\n- ERC20 token symbol: ${ercSymbol}`);

	const ercTransfer = await contract.transfer(aliceAddress, 25, { gasLimit: 300000 });
	console.log(`\n- Transaction ID for ERC20 transfer: ${ercTransfer.transactionId}`);

	const wBalance = await contract.balanceOf(walletAddress, { gasLimit: 300000 });
	const aBalance = await contract.balanceOf(aliceAddress, { gasLimit: 300000 });
	console.log(`\n- Wallet ERC20 token (${ercSymbol}) balance: ${wBalance.toString()}`);
	console.log(`\n- Alice's ERC20 token (${ercSymbol}) balance: ${aBalance.toString()}`);

	console.log(`\n- DONE ===================================`);
}
main();
