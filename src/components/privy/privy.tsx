"use client"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useAccount, useDisconnect, useWalletClient } from "wagmi"
import { usePublicClient } from "wagmi"
import { Loader } from "@/components/loader"
import {
    SmartAccount,
    signerToSafeSmartAccount,
    signerToSimpleSmartAccount
} from "permissionless/accounts"
import { PrivyClientConfig, PrivyProvider } from "@privy-io/react-auth"
import { Address, Chain, Hash, Transport, http } from "viem"
import {
    ENTRYPOINT_ADDRESS_V06,
    SmartAccountClient,
    createSmartAccountClient,
    walletClientToSmartAccountSigner,
} from "permissionless"
import { createPimlicoBundlerClient, createPimlicoPaymasterClient } from "permissionless/clients/pimlico"
import { DemoTransactionButton } from "@/components/demo-transaction"
import {WagmiProvider, createConfig} from '@privy-io/wagmi';
import { sepolia } from "viem/chains"
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import { ENTRYPOINT_ADDRESS_V06_TYPE } from "permissionless/types"

import {usePrivy, useWallets} from '@privy-io/react-auth';
import {useSetActiveWallet} from '@privy-io/wagmi';


const wagmiConfig = createConfig({
    chains: [sepolia],
    transports: {
      [sepolia.id]: http(),
    },
  });

if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID)
    throw new Error("Missing NEXT_PUBLIC_PRIVY_APP_ID")

if (!process.env.NEXT_PUBLIC_PIMLICO_API_KEY)
    throw new Error("Missing NEXT_PUBLIC_PIMLICO_API_KEY")

const pimlicoRpcUrl = `https://api.pimlico.io/v2/11155111/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`

const pimlicoPaymaster = createPimlicoPaymasterClient({
    transport: http(pimlicoRpcUrl),
    entryPoint: ENTRYPOINT_ADDRESS_V06
})

const bundlerClient = createPimlicoBundlerClient({
    transport: http(pimlicoRpcUrl),
    entryPoint: ENTRYPOINT_ADDRESS_V06,
})

const queryClient = new QueryClient();

const privyConfig: PrivyClientConfig = {
    embeddedWallets: {
      createOnLogin: 'users-without-wallets',
      requireUserPasswordOnCreate: true,
      noPromptOnSignature: false,
    },
    loginMethods: ['wallet', 'email', 'sms'],
    appearance: {
      showWalletLoginFirst: true,
    },
};

export const PrivyFLowProvider = ({
    children
}: { children: React.ReactNode }) => {
    return (
        <PrivyProvider
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
          config={privyConfig}
        >
          <QueryClientProvider client={queryClient}>
            <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
              {children}
            </WagmiProvider>
          </QueryClientProvider>
        </PrivyProvider>
    );
}

export const PrivyFlow = () => {
    const { login, ready, authenticated } = usePrivy()
    const { isConnected, ...account } = useAccount()
    const [showLoader, setShowLoader] = useState<boolean>(false)
    const [smartAccountClient, setSmartAccountClient] =
        useState<SmartAccountClient<ENTRYPOINT_ADDRESS_V06_TYPE> | null>(
            null
        )
    const publicClient = usePublicClient()
    const {wallets, ready: walletsReady} = useWallets();
    const { data: walletClient } = useWalletClient()
    const [txHash, setTxHash] = useState<string | null>(null)
    const { disconnect } = useDisconnect()

    const embeddedWallet = useMemo(
        () => wallets.find((wallet) => wallet.walletClientType === "privy"),
        [wallets]
    )

    const {
        setActiveWallet
    } = useSetActiveWallet();

    useEffect(() => {
        if (embeddedWallet) {
            setActiveWallet(embeddedWallet)
        }
    }, [embeddedWallet])

    const signIn = useCallback(async () => {
        setShowLoader(true)
        login()
    }, [login])

    const signOut = useCallback(async () => {
        setShowLoader(false)
        disconnect()
    }, [disconnect])

    useEffect(() => {
        ;(async () => {
            if (isConnected && walletClient && publicClient) {
                const customSigner = walletClientToSmartAccountSigner(walletClient)

                const safeSmartAccountClient = await signerToSafeSmartAccount(
                    publicClient,
                    {
                        entryPoint: ENTRYPOINT_ADDRESS_V06,
                        signer: customSigner,
                        safeVersion: "1.4.1",
                        saltNonce: BigInt(0)
                    }
                )

                const smartAccountClient = createSmartAccountClient({
                    account: safeSmartAccountClient,
                    entryPoint: ENTRYPOINT_ADDRESS_V06,
                    chain: sepolia,
                    bundlerTransport: http(pimlicoRpcUrl, {
                        timeout: 30_000
                    }),
                    middleware: {
                        gasPrice: async () => (await bundlerClient.getUserOperationGasPrice()).fast,
                        sponsorUserOperation: pimlicoPaymaster.sponsorUserOperation,
                    },
                })

                setSmartAccountClient(smartAccountClient)
            }
        })()
    }, [isConnected, walletClient, publicClient])

    const onSendTransaction = (txHash: Hash) => {
        setTxHash(txHash)
    }

    useEffect(() => {
        console.log("isConnected", isConnected);
        console.log("smartAccountClient", smartAccountClient);
        console.log("embeddedWallet", embeddedWallet);
        console.log("publicClient", publicClient);
        console.log("account", account);
        console.log("walletClient", walletClient);
    }, [isConnected, smartAccountClient, embeddedWallet, publicClient, account, walletClient])

    if (!ready) {
        return null;
    }
    
    if (isConnected && smartAccountClient && embeddedWallet) {
        return (
            <div>
                <div>
                    Smart contract wallet address:{" "}
                    <p className="fixed left-0 top-0 flex flex-col w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
                        <code>{smartAccountClient.account?.address}</code>
                    </p>
                </div>
                <div className="flex gap-x-4">
                    <button
                        onClick={signOut}
                        className="mt-6 flex justify-center items-center w-64 cursor-pointer border-2 border-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    >
                        Sign out
                    </button>
                    <DemoTransactionButton
                        smartAccountClient={smartAccountClient}
                        onSendTransaction={onSendTransaction}
                    />
                </div>
                {txHash && (
                    <p className="mt-4">
                        Transaction hash:{" "}
                        <a
                            href={`https://sepolia.etherscan.io/tx/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                        >
                            {txHash}
                        </a>
                    </p>
                )}
            </div>
        )
    }

    return (
        <>
            {
                !authenticated && (
                    <button
                        onClick={signIn}
                        className="flex justify-center items-center w-64 cursor-pointer bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    >
                        {!showLoader && <p className="mr-4">Sign in with Privy</p>}
                        {showLoader && <Loader />}
                    </button>
                )
            }

            {walletsReady &&
                wallets.map((wallet) => {
                return (
                    <div
                        key={wallet.address}
                        className="flex justify-center items-center cursor-pointer bg-blue-300 hover:bg-blue-100 text-white font-bold py-2 px-4 rounded"
                        >
                    <div>
                    </div>
                    <button
                        onClick={() => {
                            setActiveWallet(wallet);
                        }}
                    >Make active: {wallet.address}</button>
                    </div>
                );
            })}
        </>
    )
}
