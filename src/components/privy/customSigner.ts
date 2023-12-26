import { SmartAccountSigner } from "permissionless/accounts"
import {
    Address,
    Hex,
    SignableMessage,
    TypedData,
    TypedDataDefinition
} from "viem"
import { WalletClient } from "wagmi"

export class CustomSigner implements SmartAccountSigner<"custom", Address> {
    public address: Address
    public type: "local" = "local"
    public source: "custom" = "custom"
    public publicKey: Hex
    private walletClient: WalletClient

    constructor(walletClient: WalletClient) {
        this.address = walletClient.account.address
        this.publicKey = walletClient.account.address
        this.walletClient = walletClient
    }

    signMessage = async ({
        message
    }: { message: SignableMessage }): Promise<Hex> => {
        return this.walletClient.signMessage({ message })
    }

    signTypedData = async <
        const TTypedData extends TypedData | { [key: string]: unknown },
        TPrimaryType extends string = string
    >(
        typedData: TypedDataDefinition<TTypedData, TPrimaryType>
    ): Promise<Hex> => {
        return this.walletClient.signTypedData({
            account: this.walletClient.account,
            ...typedData
        })
    }
}
