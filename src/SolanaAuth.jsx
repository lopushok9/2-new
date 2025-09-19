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

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

// Утилита для кодирования строки в UTF-8 (вместо tweetnacl-util)
function encodeUTF8(str) {
    return new TextEncoder().encode(str);
}

function SolanaAuthContent() {
    const { publicKey, signMessage, connected } = useWallet();

    const handleSolanaAuth = useCallback(async () => {
        if (!publicKey || !signMessage) {
            alert('Please connect your wallet first!');
            return;
        }

        try {
            // Показываем индикатор загрузки
            const authButton = document.getElementById('solana-auth-btn');
            const originalText = authButton?.textContent;
            if (authButton) {
                authButton.disabled = true;
                authButton.textContent = 'Authenticating...';
            }

            // Create a message with timestamp
            const timestamp = Date.now();
            const message = `Sign this message to authenticate with What Bird.\nTimestamp: ${timestamp}`;
            const encodedMessage = encodeUTF8(message);
            
            // Request signature from wallet
            let signature;
            try {
                signature = await signMessage(encodedMessage);
            } catch (signError) {
                console.error('User rejected signature:', signError);
                alert('Authentication cancelled');
                return;
            }
            
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
                // Store token and show success
                if (data.access_token) {
                    localStorage.setItem('access_token', data.access_token);
                    localStorage.setItem('auth_method', 'solana');
                    localStorage.setItem('solana_public_key', publicKey.toBase58());
                }
                
                alert('Successfully authenticated with Solana wallet!');
                
                // Redirect to landing page
                setTimeout(() => {
                    window.location.href = '/landing';
                }, 500);
            } else {
                alert(`Authentication failed: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Solana auth error:', error);
            alert('Authentication failed. Please try again.');
        } finally {
            // Восстанавливаем кнопку
            const authButton = document.getElementById('solana-auth-btn');
            if (authButton) {
                authButton.disabled = false;
                authButton.textContent = originalText || 'Authenticate with Wallet';
            }
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
                    <WalletMultiButton style={{ 
                        minWidth: '200px',
                        justifyContent: 'center'
                    }} />
                    
                    {connected && publicKey && (
                        <>
                            <div style={{
                                fontSize: '0.8rem',
                                color: '#64748b',
                                maxWidth: '300px',
                                wordBreak: 'break-all'
                            }}>
                                Connected: {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                            </div>
                            
                            <button
                                id="solana-auth-btn"
                                onClick={handleSolanaAuth}
                                style={{
                                    minWidth: '200px',
                                    padding: '0.75rem 1.5rem',
                                    fontSize: '1rem',
                                    fontWeight: 500,
                                    borderRadius: '0.75rem',
                                    background: '#9333ea',
                                    color: '#fff',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                                }}
                                onMouseOver={(e) => {
                                    e.target.style.background = '#7c3aed';
                                    e.target.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                                }}
                                onMouseOut={(e) => {
                                    e.target.style.background = '#9333ea';
                                    e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                                }}
                            >
                                Authenticate with Wallet
                            </button>
                            
                            <WalletDisconnectButton style={{ 
                                minWidth: '200px',
                                opacity: 0.8
                            }} />
                        </>
                    )}
                </div>
                
                {!connected && (
                    <p style={{
                        marginTop: '1rem',
                        fontSize: '0.8rem',
                        color: '#94a3b8'
                    }}>
                        Connect your wallet to continue with Solana authentication
                    </p>
                )}
            </div>
        </div>
    );
}

export default function SolanaAuthComponent() {
    // Используем Mainnet для продакшена или Devnet для разработки
    const network = process.env.NODE_ENV === 'production' 
        ? WalletAdapterNetwork.Mainnet 
        : WalletAdapterNetwork.Devnet;
    
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);

    const wallets = useMemo(
        () => [
            new UnsafeBurnerWalletAdapter(),
            // Добавьте другие кошельки по необходимости:
            // new PhantomWalletAdapter(),
            // new SolflareWalletAdapter(),
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
