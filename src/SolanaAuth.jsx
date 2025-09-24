import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { PublicKey, clusterApiUrl } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
    ConnectionProvider,
    WalletProvider,
    useWallet,
} from '@solana/wallet-adapter-react';
import {
    WalletModalProvider,
    WalletMultiButton,
} from '@solana/wallet-adapter-react-ui';
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';

// Default styles for the wallet adapter UI
require('@solana/wallet-adapter-react-ui/styles.css');

// Utility to encode a string in UTF-8
function encodeUTF8(str) {
    return new TextEncoder().encode(str);
}

function SolanaAuthContent() {
    const { publicKey, signMessage, connected, disconnect } = useWallet();
    const [isLoading, setIsLoading] = useState(false);

    const handleAuthentication = useCallback(async () => {
        if (!connected || !publicKey || !signMessage) {
            alert('Please connect your wallet first!');
            return;
        }

        try {
            setIsLoading(true);

            // Create a message with a timestamp for authentication
            const timestamp = Date.now();
            const message = `Sign this message to authenticate with What Bird.\nTimestamp: ${timestamp}`;
            const encodedMessage = encodeUTF8(message);

            // Request signature from the wallet
            const signature = await signMessage(encodedMessage);

            // Send to the backend for verification
            const authResponse = await fetch('/api/solana-auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    publicKey: publicKey.toBase58(),
                    message,
                    signature: Array.from(signature),
                }),
            });

            const data = await authResponse.json();

            if (authResponse.ok) {
                // Store token and other details
                if (data.access_token) {
                    localStorage.setItem('access_token', data.access_token);
                    localStorage.setItem('auth_method', 'solana');
                    localStorage.setItem('solana_public_key', publicKey.toBase58());

                    document.cookie = `access_token=${data.access_token}; path=/; max-age=86400`;
                    document.cookie = `auth_method=solana; path=/; max-age=86400`;
                    document.cookie = `solana_public_key=${publicKey.toBase58()}; path=/; max-age=86400`;
                }

                alert('Successfully authenticated with Solana wallet!');

                // Redirect to the profile page
                setTimeout(() => {
                    window.location.href = '/profile';
                }, 500);
            } else {
                alert(`Authentication failed: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Solana auth error:', error);
            alert('Authentication failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [publicKey, signMessage, connected]);

    return (
        <div style={{ marginTop: '2rem' }}>
            <div
                style={{
                    textAlign: 'center',
                    margin: '2rem 0',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: 0,
                        right: 0,
                        height: '1px',
                        background: '#e2e8f0',
                        zIndex: 1,
                    }}
                ></div>
                <span
                    style={{
                        background: '#fff',
                        padding: '0 1rem',
                        color: '#64748b',
                        fontSize: '0.9rem',
                        position: 'relative',
                        zIndex: 2,
                    }}
                >
                    OR
                </span>
            </div>

            <div style={{ textAlign: 'center' }}>
                <h3
                    style={{
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        color: '#0f172a',
                        marginBottom: '0.5rem',
                    }}
                >
                    Connect with Solana Wallet
                </h3>
                <p
                    style={{
                        color: '#64748b',
                        fontSize: '0.9rem',
                        marginBottom: '1.5rem',
                    }}
                >
                    Use your Phantom or Solflare wallet to authenticate
                </p>

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        alignItems: 'center',
                    }}
                >
                    <WalletMultiButton />
                    {connected && (
                        <button
                            onClick={handleAuthentication}
                            disabled={isLoading}
                            style={{
                                minWidth: '200px',
                                padding: '0.75rem 1.5rem',
                                fontSize: '1rem',
                                fontWeight: 500,
                                borderRadius: '0.75rem',
                                background: isLoading ? '#f1f5f9' : '#9333ea',
                                color: isLoading ? '#94a3b8' : '#fff',
                                border: 'none',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                            }}
                        >
                            {isLoading ? 'Authenticating...' : 'Authenticate'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function SolanaAuth() {
    const network = WalletAdapterNetwork.Devnet;
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);
    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter({ network }),
        ],
        [network]
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets}>
                <WalletModalProvider>
                    <SolanaAuthContent />
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
}
