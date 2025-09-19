import React, { useCallback, useMemo } from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { UnsafeBurnerWalletAdapter } from '@solana/wallet-adapter-wallets';
import {
    WalletModalProvider,
    WalletDisconnectButton,
    WalletMultiButton
} from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl, PublicKey } from '@solana/web3.js';
import { sign } from 'tweetnacl';
import { decodeUTF8 } from 'tweetnacl-util';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

function SolanaAuthContent() {
    const { publicKey, signMessage, connected } = useWallet();

    const handleSolanaAuth = useCallback(async () => {
        if (!publicKey || !signMessage) {
            alert('Please connect your wallet first!');
            return;
        }

        try {
            // Create a message to sign
            const message = `Sign this message to authenticate with What Bird.\nTimestamp: ${Date.now()}`;
            const encodedMessage = decodeUTF8(message);
            
            // Request signature from wallet
            const signature = await signMessage(encodedMessage);
            
            // Send to backend for verification
            const response = await fetch('/api/solana-auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    publicKey: publicKey.toBase58(),
                    message,
                    signature: Array.from(signature)
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                // Store token and redirect
                localStorage.setItem('access_token', data.access_token);
                alert('Successfully authenticated with Solana wallet!');
                window.location.href = '/landing';
            } else {
                alert(`Authentication failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Solana auth error:', error);
            alert('Authentication failed. Please try again.');
        }
    }, [publicKey, signMessage]);

    return (
        <div style={{ marginTop: '2rem' }}>
            <div style={{ 
                textAlign: 'center', 
                margin: '2rem 0', 
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    right: 0,
                    height: '1px',
                    background: '#e2e8f0',
                    zIndex: 1
                }}></div>
                <span style={{
                    background: '#fff',
                    padding: '0 1rem',
                    color: '#64748b',
                    fontSize: '0.9rem',
                    position: 'relative',
                    zIndex: 2
                }}>OR</span>
            </div>
            
            <div style={{ textAlign: 'center' }}>
                <h3 style={{
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color: '#0f172a',
                    marginBottom: '0.5rem'
                }}>Connect with Solana Wallet</h3>
                <p style={{
                    color: '#64748b',
                    fontSize: '0.9rem',
                    marginBottom: '1.5rem'
                }}>Use your Solana wallet to authenticate</p>
                
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    alignItems: 'center'
                }}>
                    <WalletMultiButton style={{ minWidth: '200px' }} />
                    {connected && (
                        <button
                            onClick={handleSolanaAuth}
                            style={{
                                minWidth: '200px',
                                padding: '0.75rem 1.5rem',
                                fontSize: '1rem',
                                fontWeight: 500,
                                borderRadius: '0.75rem',
                                background: '#7c3aed',
                                color: '#fff',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.target.style.background = '#6d28d9'}
                            onMouseOut={(e) => e.target.style.background = '#7c3aed'}
                        >
                            Authenticate with Wallet
                        </button>
                    )}
                    {connected && <WalletDisconnectButton style={{ minWidth: '200px' }} />}
                </div>
            </div>
        </div>
    );
}

export default function SolanaAuthComponent() {
    const network = WalletAdapterNetwork.Devnet;
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);

    const wallets = useMemo(
        () => [
            new UnsafeBurnerWalletAdapter(),
        ],
        [network]
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect={false}>
                <WalletModalProvider>
                    <SolanaAuthContent />
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
}
