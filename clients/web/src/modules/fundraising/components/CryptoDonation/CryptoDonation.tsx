/**
 * CryptoDonation Component
 * UI for cryptocurrency donations with QR codes and transaction monitoring
 */

import { FC, useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import {
  generatePaymentAddress,
  generateMnemonic,
  getCryptoPrices,
  usdToCrypto,
  checkBitcoinIncoming,
  getEthereumTransactions,
  getERC20Transfers,
  getExplorerUrl,
  getCryptoDisplayName,
  getCryptoSymbol,
} from '../../cryptoPayments';
import type { CryptoType, CryptoNetwork, CryptoTransaction } from '../../types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Wallet,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

interface CryptoDonationProps {
  campaignId: string;
  defaultAmountUSD?: number;
  network?: CryptoNetwork;
  onPaymentDetected?: (transaction: CryptoTransaction) => void;
  onPaymentConfirmed?: (transaction: CryptoTransaction) => void;
  className?: string;
}

interface PriceData {
  bitcoin: number;
  ethereum: number;
  usdc: number;
  dai: number;
}

const CRYPTO_OPTIONS: { value: CryptoType; label: string; icon: string }[] = [
  { value: 'bitcoin', label: 'Bitcoin (BTC)', icon: '₿' },
  { value: 'ethereum', label: 'Ethereum (ETH)', icon: 'Ξ' },
  { value: 'usdc', label: 'USD Coin (USDC)', icon: '$' },
  { value: 'dai', label: 'DAI Stablecoin', icon: '◈' },
];

export const CryptoDonation: FC<CryptoDonationProps> = ({
  campaignId,
  defaultAmountUSD = 25,
  network = 'mainnet',
  onPaymentDetected,
  onPaymentConfirmed,
  className,
}) => {
  const { t } = useTranslation();

  // State
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoType>('bitcoin');
  const [amountUSD, setAmountUSD] = useState(defaultAmountUSD);
  const [cryptoAmount, setCryptoAmount] = useState<string>('');
  const [paymentAddress, setPaymentAddress] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [prices, setPrices] = useState<PriceData | null>(null);
  const [pendingTx, setPendingTx] = useState<CryptoTransaction | null>(null);
  const [confirmedTx, setConfirmedTx] = useState<CryptoTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mnemonic is stored in memory only (not persisted)
  const [mnemonic, setMnemonic] = useState<string>('');

  // Refs to avoid circular dependencies in checkForPayment callback
  const pendingTxRef = useRef(pendingTx);
  const confirmedTxRef = useRef(confirmedTx);
  pendingTxRef.current = pendingTx;
  confirmedTxRef.current = confirmedTx;

  // Fetch prices on mount
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const priceData = await getCryptoPrices();
        setPrices(priceData);
      } catch (err) {
        console.error('Failed to fetch prices:', err);
      }
    };
    fetchPrices();

    // Refresh prices every 60 seconds
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  // Update crypto amount when USD or crypto type changes
  useEffect(() => {
    const updateAmount = async () => {
      if (amountUSD > 0) {
        try {
          const { formatted } = await usdToCrypto(amountUSD, selectedCrypto);
          setCryptoAmount(formatted);
        } catch (err) {
          console.error('Failed to convert amount:', err);
        }
      }
    };
    updateAmount();
  }, [amountUSD, selectedCrypto]);

  // Generate payment address
  const generateAddress = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Generate new mnemonic if not exists
      let currentMnemonic = mnemonic;
      if (!currentMnemonic) {
        currentMnemonic = generateMnemonic();
        setMnemonic(currentMnemonic);
      }

      // Generate address
      const { address } = generatePaymentAddress(
        currentMnemonic,
        selectedCrypto,
        network,
        0 // Use first address
      );

      setPaymentAddress(address);
      toast.success(t('cryptoDonation.toasts.addressGenerated'));
    } catch (err) {
      console.error('Failed to generate address:', err);
      setError(t('cryptoDonation.errors.failedToGenerate'));
      toast.error(t('cryptoDonation.toasts.failedToGenerate'));
    } finally {
      setIsGenerating(false);
    }
  }, [mnemonic, selectedCrypto, network]);

  // Monitor for incoming transactions
  // Uses refs for pendingTx/confirmedTx to avoid circular dependency with monitoring useEffect
  const checkForPayment = useCallback(async () => {
    if (!paymentAddress) return;

    try {
      let transactions: CryptoTransaction[] = [];

      switch (selectedCrypto) {
        case 'bitcoin':
          transactions = await checkBitcoinIncoming(paymentAddress, network);
          break;
        case 'ethereum':
          transactions = await getEthereumTransactions(paymentAddress, network);
          break;
        case 'usdc':
          transactions = await getERC20Transfers(paymentAddress, 'usdc', network);
          break;
        case 'dai':
          transactions = await getERC20Transfers(paymentAddress, 'dai', network);
          break;
      }

      if (transactions.length > 0) {
        const latestTx = transactions[0];

        // Update transaction with campaign info
        latestTx.campaignId = campaignId;

        if (latestTx.status === 'confirmed' && !confirmedTxRef.current) {
          setConfirmedTx(latestTx);
          setPendingTx(null);
          onPaymentConfirmed?.(latestTx);
          toast.success(t('cryptoDonation.toasts.paymentConfirmed'));
        } else if (latestTx.status !== 'confirmed' && !pendingTxRef.current) {
          setPendingTx(latestTx);
          onPaymentDetected?.(latestTx);
          toast.info(t('cryptoDonation.toasts.paymentDetected'));
        } else if (pendingTxRef.current && latestTx.confirmations > pendingTxRef.current.confirmations) {
          setPendingTx(latestTx);
        }
      }
    } catch (err) {
      console.error('Failed to check for payment:', err);
    }
  }, [paymentAddress, selectedCrypto, network, campaignId, onPaymentDetected, onPaymentConfirmed]);

  // Start/stop monitoring
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isMonitoring && paymentAddress) {
      // Check immediately
      checkForPayment();

      // Then check every 30 seconds
      interval = setInterval(checkForPayment, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMonitoring, paymentAddress, checkForPayment]);

  // Copy address to clipboard
  const copyAddress = async () => {
    if (paymentAddress) {
      await navigator.clipboard.writeText(paymentAddress);
      toast.success(t('cryptoDonation.toasts.addressCopied'));
    }
  };

  // Get QR code value (with amount for BTC)
  const getQRValue = () => {
    if (!paymentAddress) return '';

    switch (selectedCrypto) {
      case 'bitcoin':
        // BIP21 URI
        return `bitcoin:${paymentAddress}`;
      case 'ethereum':
      case 'usdc':
      case 'dai':
        // EIP-681 URI
        return `ethereum:${paymentAddress}`;
      default:
        return paymentAddress;
    }
  };

  // Render price info
  const renderPriceInfo = () => {
    if (!prices) return null;

    const price = prices[selectedCrypto];
    return (
      <div className="text-sm text-muted-foreground">
        {t('cryptoDonation.currentPrice', { price: price.toLocaleString(undefined, { maximumFractionDigits: 2 }) })}
      </div>
    );
  };

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            <h3 className="text-lg font-semibold">{t('cryptoDonation.title')}</h3>
          </div>
          <Badge variant="outline">
            {network === 'mainnet' ? t('cryptoDonation.mainnet') : t('cryptoDonation.testnet')}
          </Badge>
        </div>

        {/* Payment Confirmed State */}
        {confirmedTx && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-green-600 mb-2">
              <Check className="w-5 h-5" />
              <span className="font-semibold">{t('cryptoDonation.paymentConfirmed')}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {t('cryptoDonation.thankYou', { amount: confirmedTx.amountFormatted })}
            </p>
            <a
              href={getExplorerUrl(confirmedTx.txHash, selectedCrypto, network)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary flex items-center gap-1 hover:underline"
            >
              {t('cryptoDonation.viewOnExplorer')}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Pending Transaction State */}
        {pendingTx && !confirmedTx && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-600 mb-2">
              <Clock className="w-5 h-5 animate-pulse" />
              <span className="font-semibold">{t('cryptoDonation.paymentPending')}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {t('cryptoDonation.detected', { amount: pendingTx.amountFormatted })}
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span>{t('cryptoDonation.confirmations')}</span>
              <Badge variant="outline">
                {pendingTx.confirmations} / {pendingTx.requiredConfirmations}
              </Badge>
            </div>
            <a
              href={getExplorerUrl(pendingTx.txHash, selectedCrypto, network)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary flex items-center gap-1 hover:underline mt-2"
            >
              {t('cryptoDonation.trackOnBlockchain')}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Crypto Selection and Amount */}
        {!confirmedTx && (
          <>
            <Tabs
              value={selectedCrypto}
              onValueChange={(v) => {
                setSelectedCrypto(v as CryptoType);
                setPaymentAddress('');
                setPendingTx(null);
              }}
            >
              <TabsList className="grid grid-cols-4 w-full">
                {CRYPTO_OPTIONS.map((option) => (
                  <TabsTrigger key={option.value} value={option.value}>
                    <span className="mr-1">{option.icon}</span>
                    {getCryptoSymbol(option.value)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Amount Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('cryptoDonation.donationAmount')}</label>
              <div className="flex gap-2">
                {[10, 25, 50, 100].map((amount) => (
                  <Button
                    key={amount}
                    variant={amountUSD === amount ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAmountUSD(amount)}
                  >
                    ${amount}
                  </Button>
                ))}
                <Input
                  type="number"
                  value={amountUSD}
                  onChange={(e) => setAmountUSD(Number(e.target.value))}
                  min={1}
                  className="w-24"
                  placeholder={t('cryptoDonation.custom')}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  ≈ {cryptoAmount || t('cryptoDonation.calculating')}
                </span>
                {renderPriceInfo()}
              </div>
            </div>

            {/* Generate Address Button */}
            {!paymentAddress && (
              <Button
                onClick={generateAddress}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('cryptoDonation.generatingAddress')}
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4 mr-2" />
                    {t('cryptoDonation.generateAddress', { crypto: getCryptoDisplayName(selectedCrypto) })}
                  </>
                )}
              </Button>
            )}

            {/* Payment Address & QR Code */}
            {paymentAddress && (
              <div className="space-y-4">
                {/* QR Code */}
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <QRCodeSVG
                    value={getQRValue()}
                    size={200}
                    level="M"
                    includeMargin
                  />
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('cryptoDonation.paymentAddress')}</label>
                  <div className="flex gap-2">
                    <Input
                      value={paymentAddress}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button variant="outline" size="icon" onClick={copyAddress}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Monitoring Controls */}
                <div className="flex items-center justify-between">
                  <Button
                    variant={isMonitoring ? 'default' : 'outline'}
                    onClick={() => setIsMonitoring(!isMonitoring)}
                  >
                    {isMonitoring ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('cryptoDonation.monitoring')}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        {t('cryptoDonation.startMonitoring')}
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={checkForPayment}
                    disabled={isMonitoring}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {t('cryptoDonation.checkNow')}
                  </Button>
                </div>

                {/* Instructions */}
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  <p className="font-medium mb-1">{t('cryptoDonation.howToDonate')}</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>{t('cryptoDonation.steps.scan')}</li>
                    <li>{t('cryptoDonation.steps.send', { amount: cryptoAmount })}</li>
                    <li>{t('cryptoDonation.steps.monitor')}</li>
                    <li>{t('cryptoDonation.steps.wait', { confirmations: selectedCrypto === 'bitcoin' ? '3' : '12' })}</li>
                  </ol>
                </div>
              </div>
            )}
          </>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}
      </div>
    </Card>
  );
};
