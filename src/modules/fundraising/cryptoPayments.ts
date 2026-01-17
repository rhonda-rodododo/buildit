/**
 * Crypto Payments Manager
 * Client-side cryptocurrency payment processing for Bitcoin and Ethereum
 *
 * Features:
 * - HD wallet address generation (BIP32/BIP44)
 * - QR code display for payment addresses
 * - Transaction monitoring via public APIs (Blockstream, Etherscan)
 * - ERC-20 token support (USDC, DAI)
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as bip32 from 'bip32';
import * as bip39 from 'bip39';
import * as ecc from 'tiny-secp256k1';
import { HDNodeWallet, JsonRpcProvider, Contract, formatUnits } from 'ethers';
import type {
  CryptoType,
  CryptoNetwork,
  CryptoTransaction,
  CryptoTxStatus,
} from './types';

// Initialize bip32 with secp256k1
const bip32Factory = bip32.BIP32Factory(ecc);

// ============================================================================
// Constants
// ============================================================================

// Bitcoin networks
const BITCOIN_NETWORKS = {
  mainnet: bitcoin.networks.bitcoin,
  testnet: bitcoin.networks.testnet,
};

// Ethereum RPC endpoints (public)
const ETHEREUM_RPC = {
  mainnet: 'https://eth.llamarpc.com',
  testnet: 'https://sepolia.drpc.org', // Sepolia testnet
};

// Blockchain explorer APIs
const BLOCKSTREAM_API = {
  mainnet: 'https://blockstream.info/api',
  testnet: 'https://blockstream.info/testnet/api',
};

const ETHERSCAN_API = {
  mainnet: 'https://api.etherscan.io/api',
  testnet: 'https://api-sepolia.etherscan.io/api',
};

// ERC-20 token addresses
const ERC20_TOKENS = {
  mainnet: {
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    dai: '0x6B175474E89094C44Da98b954EescdeCB5bac1',
  },
  testnet: {
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia USDC
    dai: '0x68194a729C2450ad26072b3D33ADaCbcef39D574', // Sepolia DAI
  },
};

// ERC-20 ABI (minimal for balance checking)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

// HD derivation paths (BIP44)
const DERIVATION_PATHS = {
  bitcoin: {
    mainnet: "m/84'/0'/0'/0", // Native SegWit (bech32)
    testnet: "m/84'/1'/0'/0",
  },
  ethereum: {
    mainnet: "m/44'/60'/0'/0",
    testnet: "m/44'/60'/0'/0", // Same path for testnet
  },
};

// Confirmation requirements
const REQUIRED_CONFIRMATIONS = {
  bitcoin: 3,
  ethereum: 12,
  usdc: 12,
  dai: 12,
};

// ============================================================================
// Wallet Generation
// ============================================================================

/**
 * Generate a new mnemonic seed phrase
 */
export function generateMnemonic(): string {
  return bip39.generateMnemonic(256); // 24 words
}

/**
 * Validate a mnemonic seed phrase
 */
export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

/**
 * Generate Bitcoin address from seed
 */
export function generateBitcoinAddress(
  mnemonic: string,
  network: CryptoNetwork,
  addressIndex: number = 0
): { address: string; derivationPath: string } {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const btcNetwork = BITCOIN_NETWORKS[network];
  const basePath = DERIVATION_PATHS.bitcoin[network];
  const derivationPath = `${basePath}/${addressIndex}`;

  const root = bip32Factory.fromSeed(seed, btcNetwork);
  const child = root.derivePath(derivationPath);

  // Create native SegWit address (bech32)
  const { address } = bitcoin.payments.p2wpkh({
    pubkey: Buffer.from(child.publicKey),
    network: btcNetwork,
  });

  if (!address) {
    throw new Error('Failed to generate Bitcoin address');
  }

  return { address, derivationPath };
}

/**
 * Generate Ethereum address from seed
 */
export function generateEthereumAddress(
  mnemonic: string,
  network: CryptoNetwork,
  addressIndex: number = 0
): { address: string; derivationPath: string } {
  const basePath = DERIVATION_PATHS.ethereum[network];
  const derivationPath = `${basePath}/${addressIndex}`;

  const wallet = HDNodeWallet.fromPhrase(mnemonic, undefined, derivationPath);

  return { address: wallet.address, derivationPath };
}

/**
 * Generate payment address for any supported crypto
 */
export function generatePaymentAddress(
  mnemonic: string,
  cryptoType: CryptoType,
  network: CryptoNetwork,
  addressIndex: number = 0
): { address: string; derivationPath: string } {
  switch (cryptoType) {
    case 'bitcoin':
      return generateBitcoinAddress(mnemonic, network, addressIndex);
    case 'ethereum':
    case 'usdc':
    case 'dai':
      // All Ethereum-based use same address
      return generateEthereumAddress(mnemonic, network, addressIndex);
    default:
      throw new Error(`Unsupported crypto type: ${cryptoType}`);
  }
}

// ============================================================================
// Transaction Monitoring - Bitcoin
// ============================================================================

interface BlockstreamTx {
  txid: string;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
  };
  vin: Array<{
    prevout?: {
      scriptpubkey_address: string;
    };
  }>;
  vout: Array<{
    scriptpubkey_address: string;
    value: number; // satoshis
  }>;
}

interface BlockstreamUtxo {
  txid: string;
  vout: number;
  status: {
    confirmed: boolean;
    block_height?: number;
  };
  value: number;
}

/**
 * Get Bitcoin address balance and transactions
 */
export async function getBitcoinAddressInfo(
  address: string,
  network: CryptoNetwork
): Promise<{
  balance: number; // satoshis
  transactions: BlockstreamTx[];
}> {
  const baseUrl = BLOCKSTREAM_API[network];

  // Get UTXOs for balance
  const utxoResponse = await fetch(`${baseUrl}/address/${address}/utxo`);
  if (!utxoResponse.ok) {
    throw new Error(`Failed to fetch Bitcoin UTXOs: ${utxoResponse.statusText}`);
  }
  const utxos: BlockstreamUtxo[] = await utxoResponse.json();
  const balance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);

  // Get recent transactions
  const txResponse = await fetch(`${baseUrl}/address/${address}/txs`);
  if (!txResponse.ok) {
    throw new Error(`Failed to fetch Bitcoin transactions: ${txResponse.statusText}`);
  }
  const transactions: BlockstreamTx[] = await txResponse.json();

  return { balance, transactions };
}

/**
 * Get Bitcoin transaction details
 */
export async function getBitcoinTransaction(
  txHash: string,
  network: CryptoNetwork
): Promise<BlockstreamTx | null> {
  const baseUrl = BLOCKSTREAM_API[network];

  try {
    const response = await fetch(`${baseUrl}/tx/${txHash}`);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Get current Bitcoin block height
 */
export async function getBitcoinBlockHeight(network: CryptoNetwork): Promise<number> {
  const baseUrl = BLOCKSTREAM_API[network];
  const response = await fetch(`${baseUrl}/blocks/tip/height`);
  if (!response.ok) {
    throw new Error('Failed to fetch block height');
  }
  return parseInt(await response.text(), 10);
}

/**
 * Check for incoming Bitcoin transactions to an address
 */
export async function checkBitcoinIncoming(
  address: string,
  network: CryptoNetwork
): Promise<CryptoTransaction[]> {
  const { transactions } = await getBitcoinAddressInfo(address, network);
  const blockHeight = await getBitcoinBlockHeight(network);

  return transactions
    .filter((tx) => {
      // Filter for incoming transactions (address in outputs)
      const isIncoming = tx.vout.some((out) => out.scriptpubkey_address === address);
      return isIncoming;
    })
    .map((tx) => {
      const output = tx.vout.find((out) => out.scriptpubkey_address === address);
      const amount = output?.value || 0;
      const confirmations = tx.status.confirmed && tx.status.block_height
        ? blockHeight - tx.status.block_height + 1
        : 0;

      let status: CryptoTxStatus = 'pending';
      if (confirmations >= REQUIRED_CONFIRMATIONS.bitcoin) {
        status = 'confirmed';
      } else if (confirmations > 0) {
        status = 'confirming';
      }

      return {
        id: `btc-${tx.txid}`,
        donationId: '', // To be linked later
        campaignId: '', // To be linked later
        cryptoType: 'bitcoin' as CryptoType,
        network,
        txHash: tx.txid,
        fromAddress: tx.vin[0]?.prevout?.scriptpubkey_address,
        toAddress: address,
        amount: amount.toString(),
        amountFormatted: `${(amount / 100000000).toFixed(8)} BTC`,
        confirmations,
        requiredConfirmations: REQUIRED_CONFIRMATIONS.bitcoin,
        status,
        detectedAt: Date.now(),
        confirmedAt: status === 'confirmed' ? Date.now() : undefined,
        blockHeight: tx.status.block_height,
        blockHash: tx.status.block_hash,
      };
    });
}

// ============================================================================
// Transaction Monitoring - Ethereum
// ============================================================================

/**
 * Get Ethereum address balance
 */
export async function getEthereumBalance(
  address: string,
  network: CryptoNetwork
): Promise<{ balance: string; balanceFormatted: string }> {
  const provider = new JsonRpcProvider(ETHEREUM_RPC[network]);
  const balance = await provider.getBalance(address);

  return {
    balance: balance.toString(),
    balanceFormatted: `${formatUnits(balance, 18)} ETH`,
  };
}

/**
 * Get ERC-20 token balance
 */
export async function getERC20Balance(
  address: string,
  tokenType: 'usdc' | 'dai',
  network: CryptoNetwork
): Promise<{ balance: string; balanceFormatted: string; decimals: number }> {
  const provider = new JsonRpcProvider(ETHEREUM_RPC[network]);
  const tokenAddress = ERC20_TOKENS[network][tokenType];
  const contract = new Contract(tokenAddress, ERC20_ABI, provider);

  const [balance, decimals, symbol] = await Promise.all([
    contract.balanceOf(address),
    contract.decimals(),
    contract.symbol(),
  ]);

  return {
    balance: balance.toString(),
    balanceFormatted: `${formatUnits(balance, decimals)} ${symbol}`,
    decimals: Number(decimals),
  };
}

/**
 * Get recent Ethereum transactions for an address using Etherscan API
 * Note: Etherscan API has rate limits, consider caching
 */
export async function getEthereumTransactions(
  address: string,
  network: CryptoNetwork,
  apiKey?: string
): Promise<CryptoTransaction[]> {
  const baseUrl = ETHERSCAN_API[network];
  const params = new URLSearchParams({
    module: 'account',
    action: 'txlist',
    address,
    startblock: '0',
    endblock: '99999999',
    page: '1',
    offset: '20',
    sort: 'desc',
    ...(apiKey && { apikey: apiKey }),
  });

  const response = await fetch(`${baseUrl}?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch Ethereum transactions: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.status !== '1') {
    return []; // No transactions or error
  }

  const provider = new JsonRpcProvider(ETHEREUM_RPC[network]);
  const currentBlock = await provider.getBlockNumber();

  return data.result
    .filter((tx: { to: string }) => tx.to.toLowerCase() === address.toLowerCase())
    .map((tx: {
      hash: string;
      from: string;
      to: string;
      value: string;
      blockNumber: string;
      blockHash: string;
      timeStamp: string;
    }) => {
      const confirmations = currentBlock - parseInt(tx.blockNumber, 10);

      let status: CryptoTxStatus = 'pending';
      if (confirmations >= REQUIRED_CONFIRMATIONS.ethereum) {
        status = 'confirmed';
      } else if (confirmations > 0) {
        status = 'confirming';
      }

      return {
        id: `eth-${tx.hash}`,
        donationId: '',
        campaignId: '',
        cryptoType: 'ethereum' as CryptoType,
        network,
        txHash: tx.hash,
        fromAddress: tx.from,
        toAddress: tx.to,
        amount: tx.value,
        amountFormatted: `${formatUnits(tx.value, 18)} ETH`,
        confirmations,
        requiredConfirmations: REQUIRED_CONFIRMATIONS.ethereum,
        status,
        detectedAt: parseInt(tx.timeStamp, 10) * 1000,
        confirmedAt: status === 'confirmed' ? Date.now() : undefined,
        blockHeight: parseInt(tx.blockNumber, 10),
        blockHash: tx.blockHash,
      };
    });
}

/**
 * Get ERC-20 token transfers for an address
 */
export async function getERC20Transfers(
  address: string,
  tokenType: 'usdc' | 'dai',
  network: CryptoNetwork,
  apiKey?: string
): Promise<CryptoTransaction[]> {
  const baseUrl = ETHERSCAN_API[network];
  const tokenAddress = ERC20_TOKENS[network][tokenType];

  const params = new URLSearchParams({
    module: 'account',
    action: 'tokentx',
    contractaddress: tokenAddress,
    address,
    startblock: '0',
    endblock: '99999999',
    page: '1',
    offset: '20',
    sort: 'desc',
    ...(apiKey && { apikey: apiKey }),
  });

  const response = await fetch(`${baseUrl}?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ERC-20 transfers: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.status !== '1') {
    return [];
  }

  const provider = new JsonRpcProvider(ETHEREUM_RPC[network]);
  const currentBlock = await provider.getBlockNumber();

  return data.result
    .filter((tx: { to: string }) => tx.to.toLowerCase() === address.toLowerCase())
    .map((tx: {
      hash: string;
      from: string;
      to: string;
      value: string;
      tokenDecimal: string;
      tokenSymbol: string;
      blockNumber: string;
      blockHash: string;
      timeStamp: string;
    }) => {
      const decimals = parseInt(tx.tokenDecimal, 10);
      const confirmations = currentBlock - parseInt(tx.blockNumber, 10);

      let status: CryptoTxStatus = 'pending';
      if (confirmations >= REQUIRED_CONFIRMATIONS[tokenType]) {
        status = 'confirmed';
      } else if (confirmations > 0) {
        status = 'confirming';
      }

      return {
        id: `${tokenType}-${tx.hash}`,
        donationId: '',
        campaignId: '',
        cryptoType: tokenType as CryptoType,
        network,
        txHash: tx.hash,
        fromAddress: tx.from,
        toAddress: tx.to,
        amount: tx.value,
        amountFormatted: `${formatUnits(tx.value, decimals)} ${tx.tokenSymbol}`,
        confirmations,
        requiredConfirmations: REQUIRED_CONFIRMATIONS[tokenType],
        status,
        detectedAt: parseInt(tx.timeStamp, 10) * 1000,
        confirmedAt: status === 'confirmed' ? Date.now() : undefined,
        blockHeight: parseInt(tx.blockNumber, 10),
        blockHash: tx.blockHash,
      };
    });
}

// ============================================================================
// Price APIs
// ============================================================================

interface PriceData {
  bitcoin: number;
  ethereum: number;
  usdc: number;
  dai: number;
}

/**
 * Get current crypto prices in USD
 * Uses CoinGecko public API (no API key required)
 */
export async function getCryptoPrices(): Promise<PriceData> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,usd-coin,dai&vs_currencies=usd'
    );

    if (!response.ok) {
      throw new Error('Failed to fetch prices');
    }

    const data = await response.json();

    return {
      bitcoin: data.bitcoin?.usd || 0,
      ethereum: data.ethereum?.usd || 0,
      usdc: data['usd-coin']?.usd || 1,
      dai: data.dai?.usd || 1,
    };
  } catch (error) {
    console.error('Failed to fetch crypto prices:', error);
    // Return fallback prices if API fails
    return {
      bitcoin: 45000,
      ethereum: 2500,
      usdc: 1,
      dai: 1,
    };
  }
}

/**
 * Convert USD to crypto amount
 */
export async function usdToCrypto(
  amountUSD: number,
  cryptoType: CryptoType
): Promise<{ amount: string; formatted: string }> {
  const prices = await getCryptoPrices();
  const price = prices[cryptoType];

  if (price === 0) {
    throw new Error(`No price data for ${cryptoType}`);
  }

  const amount = amountUSD / price;

  let formatted: string;
  switch (cryptoType) {
    case 'bitcoin':
      formatted = `${amount.toFixed(8)} BTC`;
      break;
    case 'ethereum':
      formatted = `${amount.toFixed(6)} ETH`;
      break;
    case 'usdc':
      formatted = `${amount.toFixed(2)} USDC`;
      break;
    case 'dai':
      formatted = `${amount.toFixed(2)} DAI`;
      break;
  }

  return { amount: amount.toString(), formatted };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format satoshis to BTC
 */
export function satoshisToBTC(satoshis: number | string): string {
  const sats = typeof satoshis === 'string' ? parseInt(satoshis, 10) : satoshis;
  return (sats / 100000000).toFixed(8);
}

/**
 * Format wei to ETH
 */
export function weiToETH(wei: string): string {
  return formatUnits(wei, 18);
}

/**
 * Get block explorer URL for transaction
 */
export function getExplorerUrl(
  txHash: string,
  cryptoType: CryptoType,
  network: CryptoNetwork
): string {
  switch (cryptoType) {
    case 'bitcoin':
      return network === 'mainnet'
        ? `https://blockstream.info/tx/${txHash}`
        : `https://blockstream.info/testnet/tx/${txHash}`;
    case 'ethereum':
    case 'usdc':
    case 'dai':
      return network === 'mainnet'
        ? `https://etherscan.io/tx/${txHash}`
        : `https://sepolia.etherscan.io/tx/${txHash}`;
    default:
      return '';
  }
}

/**
 * Validate a Bitcoin address
 */
export function isValidBitcoinAddress(address: string, network: CryptoNetwork): boolean {
  try {
    bitcoin.address.toOutputScript(address, BITCOIN_NETWORKS[network]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate an Ethereum address
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Get crypto type display name
 */
export function getCryptoDisplayName(cryptoType: CryptoType): string {
  switch (cryptoType) {
    case 'bitcoin':
      return 'Bitcoin (BTC)';
    case 'ethereum':
      return 'Ethereum (ETH)';
    case 'usdc':
      return 'USD Coin (USDC)';
    case 'dai':
      return 'DAI Stablecoin';
  }
}

/**
 * Get crypto icon/symbol
 */
export function getCryptoSymbol(cryptoType: CryptoType): string {
  switch (cryptoType) {
    case 'bitcoin':
      return 'BTC';
    case 'ethereum':
      return 'ETH';
    case 'usdc':
      return 'USDC';
    case 'dai':
      return 'DAI';
  }
}
