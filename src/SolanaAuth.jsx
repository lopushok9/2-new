import React, { useCallback, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { UnsafeBurnerWalletAdapter } from '@solana/wallet-adapter-wallets';
import {
    WalletModalProvider,
    WalletDisconnectButton,
    WalletMultiButton
} from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Default styles that can be overridden by your app
import '@solana/wallet-adapter-react-ui/styles.css';

export default function SolanaAuthComponent() {
    // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
    const network = WalletAdapterNetwork.Devnet;

    // You can also provide a custom RPC endpoint.
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);

    const wallets = useMemo(
        () => [
            /**
             * Wallets that implement either of these standards will be available automatically.
             *
             *   - Solana Mobile Stack Mobile Wallet Adapter Protocol
             *     (https://github.com/solana-mobile/mobile-wallet-adapter)
             *   - Solana Wallet Standard
             *     (https://github.com/solana-labs/wallet-standard)
             *
             * If you wish to support a wallet that supports neither of those standards,
             * instantiate its legacy wallet adapter here. Common legacy adapters can be found
             * in the npm package `@solana/wallet-adapter-wallets`.
             */
            new UnsafeBurnerWalletAdapter(),
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [network]
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    <SolanaAuthContent />
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
}

function SolanaAuthContent() {
    const handleSolanaAuth = useCallback(async () => {
        // Here we would implement the authentication logic
        // This would involve signing a message and sending it to our backend
        console.log('Solana authentication triggered');
    }, []);

    return (
        <div className="solana-auth-container">
            <div className="solana-auth-content">
                <div className="divider">
                    <span>OR</span>
                </div>
                
                <div className="solana-section">
                    <h3>Connect with Solana Wallet</h3>
                    <p>Use your Solana wallet to authenticate</p>
                    
                    <div className="wallet-buttons">
                        <WalletMultiButton />
                        <WalletDisconnectButton />
                    </div>
                </div>
            </div>
            
            <style jsx>{`
                .solana-auth-container {
                    margin-top: 2rem;
                }
                
                .divider {
                    text-align: center;
                    margin: 2rem 0;
                    position: relative;
                }
                
                .divider::before {
                    content: '';
                    position: absolute;
                    top: 50%;
                    left: 0;
                    right: 0;
                    height: 1px;
                    background: #e2e8f0;
                    z-index: 1;
                }
                
                .divider span {
                    background: #fff;
                    padding: 0 1rem;
                    color: #64748b;
                    font-size: 0.9rem;
                    position: relative;
                    z-index: 2;
                }
                
                .solana-section {
                    text-align: center;
                }
                
                .solana-section h3 {
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: #0f172a;
                    margin-bottom: 0.5rem;
                }
                
                .solana-section p {
                    color: #64748b;
                    font-size: 0.9rem;
                    margin-bottom: 1.5rem;
                }
                
                .wallet-buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    align-items: center;
                }
                
                .wallet-buttons button {
                    min-width: 200px;
                }
            `}</style>
        </div>
    );
}
